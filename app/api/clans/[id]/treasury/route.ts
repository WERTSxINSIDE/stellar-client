import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addBalanceHistory, queryOne, withTransaction } from "@/lib/db";
import { can } from "@/lib/clans";
import { getClanById, getMembership, logClanActivity } from "@/lib/clan-service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const { id } = await params;
    const clanId = Number(id);
    const membership = await getMembership(user.id);
    if (!membership || membership.clan_id !== clanId) {
      return NextResponse.json({ error: "Вы не состоите в этом клане" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "deposit");
    const amount = Math.floor(Number(body?.amount));
    if (!Number.isInteger(amount) || amount <= 0 || amount > 100000) {
      return NextResponse.json({ error: "Укажите сумму от 1 до 100 000 ₽" }, { status: 400 });
    }

    if (action === "deposit") {
      const result = await withTransaction(async (client) => {
        const paid = await client.query(
          `UPDATE users SET balance = COALESCE(balance, 0) - $2
           WHERE id = $1 AND COALESCE(balance, 0) >= $2
           RETURNING balance`,
          [user.id, amount]
        );
        if (!paid.rows.length) return { error: "Недостаточно средств на балансе" } as const;

        await addBalanceHistory(user.id, -amount, "clan_deposit", "Пополнение казны клана", client);
        await client.query("UPDATE clans SET treasury = treasury + $2 WHERE id = $1", [clanId, amount]);
        await client.query(
          "INSERT INTO clan_transactions (clan_id, user_id, amount, type, note) VALUES ($1, $2, $3, 'deposit', $4)",
          [clanId, user.id, amount, `Взнос в казну`]
        );
        await client.query(
          "UPDATE clan_members SET contribution = contribution + $3 WHERE user_id = $1 AND clan_id = $2",
          [user.id, clanId, amount]
        );
        await logClanActivity(
          clanId,
          user.id,
          "deposit",
          Math.min(20, Math.max(1, Math.floor(amount / 100))),
          `Взнос в казну: ${amount} ₽`,
          client
        );
        return { balance: Number(paid.rows[0].balance) || 0 } as const;
      });

      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      const clan = await getClanById(clanId);
      return NextResponse.json({ ok: true, treasury: clan?.treasury ?? 0, balance: result.balance });
    }

    if (action === "withdraw") {
      if (!can(membership.role, "treasury_withdraw")) {
        return NextResponse.json({ error: "Выводить средства может лидер, соруководитель или казначей" }, { status: 403 });
      }

      const result = await withTransaction(async (client) => {
        const taken = await client.query(
          `UPDATE clans SET treasury = treasury - $2
           WHERE id = $1 AND treasury >= $2
           RETURNING treasury, leader_id`,
          [clanId, amount]
        );
        if (!taken.rows.length) return { error: "В казне недостаточно средств" } as const;

        const paidOut = await client.query(
          "UPDATE users SET balance = COALESCE(balance, 0) + $2 WHERE id = $1 RETURNING balance",
          [user.id, amount]
        );
        await addBalanceHistory(user.id, amount, "clan_withdraw", "Вывод из казны клана", client);
        await client.query(
          "INSERT INTO clan_transactions (clan_id, user_id, amount, type, note) VALUES ($1, $2, $3, 'withdraw', $4)",
          [clanId, user.id, -amount, "Вывод из казны"]
        );
        await logClanActivity(clanId, user.id, "withdraw", 0, `Вывод из казны: ${amount} ₽`, client);

        const leaderId = Number(taken.rows[0]?.leader_id);
        if (leaderId && leaderId !== user.id) {
          await client.query(
            `INSERT INTO notifications (user_id, type, title, body, link)
             VALUES ($1, 'clan', 'Вывод из казны клана', $2, $3)`,
            [leaderId, `${user.username} вывел ${amount} ₽ из казны`, `/clans/${clanId}`]
          );
        }

        return { treasury: Number(taken.rows[0].treasury) || 0, balance: Number(paidOut.rows[0]?.balance) || 0 } as const;
      });

      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({ ok: true, treasury: result.treasury, balance: result.balance });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
