import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addBalanceHistory, withTransaction } from "@/lib/db";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { username, amount } = await req.json();
    if (!username || amount === undefined || amount === null) {
      return NextResponse.json({ error: "Укажите получателя и сумму" }, { status: 400 });
    }

    const value = Number(amount);
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
      return NextResponse.json({ error: "Минимум 1₽" }, { status: 400 });
    }

    if (String(username).toLowerCase() === user.username.toLowerCase()) {
      return NextResponse.json({ error: "Нельзя переводить себе" }, { status: 400 });
    }

    const limited = await enforceRateLimit(req, [
      { scope: "balance-transfer:account", identifier: user.id, limit: 10, windowMs: 10 * 60_000 },
      { scope: "balance-transfer:ip", identifier: getClientIp(req), limit: 30, windowMs: 10 * 60_000 },
    ]);
    if (limited) return limited;

    const result = await withTransaction(async (client) => {
      // Блокируем обе строки в стабильном порядке (по id), чтобы избежать дедлоков
      // при одновременных переводах A→B и B→A.
      const locked = await client.query(
        `SELECT id, username, COALESCE(balance, 0) AS balance
         FROM users
         WHERE id = $1 OR LOWER(username) = LOWER($2)
         ORDER BY id
         FOR UPDATE`,
        [user.id, String(username)]
      );

      const sender = locked.rows.find((row) => row.id === user.id);
      const recipient = locked.rows.find((row) => row.id !== user.id);

      if (!sender) {
        return { error: "Пользователь не найден", status: 404 } as const;
      }
      if (!recipient) {
        return { error: "Пользователь не найден", status: 404 } as const;
      }

      const senderBalance = Number(sender.balance) || 0;
      if (senderBalance < value) {
        return {
          error: `Недостаточно баланса. У вас ${senderBalance}₽`,
          status: 400,
        } as const;
      }

      // Списываем с условием на баланс — на случай нестандартных блокировок.
      const updated = await client.query(
        `UPDATE users SET balance = balance - $1
         WHERE id = $2 AND COALESCE(balance, 0) >= $1
         RETURNING balance`,
        [value, sender.id]
      );
      if (!updated.rows.length) {
        return { error: "Недостаточно баланса", status: 400 } as const;
      }

      await client.query(
        "UPDATE users SET balance = COALESCE(balance, 0) + $1 WHERE id = $2",
        [value, recipient.id]
      );

      await addBalanceHistory(sender.id, -value, "transfer", `Перевод: ${recipient.username}`, client);
      await addBalanceHistory(recipient.id, value, "transfer", `Перевод от: ${sender.username}`, client);

      return { balance: Number(updated.rows[0].balance) || 0 } as const;
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true, balance: result.balance });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
