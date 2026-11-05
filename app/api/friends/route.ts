import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, queryAll, queryOne } from "@/lib/db";
import { notifyUser } from "@/lib/notify";
import { touchPresence } from "@/lib/presence";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const FRIEND_LIMIT = 100;

type FriendRow = {
  id: number;
  status: string;
  requester_id: number;
  addressee_id: number;
  created_at: string;
  friend_id: number;
  username: string;
  avatar_url: string | null;
  nickname_color: string | null;
  online: boolean;
  in_game: boolean;
};

function publicFriend(row: FriendRow) {
  return {
    id: row.id,
    friend_id: row.friend_id,
    username: row.username,
    avatar_url: row.avatar_url,
    nickname_color: row.nickname_color,
    online: Boolean(row.online) || Boolean(row.in_game),
    in_game: Boolean(row.in_game),
    since: row.created_at,
  };
}

async function listFriends(userId: number) {
  const rows = (await queryAll(
    `SELECT f.id, f.status, f.requester_id, f.addressee_id, f.created_at,
            u.id AS friend_id, u.username, u.avatar_url, u.nickname_color,
            (u.last_seen IS NOT NULL AND u.last_seen > NOW() - INTERVAL '5 minutes') AS online,
            EXISTS(
              SELECT 1 FROM play_sessions ps
              WHERE ps.user_id = u.id
                AND ps.ended_at IS NULL
                AND ps.started_at > NOW() - INTERVAL '12 hours'
            ) AS in_game
     FROM friendships f
     JOIN users u ON u.id = CASE
       WHEN f.requester_id = $1 THEN f.addressee_id
       ELSE f.requester_id
     END
     WHERE f.requester_id = $1 OR f.addressee_id = $1
     ORDER BY u.username ASC`,
    [userId]
  )) as FriendRow[];

  const friends = rows.filter((row) => row.status === "accepted").map(publicFriend);
  const incoming = rows
    .filter((row) => row.status === "pending" && row.addressee_id === userId)
    .map(publicFriend);
  const outgoing = rows
    .filter((row) => row.status === "pending" && row.requester_id === userId)
    .map(publicFriend);

  return { friends, incoming, outgoing };
}

async function findUser(username: string) {
  return (await queryOne(
    "SELECT id, username FROM users WHERE LOWER(username) = LOWER($1)",
    [username]
  )) as { id: number; username: string } | null;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    await touchPresence(user.id);
    const lists = await listFriends(user.id);

    return NextResponse.json({
      ok: true,
      ...lists,
      limit: FRIEND_LIMIT,
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const limited = await enforceRateLimit(req, [
      { scope: "friends:account", identifier: user.id, limit: 30, windowMs: 10 * 60_000 },
      { scope: "friends:ip", identifier: getClientIp(req), limit: 60, windowMs: 10 * 60_000 },
    ]);
    if (limited) return limited;

    const body = (await req.json().catch(() => ({}))) as {
      action?: unknown;
      username?: unknown;
    };
    const action = String(body.action || "");
    const username = String(body.username || "").trim();

    if (!["request", "accept", "decline", "remove"].includes(action)) {
      return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
    }
    if (!username) {
      return NextResponse.json({ error: "Укажите никнейм" }, { status: 400 });
    }

    const target = await findUser(username);
    if (!target) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }
    if (target.id === user.id) {
      return NextResponse.json({ error: "Нельзя добавить себя в друзья" }, { status: 400 });
    }

    if (action === "request") {
      const existing = (await queryOne(
        `SELECT id, requester_id, addressee_id, status
         FROM friendships
         WHERE (requester_id = $1 AND addressee_id = $2)
            OR (requester_id = $2 AND addressee_id = $1)`,
        [user.id, target.id]
      )) as
        | { id: number; requester_id: number; addressee_id: number; status: string }
        | null;

      if (existing?.status === "accepted") {
        return NextResponse.json({ error: "Вы уже друзья" }, { status: 409 });
      }

      if (existing && existing.requester_id === target.id && existing.status === "pending") {
        // Встречная заявка — сразу принимаем.
        await query(
          "UPDATE friendships SET status = 'accepted', updated_at = NOW() WHERE id = $1",
          [existing.id]
        );
        await notifyUser(target.id, {
          type: "friend",
          title: "Заявка в друзья принята",
          body: `${user.username} принял(а) вашу заявку в друзья.`,
          link: "/dashboard/friends",
        }).catch(() => {});
        return NextResponse.json({ ok: true, accepted: true });
      }

      if (existing) {
        return NextResponse.json({ error: "Заявка уже отправлена" }, { status: 409 });
      }

      const count = (await queryOne(
        "SELECT COUNT(*)::int AS n FROM friendships WHERE status = 'accepted' AND (requester_id = $1 OR addressee_id = $1)",
        [user.id]
      )) as { n: number } | null;
      if (Number(count?.n || 0) >= FRIEND_LIMIT) {
        return NextResponse.json(
          { error: `Максимум ${FRIEND_LIMIT} друзей` },
          { status: 400 }
        );
      }

      await query(
        `INSERT INTO friendships (requester_id, addressee_id, status)
         VALUES ($1, $2, 'pending')
         ON CONFLICT (requester_id, addressee_id) DO NOTHING`,
        [user.id, target.id]
      );

      await notifyUser(target.id, {
        type: "friend",
        title: "Новая заявка в друзья",
        body: `${user.username} хочет добавить вас в друзья.`,
        link: "/dashboard/friends",
      }).catch(() => {});

      return NextResponse.json({ ok: true });
    }

    if (action === "accept") {
      const updated = await query(
        `UPDATE friendships
         SET status = 'accepted', updated_at = NOW()
         WHERE addressee_id = $1
           AND requester_id = $2
           AND status = 'pending'
         RETURNING id`,
        [user.id, target.id]
      );
      if (!updated.rows.length) {
        return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
      }
      await notifyUser(target.id, {
        type: "friend",
        title: "Заявка в друзья принята",
        body: `${user.username} принял(а) вашу заявку в друзья.`,
        link: "/dashboard/friends",
      }).catch(() => {});
      return NextResponse.json({ ok: true });
    }

    if (action === "decline") {
      const deleted = await query(
        `DELETE FROM friendships
         WHERE status = 'pending'
           AND ((addressee_id = $1 AND requester_id = $2)
             OR (requester_id = $1 AND addressee_id = $2))
         RETURNING id`,
        [user.id, target.id]
      );
      if (!deleted.rows.length) {
        return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }

    // remove
    const deleted = await query(
      `DELETE FROM friendships
       WHERE (requester_id = $1 AND addressee_id = $2)
          OR (requester_id = $2 AND addressee_id = $1)
       RETURNING id`,
      [user.id, target.id]
    );
    if (!deleted.rows.length) {
      return NextResponse.json({ error: "Пользователь не в друзьях" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
