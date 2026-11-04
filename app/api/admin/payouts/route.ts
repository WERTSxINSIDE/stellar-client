import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { addBalanceHistory, queryAll, queryOne, withTransaction } from "@/lib/db";
import { logAdminAction } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";

export const dynamic = "force-dynamic";

const STATUSES = ["pending", "approved", "rejected", "all"] as const;

/** Заявки авторов на вывод средств. */
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const requested = String(url.searchParams.get("status") || "pending");
    const status = STATUSES.includes(requested as (typeof STATUSES)[number])
      ? requested
      : "pending";

    const requests = await queryAll(
      `SELECT p.id, p.user_id, p.amount, p.method, p.details, p.status,
              p.admin_note, p.created_at, p.processed_at,
              u.username, u.email, u.avatar_url
       FROM payout_requests p
       JOIN users u ON u.id = p.user_id
       WHERE ($1::text = 'all' OR p.status = $1)
       ORDER BY p.created_at DESC
       LIMIT 200`,
      [status]
    );

    const counts = (await queryOne(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
         COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
         COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
         COUNT(*)::int AS total
       FROM payout_requests`
    )) as Record<string, number> | null;

    return NextResponse.json(
      { ok: true, requests, counts, status },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

class PayoutError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Одобрение или отклонение заявки. При отказе деньги возвращаются на баланс. */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const id = Number(body?.id);
    const action = String(body?.action || "");
    const note = String(body?.admin_note || "").trim().slice(0, 500) || null;

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Неверная заявка" }, { status: 400 });
    }
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "Неверное действие" }, { status: 400 });
    }

    const request = (await queryOne(
      `SELECT p.id, p.user_id, p.amount, p.status, u.username
       FROM payout_requests p
       JOIN users u ON u.id = p.user_id
       WHERE p.id = $1`,
      [id]
    )) as
      | {
          id: number;
          user_id: number;
          amount: number;
          status: string;
          username: string;
        }
      | null;

    if (!request) {
      return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
    }

    try {
      await withTransaction(async (client) => {
        const locked = await client.query(
          "SELECT id, user_id, amount, status FROM payout_requests WHERE id = $1 FOR UPDATE",
          [id]
        );
        const fresh = locked.rows[0];
        if (!fresh) throw new PayoutError("Заявка не найдена", 404);
        if (fresh.status !== "pending") {
          throw new PayoutError("Заявка уже обработана", 409);
        }

        const nextStatus = action === "approve" ? "approved" : "rejected";
        await client.query(
          `UPDATE payout_requests
           SET status = $2, admin_note = $3, processed_by = $4, processed_at = NOW()
           WHERE id = $1`,
          [id, nextStatus, note, admin.id]
        );

        if (action === "reject") {
          await client.query(
            "UPDATE users SET balance = COALESCE(balance, 0) + $2 WHERE id = $1",
            [request.user_id, request.amount]
          );
          await addBalanceHistory(
            request.user_id,
            Number(request.amount),
            "payout_refund",
            `Возврат по заявке #${id}`,
            client
          );
        }
      });
    } catch (error) {
      if (error instanceof PayoutError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }

    await notifyUser(request.user_id, {
      type: "balance",
      title: action === "approve" ? "Выплата одобрена" : "Заявка на вывод отклонена",
      body:
        action === "approve"
          ? `Заявка #${id} на ${request.amount} ₽ одобрена. Деньги отправлены по указанным реквизитам.`
          : `Заявка #${id} на ${request.amount} ₽ отклонена. Средства возвращены на баланс.${note ? ` Причина: ${note}` : ""}`,
      link: "/dashboard/author",
    }).catch(() => {});

    await logAdminAction(
      admin,
      action === "approve" ? "payout_approve" : "payout_reject",
      { id: request.user_id, username: request.username },
      `Заявка #${id} на ${request.amount} ₽${note ? `, комментарий: ${note}` : ""}`
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
