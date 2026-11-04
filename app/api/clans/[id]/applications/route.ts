import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { can } from "@/lib/clans";
import { getClanById, getMembership } from "@/lib/clan-service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const { id } = await params;
    const clanId = Number(id);
    const membership = await getMembership(user.id);
    if (!membership || membership.clan_id !== clanId || !can(membership.role, "review_applications")) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const applicationId = Number(body?.applicationId);
    const action = String(body?.action || "");
    if (!Number.isInteger(applicationId) || applicationId <= 0) {
      return NextResponse.json({ error: "Заявка не найдена" }, { status: 400 });
    }
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
    }

    const result = await withTransaction(async (client) => {
      // Блокируем клан, чтобы параллельные одобрения не превысили лимит.
      await client.query("SELECT id FROM clans WHERE id = $1 FOR UPDATE", [clanId]);

      const app = await client.query(
        `SELECT ca.id, ca.user_id, ca.status, u.username
         FROM clan_applications ca JOIN users u ON u.id = ca.user_id
         WHERE ca.id = $1 AND ca.clan_id = $2`,
        [applicationId, clanId]
      );
      if (!app.rows.length) return { error: "Заявка не найдена" } as const;

      const row = app.rows[0] as { id: number; user_id: number; status: string; username: string };
      if (row.status !== "pending") return { error: "Заявка уже обработана" } as const;

      if (action === "reject") {
        await client.query(
          `UPDATE clan_applications SET status = 'rejected', reviewed_by = $2, reviewed_at = NOW()
           WHERE id = $1`,
          [applicationId, user.id]
        );
        await client.query(
          `INSERT INTO notifications (user_id, type, title, body, link)
           VALUES ($1, 'clan', 'Заявка в клан отклонена', $2, '/clans')`,
          [row.user_id, "Вы можете подать заявку в другой клан"]
        );
        return { ok: true } as const;
      }

      const already = await client.query("SELECT clan_id FROM clan_members WHERE user_id = $1", [row.user_id]);
      if (already.rows.length) {
        await client.query(
          `UPDATE clan_applications SET status = 'rejected', reviewed_by = $2, reviewed_at = NOW()
           WHERE id = $1`,
          [applicationId, user.id]
        );
        return { error: "Игрок уже состоит в клане" } as const;
      }

      const clan = await client.query(
        `SELECT c.name, c.xp,
                (SELECT COUNT(*)::int FROM clan_members cm WHERE cm.clan_id = c.id) AS member_count
         FROM clans c WHERE c.id = $1`,
        [clanId]
      );
      const clanRow = clan.rows[0] as { name: string; xp: number; member_count: number };
      const level = Math.max(1, Math.floor(Math.sqrt((Number(clanRow.xp) || 0) / 100)) + 1);
      const maxMembers = Math.min(50, 10 + level * 2);
      if (Number(clanRow.member_count) >= maxMembers) {
        return { error: "В клане нет свободных мест" } as const;
      }

      await client.query(
        `UPDATE clan_applications SET status = 'approved', reviewed_by = $2, reviewed_at = NOW()
         WHERE id = $1`,
        [applicationId, user.id]
      );
      // Остальные заявки игрока закрываем, чтобы не висели в других кланах.
      await client.query(
        `UPDATE clan_applications SET status = 'rejected', reviewed_by = $2, reviewed_at = NOW()
         WHERE user_id = $1 AND status = 'pending' AND clan_id <> $3`,
        [row.user_id, user.id, clanId]
      );

      await client.query(
        "INSERT INTO clan_members (user_id, clan_id, role) VALUES ($1, $2, 'recruit')",
        [row.user_id, clanId]
      );
      await client.query(
        "INSERT INTO clan_activity (clan_id, user_id, type, points, note) VALUES ($1, $2, 'join', 5, $3)",
        [clanId, row.user_id, `${row.username} вступил в клан`]
      );
      await client.query("UPDATE clans SET xp = COALESCE(xp, 0) + 5 WHERE id = $1", [clanId]);
      await client.query(
        `INSERT INTO notifications (user_id, type, title, body, link)
         VALUES ($1, 'clan', 'Заявка одобрена', $2, $3)`,
        [row.user_id, `Вы вступили в клан ${clanRow.name}`, `/clans/${clanId}`]
      );

      return { ok: true } as const;
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
