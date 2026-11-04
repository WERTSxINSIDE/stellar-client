import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addBalanceHistory, queryAll, queryOne, withTransaction } from "@/lib/db";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { notifyUser } from "@/lib/notify";

export const dynamic = "force-dynamic";

const MIN_PAYOUT = 100;

const PAYOUT_METHODS = ["card", "sbp", "crypto", "funpay"] as const;

type PayoutMethod = (typeof PAYOUT_METHODS)[number];

function isPayoutMethod(value: unknown): value is PayoutMethod {
  return PAYOUT_METHODS.includes(value as PayoutMethod);
}

class PayoutError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Баланс и заявки на вывод текущего автора. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const balanceRow = (await queryOne(
      "SELECT COALESCE(balance, 0)::int AS balance FROM users WHERE id = $1",
      [user.id]
    )) as { balance?: number } | null;

    const requests = await queryAll(
      `SELECT id, amount, method, details, status, admin_note, created_at, processed_at
       FROM payout_requests
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [user.id]
    );

    return NextResponse.json(
      {
        ok: true,
        balance: Number(balanceRow?.balance || 0),
        requests,
        min_amount: MIN_PAYOUT,
        methods: PAYOUT_METHODS,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

/** Создание заявки на вывод: сумма сразу блокируется на балансе. */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const limited = await enforceRateLimit(req, [
      { scope: "payout:account", identifier: user.id, limit: 5, windowMs: 60 * 60_000 },
      { scope: "payout:ip", identifier: getClientIp(req), limit: 10, windowMs: 60 * 60_000 },
    ]);
    if (limited) return limited;

    const body = await req.json();
    const amount = Number(body?.amount);
    const method = body?.method;
    const details = String(body?.details || "").trim().slice(0, 300);

    if (!Number.isInteger(amount) || amount < MIN_PAYOUT) {
      return NextResponse.json(
        { error: `Минимальная сумма вывода — ${MIN_PAYOUT} ₽` },
        { status: 400 }
      );
    }
    if (!isPayoutMethod(method)) {
      return NextResponse.json({ error: "Выберите способ вывода" }, { status: 400 });
    }
    if (details.length < 3) {
      return NextResponse.json(
        { error: "Укажите реквизиты для вывода" },
        { status: 400 }
      );
    }

    let requestId = 0;
    let balance = 0;

    try {
      await withTransaction(async (client) => {
        const pending = await client.query(
          "SELECT COUNT(*)::int AS count FROM payout_requests WHERE user_id = $1 AND status = 'pending'",
          [user.id]
        );
        if (Number(pending.rows[0]?.count || 0) >= 3) {
          throw new PayoutError("У вас уже 3 заявки на рассмотрении", 429);
        }

        const debit = await client.query(
          `UPDATE users
           SET balance = COALESCE(balance, 0) - $2
           WHERE id = $1 AND COALESCE(balance, 0) >= $2
           RETURNING balance`,
          [user.id, amount]
        );
        if (!debit.rows.length) {
          throw new PayoutError("Недостаточно средств на балансе");
        }
        balance = Number(debit.rows[0].balance);

        const inserted = await client.query(
          `INSERT INTO payout_requests (user_id, amount, method, details, status)
           VALUES ($1, $2, $3, $4, 'pending')
           RETURNING id`,
          [user.id, amount, method, details]
        );
        requestId = Number(inserted.rows[0]?.id || 0);

        await addBalanceHistory(
          user.id,
          -amount,
          "payout_request",
          `Заявка на вывод #${requestId}`,
          client
        );
      });
    } catch (error) {
      if (error instanceof PayoutError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }

    await notifyUser(user.id, {
      type: "balance",
      title: "Заявка на вывод создана",
      body: `Заявка #${requestId} на ${amount} ₽ принята. Средства зарезервированы до решения администратора.`,
      link: "/dashboard/author",
    }).catch(() => {});

    return NextResponse.json({ ok: true, id: requestId, balance });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
