import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addBalanceHistory, queryOne, withTransaction } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Курс обмена: 50 SC = 1 ₽. */
const SC_PER_RUBLE = 50;
const MAX_RUB = 100000;
const MAX_SC = 1000000;

type Direction = "rub_to_sc" | "sc_to_rub";

function balances(row: { balance?: unknown; sc_coins?: unknown } | null) {
  return {
    balance: Number(row?.balance || 0),
    sc_coins: Number(row?.sc_coins || 0),
  };
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const fresh = await queryOne(
      "SELECT COALESCE(balance, 0)::int AS balance, COALESCE(sc_coins, 0)::int AS sc_coins FROM users WHERE id = $1",
      [user.id]
    );

    return NextResponse.json({
      ok: true,
      ...balances(fresh),
      sc_per_ruble: SC_PER_RUBLE,
      rub_per_sc: 1 / SC_PER_RUBLE,
      max_rub: MAX_RUB,
      max_sc: MAX_SC,
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const direction = String(body?.direction || "") as Direction;
    const raw = Number(body?.amount);

    if (direction !== "rub_to_sc" && direction !== "sc_to_rub") {
      return NextResponse.json({ error: "Неизвестное направление обмена" }, { status: 400 });
    }
    if (!Number.isFinite(raw) || raw <= 0) {
      return NextResponse.json({ error: "Введите сумму" }, { status: 400 });
    }

    const amount = Math.floor(raw);
    if (amount !== raw) {
      return NextResponse.json({ error: "Сумма должна быть целым числом" }, { status: 400 });
    }

    if (direction === "rub_to_sc" && amount > MAX_RUB) {
      return NextResponse.json({ error: `Максимум ${MAX_RUB} ₽ за раз` }, { status: 400 });
    }
    if (direction === "sc_to_rub") {
      if (amount > MAX_SC) {
        return NextResponse.json({ error: `Максимум ${MAX_SC} SC за раз` }, { status: 400 });
      }
      if (amount < SC_PER_RUBLE) {
        return NextResponse.json(
          { error: `Минимум ${SC_PER_RUBLE} SC за раз` },
          { status: 400 }
        );
      }
    }

    const result = await withTransaction(async (client) => {
      if (direction === "rub_to_sc") {
        const sc = amount * SC_PER_RUBLE;
        const updated = await client.query(
          `UPDATE users
           SET balance = COALESCE(balance, 0) - $2,
               sc_coins = COALESCE(sc_coins, 0) + $3
           WHERE id = $1 AND COALESCE(balance, 0) >= $2
           RETURNING COALESCE(balance, 0)::int AS balance, COALESCE(sc_coins, 0)::int AS sc_coins`,
          [user.id, amount, sc]
        );
        if (!updated.rows.length) return { error: "Недостаточно средств на балансе" } as const;

        await addBalanceHistory(user.id, -amount, "exchange", `Обмен: ${amount} ₽ → ${sc} SC`, client);
        await client.query(
          "INSERT INTO coin_transactions (user_id, amount, type, note) VALUES ($1, $2, 'exchange', $3)",
          [user.id, sc, `Обмен: ${amount} ₽ → ${sc} SC`]
        );

        return {
          spent: amount,
          received: sc,
          spent_label: "₽",
          received_label: "SC",
          ...balances(updated.rows[0]),
        } as const;
      }

      // Любую сумму SC можно обменять: рубли начисляются целыми,
      // а остаток SC (меньше курса) остаётся на счету и не сгорает.
      const rub = Math.floor(amount / SC_PER_RUBLE);
      const spentSc = rub * SC_PER_RUBLE;
      const remainder = amount - spentSc;
      if (rub <= 0) return { error: `Минимум ${SC_PER_RUBLE} SC` } as const;

      const updated = await client.query(
        `UPDATE users
         SET sc_coins = COALESCE(sc_coins, 0) - $2,
             balance = COALESCE(balance, 0) + $3
         WHERE id = $1 AND COALESCE(sc_coins, 0) >= $2
         RETURNING COALESCE(balance, 0)::int AS balance, COALESCE(sc_coins, 0)::int AS sc_coins`,
        [user.id, spentSc, rub]
      );
      if (!updated.rows.length) return { error: "Недостаточно SC-монет" } as const;

      await client.query(
        "INSERT INTO coin_transactions (user_id, amount, type, note) VALUES ($1, $2, 'exchange', $3)",
        [user.id, -spentSc, `Обмен: ${spentSc} SC → ${rub} ₽`]
      );
      await addBalanceHistory(user.id, rub, "exchange", `Обмен: ${spentSc} SC → ${rub} ₽`, client);

      return {
        spent: spentSc,
        received: rub,
        remainder,
        spent_label: "SC",
        received_label: "₽",
        ...balances(updated.rows[0]),
      } as const;
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
