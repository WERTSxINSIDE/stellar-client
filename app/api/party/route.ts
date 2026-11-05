import { NextResponse } from "next/server";
import { query, queryOne, queryAll, withTransaction } from "@/lib/db";
import { notifyUser } from "@/lib/notify";
import { getPartyUser } from "@/lib/party-auth";
import { getRealtimeConfig, newRealtimeKey } from "@/lib/realtime";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export const PARTY_MAX_MEMBERS = 8;
const POSITION_TTL_SECONDS = 10;

type MemberRow = {
  user_id: number;
  username: string;
  avatar_url: string | null;
  nickname_color: string | null;
  online: boolean;
  in_game: boolean;
  joined_at: string;
};

async function membership(userId: number) {
  return (await queryOne(
    `SELECT pm.party_id, pm.joined_at, p.leader_id, p.created_at, p.realtime_key
     FROM party_members pm
     JOIN parties p ON p.id = pm.party_id
     WHERE pm.user_id = $1`,
    [userId]
  )) as
    | {
        party_id: number;
        joined_at: string;
        leader_id: number;
        created_at: string;
        realtime_key: string | null;
      }
    | null;
}

async function loadState(userId: number) {
  const own = await membership(userId);

  if (!own) {
    const invites = await queryAll(
      `SELECT pi.id, pi.party_id, pi.created_at, pi.inviter_id,
              u.username AS from_username, u.avatar_url AS from_avatar,
              (SELECT COUNT(*)::int FROM party_members pm WHERE pm.party_id = pi.party_id) AS member_count
       FROM party_invites pi
       JOIN users u ON u.id = pi.inviter_id
       WHERE pi.invitee_id = $1
       ORDER BY pi.id DESC`,
      [userId]
    );
    return { party: null, invites, max_members: PARTY_MAX_MEMBERS };
  }

  const members = (await queryAll(
    `SELECT pm.user_id, u.username, u.avatar_url, u.nickname_color, pm.joined_at,
            (u.last_seen IS NOT NULL AND u.last_seen > NOW() - INTERVAL '5 minutes') AS online,
            EXISTS(
              SELECT 1 FROM play_sessions ps
              WHERE ps.user_id = u.id
                AND ps.ended_at IS NULL
                AND ps.started_at > NOW() - INTERVAL '12 hours'
            ) AS in_game
     FROM party_members pm
     JOIN users u ON u.id = pm.user_id
     WHERE pm.party_id = $1
     ORDER BY pm.joined_at ASC, pm.user_id ASC`,
    [own.party_id]
  )) as MemberRow[];

  return {
    party: {
      id: own.party_id,
      leader_id: own.leader_id,
      created_at: own.created_at,
      members: members.map((member) => ({
        ...member,
        online: Boolean(member.online) || Boolean(member.in_game),
        in_game: Boolean(member.in_game),
        is_leader: member.user_id === own.leader_id,
        is_self: member.user_id === userId,
      })),
    },
    invites: [],
    max_members: PARTY_MAX_MEMBERS,
    position_ttl_seconds: POSITION_TTL_SECONDS,
    realtime: getRealtimeConfig(own.party_id, own.realtime_key),
  };
}

async function isFriend(a: number, b: number) {
  const row = await queryOne(
    `SELECT 1 FROM friendships
     WHERE status = 'accepted'
       AND ((requester_id = $1 AND addressee_id = $2)
         OR (requester_id = $2 AND addressee_id = $1))`,
    [a, b]
  );
  return Boolean(row);
}

export async function GET(req: Request) {
  try {
    const user = await getPartyUser(req);
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    return NextResponse.json({ ok: true, ...(await loadState(user.id)) });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getPartyUser(req);
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const limited = await enforceRateLimit(req, [
      { scope: "party:account", identifier: user.id, limit: 60, windowMs: 10 * 60_000 },
    ]);
    if (limited) return limited;

    const body = (await req.json().catch(() => ({}))) as {
      action?: unknown;
      username?: unknown;
      invite_id?: unknown;
      user_id?: unknown;
    };
    const action = String(body.action || "");

    if (action === "create") {
      if (await membership(user.id)) {
        return NextResponse.json({ error: "Вы уже в пати" }, { status: 409 });
      }

      await withTransaction(async (client) => {
        const inserted = await client.query(
          "INSERT INTO parties (leader_id, realtime_key) VALUES ($1, $2) RETURNING id",
          [user.id, newRealtimeKey()]
        );
        await client.query(
          "INSERT INTO party_members (party_id, user_id) VALUES ($1, $2)",
          [inserted.rows[0].id, user.id]
        );
        await client.query("DELETE FROM party_invites WHERE invitee_id = $1", [user.id]);
      });

      return NextResponse.json({ ok: true, ...(await loadState(user.id)) });
    }

    if (action === "invite") {
      const username = String(body.username || "").trim();
      if (!username) {
        return NextResponse.json({ error: "Укажите никнейм" }, { status: 400 });
      }

      const own = await membership(user.id);
      if (!own) {
        return NextResponse.json({ error: "Сначала создайте пати" }, { status: 400 });
      }
      if (own.leader_id !== user.id) {
        return NextResponse.json({ error: "Приглашать может только лидер" }, { status: 403 });
      }

      const target = (await queryOne(
        "SELECT id, username FROM users WHERE LOWER(username) = LOWER($1) AND COALESCE(banned, 0) = 0",
        [username]
      )) as { id: number; username: string } | null;
      if (!target) {
        return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
      }
      if (target.id === user.id) {
        return NextResponse.json({ error: "Вы уже в пати" }, { status: 400 });
      }
      if (!(await isFriend(user.id, target.id))) {
        return NextResponse.json(
          { error: "Приглашать можно только друзей" },
          { status: 403 }
        );
      }
      if (await membership(target.id)) {
        return NextResponse.json({ error: "Игрок уже состоит в пати" }, { status: 409 });
      }

      const count = (await queryOne(
        "SELECT COUNT(*)::int AS n FROM party_members WHERE party_id = $1",
        [own.party_id]
      )) as { n: number } | null;
      if (Number(count?.n || 0) >= PARTY_MAX_MEMBERS) {
        return NextResponse.json(
          { error: `В пати максимум ${PARTY_MAX_MEMBERS} человек` },
          { status: 400 }
        );
      }

      const existing = await queryOne(
        "SELECT id FROM party_invites WHERE party_id = $1 AND invitee_id = $2",
        [own.party_id, target.id]
      );
      if (existing) {
        return NextResponse.json({ error: "Приглашение уже отправлено" }, { status: 409 });
      }

      await query(
        "INSERT INTO party_invites (party_id, inviter_id, invitee_id) VALUES ($1, $2, $3)",
        [own.party_id, user.id, target.id]
      );

      await notifyUser(target.id, {
        type: "party",
        title: "Приглашение в пати",
        body: `${user.username} приглашает вас в пати.`,
        link: "/dashboard/party",
      }).catch(() => {});

      return NextResponse.json({ ok: true, ...(await loadState(user.id)) });
    }

    if (action === "accept") {
      const inviteId = Math.floor(Number(body.invite_id));
      if (!Number.isInteger(inviteId) || inviteId <= 0) {
        return NextResponse.json({ error: "Неверное приглашение" }, { status: 400 });
      }
      if (await membership(user.id)) {
        return NextResponse.json({ error: "Вы уже в пати" }, { status: 409 });
      }

      const invite = (await queryOne(
        "SELECT id, party_id, inviter_id FROM party_invites WHERE id = $1 AND invitee_id = $2",
        [inviteId, user.id]
      )) as { id: number; party_id: number; inviter_id: number } | null;

      if (!invite) {
        return NextResponse.json({ error: "Приглашение не найдено" }, { status: 404 });
      }

      const result = await withTransaction(async (client) => {
        const party = await client.query(
          "SELECT id FROM parties WHERE id = $1 FOR UPDATE",
          [invite.party_id]
        );
        if (!party.rows.length) return { error: "party_gone" as const };

        const count = await client.query(
          "SELECT COUNT(*)::int AS n FROM party_members WHERE party_id = $1",
          [invite.party_id]
        );
        if (Number(count.rows[0]?.n || 0) >= PARTY_MAX_MEMBERS) {
          return { error: "full" as const };
        }

        const inserted = await client.query(
          `INSERT INTO party_members (party_id, user_id) VALUES ($1, $2)
           ON CONFLICT (user_id) DO NOTHING
           RETURNING user_id`,
          [invite.party_id, user.id]
        );
        if (!inserted.rows.length) return { error: "already" as const };

        await client.query("DELETE FROM party_invites WHERE id = $1", [invite.id]);
        await client.query("DELETE FROM party_invites WHERE invitee_id = $1", [user.id]);
        return { ok: true as const, partyId: invite.party_id };
      });

      if ("error" in result) {
        const messages: Record<string, string> = {
          party_gone: "Пати больше не существует",
          full: "В пати нет свободных мест",
          already: "Вы уже в пати",
        };
        return NextResponse.json(
          { error: messages[String(result.error)] || "Не удалось вступить" },
          { status: 409 }
        );
      }

      await notifyUser(invite.inviter_id, {
        type: "party",
        title: "Игрок вступил в пати",
        body: `${user.username} принял(а) приглашение.`,
        link: "/dashboard/party",
      }).catch(() => {});

      return NextResponse.json({ ok: true, ...(await loadState(user.id)) });
    }

    if (action === "decline") {
      const inviteId = Math.floor(Number(body.invite_id));
      const deleted = await query(
        "DELETE FROM party_invites WHERE id = $1 AND invitee_id = $2 RETURNING id",
        [inviteId, user.id]
      );
      if (!deleted.rows.length) {
        return NextResponse.json({ error: "Приглашение не найдено" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, ...(await loadState(user.id)) });
    }

    if (action === "leave") {
      const own = await membership(user.id);
      if (!own) {
        return NextResponse.json({ error: "Вы не в пати" }, { status: 404 });
      }

      await withTransaction(async (client) => {
        await client.query("DELETE FROM party_positions WHERE user_id = $1", [user.id]);
        await client.query(
          "DELETE FROM party_members WHERE party_id = $1 AND user_id = $2",
          [own.party_id, user.id]
        );

        const remaining = await client.query(
          `SELECT user_id FROM party_members
           WHERE party_id = $1
           ORDER BY joined_at ASC, user_id ASC
           LIMIT 1`,
          [own.party_id]
        );

        if (!remaining.rows.length) {
          await client.query("DELETE FROM parties WHERE id = $1", [own.party_id]);
          return;
        }

        if (own.leader_id === user.id) {
          await client.query("UPDATE parties SET leader_id = $1 WHERE id = $2", [
            remaining.rows[0].user_id,
            own.party_id,
          ]);
        }

        // Меняем ключ канала, чтобы вышедший участник не мог слушать позиции дальше.
        await client.query("UPDATE parties SET realtime_key = $1 WHERE id = $2", [
          newRealtimeKey(),
          own.party_id,
        ]);
      });

      return NextResponse.json({ ok: true, ...(await loadState(user.id)) });
    }

    if (action === "kick") {
      const targetId = Math.floor(Number(body.user_id));
      const own = await membership(user.id);
      if (!own) {
        return NextResponse.json({ error: "Вы не в пати" }, { status: 404 });
      }
      if (own.leader_id !== user.id) {
        return NextResponse.json({ error: "Исключать может только лидер" }, { status: 403 });
      }
      if (targetId === user.id) {
        return NextResponse.json(
          { error: "Чтобы выйти из пати, используйте «Покинуть»" },
          { status: 400 }
        );
      }

      const target = (await queryOne(
        "SELECT u.id, u.username FROM party_members pm JOIN users u ON u.id = pm.user_id WHERE pm.party_id = $1 AND pm.user_id = $2",
        [own.party_id, targetId]
      )) as { id: number; username: string } | null;
      if (!target) {
        return NextResponse.json({ error: "Игрок не в пати" }, { status: 404 });
      }

      await query(
        "DELETE FROM party_members WHERE party_id = $1 AND user_id = $2",
        [own.party_id, targetId]
      );
      await query("DELETE FROM party_positions WHERE user_id = $1", [targetId]);
      await query("UPDATE parties SET realtime_key = $1 WHERE id = $2", [
        newRealtimeKey(),
        own.party_id,
      ]);

      await notifyUser(targetId, {
        type: "party",
        title: "Вас исключили из пати",
        body: `${user.username} исключил(а) вас из пати.`,
        link: "/dashboard/party",
      }).catch(() => {});

      return NextResponse.json({ ok: true, ...(await loadState(user.id)) });
    }

    if (action === "disband") {
      const own = await membership(user.id);
      if (!own) {
        return NextResponse.json({ error: "Вы не в пати" }, { status: 404 });
      }
      if (own.leader_id !== user.id) {
        return NextResponse.json({ error: "Распустить пати может только лидер" }, { status: 403 });
      }

      await query("DELETE FROM parties WHERE id = $1", [own.party_id]);
      return NextResponse.json({ ok: true, ...(await loadState(user.id)) });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
