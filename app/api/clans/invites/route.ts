import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryAll, withTransaction } from "@/lib/db";
import { getMembership } from "@/lib/clan-service";
import { clanLevel, clanMaxMembers } from "@/lib/clans";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const invites = await queryAll(
      `SELECT ci.id, ci.clan_id, ci.created_at, ci.expires_at,
              c.name, c.tag, c.emblem, c.color, c.description, c.xp,
              u.username AS inviter_name,
              (SELECT COUNT(*)::int FROM clan_members cm WHERE cm.clan_id = c.id) AS member_count
       FROM clan_invites ci
       JOIN clans c ON c.id = ci.clan_id
       LEFT JOIN users u ON u.id = ci.inviter_id
       WHERE ci.invitee_id = $1 AND ci.status = 'pending'
         AND (ci.expires_at IS NULL OR ci.expires_at > NOW())
       ORDER BY ci.created_at DESC
       LIMIT 30`,
      [user.id]
    );

    return NextResponse.json({ ok: true, invites });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const inviteId = Number(body?.inviteId);
    const action = String(body?.action || "");
    if (!Number.isInteger(inviteId) || inviteId <= 0) {
      return NextResponse.json({ error: "Приглашение не найдено" }, { status: 400 });
    }
    if (action !== "accept" && action !== "decline") {
      return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
    }

    const result = await withTransaction(async (client) => {
      const invite = await client.query(
        `SELECT ci.id, ci.clan_id, ci.inviter_id, ci.status,
                (ci.expires_at IS NOT NULL AND ci.expires_at <= NOW()) AS expired,
                c.name, c.xp, c.leader_id
         FROM clan_invites ci JOIN clans c ON c.id = ci.clan_id
         WHERE ci.id = $1 AND ci.invitee_id = $2`,
        [inviteId, user.id]
      );
      if (!invite.rows.length) return { error: "Приглашение не найдено" } as const;

      const row = invite.rows[0] as {
        id: number;
        clan_id: number;
        inviter_id: number | null;
        status: string;
        expired: boolean;
        name: string;
        xp: number;
      };

      if (row.status !== "pending" || row.expired) {
        return { error: "Приглашение уже недействительно" } as const;
      }

      if (action === "decline") {
        await client.query("UPDATE clan_invites SET status = 'declined' WHERE id = $1", [inviteId]);
        return { ok: true, declined: true } as const;
      }

      if (await getMembership(user.id)) {
        return { error: "Вы уже состоите в клане" } as const;
      }

      await client.query("SELECT id FROM clans WHERE id = $1 FOR UPDATE", [row.clan_id]);
      const count = await client.query(
        "SELECT COUNT(*)::int AS n FROM clan_members WHERE clan_id = $1",
        [row.clan_id]
      );
      const level = clanLevel(Number(row.xp) || 0);
      const maxMembers = clanMaxMembers(level);
      if (Number(count.rows[0]?.n || 0) >= maxMembers) {
        return { error: "В клане нет свободных мест" } as const;
      }

      await client.query(
        "INSERT INTO clan_members (user_id, clan_id, role) VALUES ($1, $2, 'recruit')",
        [user.id, row.clan_id]
      );
      await client.query("UPDATE clan_invites SET status = 'accepted' WHERE id = $1", [inviteId]);
      await client.query(
        "UPDATE clan_invites SET status = 'declined' WHERE invitee_id = $1 AND status = 'pending' AND id <> $2",
        [user.id, inviteId]
      );
      await client.query(
        "INSERT INTO clan_activity (clan_id, user_id, type, points, note) VALUES ($1, $2, 'join', 5, $3)",
        [row.clan_id, user.id, `${user.username} вступил по приглашению`]
      );
      await client.query("UPDATE clans SET xp = COALESCE(xp, 0) + 5 WHERE id = $1", [row.clan_id]);

      if (row.inviter_id) {
        await client.query(
          `INSERT INTO notifications (user_id, type, title, body, link)
           VALUES ($1, 'clan', 'Приглашение принято', $2, $3)`,
          [row.inviter_id, `${user.username} вступил в клан ${row.name}`, `/clans/${row.clan_id}`]
        );
      }

      return { ok: true, clan_id: row.clan_id } as const;
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
