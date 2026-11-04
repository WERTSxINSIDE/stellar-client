import { NextResponse } from "next/server";
import { getCurrentUser, isSupportStaff } from "@/lib/auth";
import { query, queryAll, queryOne } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getMembership } from "@/lib/clan-service";
import { moderateMessage } from "@/lib/moderation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const { id } = await params;
    const clanId = Number(id);
    const membership = await getMembership(user.id);
    if (!membership || membership.clan_id !== clanId) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }

    const url = new URL(req.url);
    const after = Number(url.searchParams.get("after") || 0);

    // after > 0 — только новые сообщения для polling.
    // after = 0 — последние 100 сообщений, всегда по возрастанию id.
    const rows =
      Number.isInteger(after) && after > 0
        ? await queryAll(
            `SELECT cm.id, cm.body, cm.created_at, cm.user_id, u.username, u.avatar_url, u.nickname_color
             FROM clan_messages cm
             LEFT JOIN users u ON u.id = cm.user_id
             WHERE cm.clan_id = $1 AND cm.id > $2
             ORDER BY cm.id ASC
             LIMIT 100`,
            [clanId, after]
          )
        : await queryAll(
            `SELECT * FROM (
               SELECT cm.id, cm.body, cm.created_at, cm.user_id, u.username, u.avatar_url, u.nickname_color
               FROM clan_messages cm
               LEFT JOIN users u ON u.id = cm.user_id
               WHERE cm.clan_id = $1
               ORDER BY cm.id DESC
               LIMIT 100
             ) sub
             ORDER BY sub.id ASC`,
            [clanId]
          );

    return NextResponse.json({ ok: true, messages: rows });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const { id } = await params;
    const clanId = Number(id);
    const membership = await getMembership(user.id);
    if (!membership || membership.clan_id !== clanId) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }

    const limited = await enforceRateLimit(
      req,
      [{ scope: "clans:chat", identifier: user.id, limit: 15, windowMs: 2 * 60 * 1000 }],
      "Не так быстро: подождите пару минут перед следующим сообщением."
    );
    if (limited) return limited;

    const body = await req.json().catch(() => ({}));
    const text = String(body?.body || "").replace(/\s+/g, " ").trim().slice(0, 500);
    if (text.length < 1) {
      return NextResponse.json({ error: "Введите сообщение" }, { status: 400 });
    }

    const moderation = await moderateMessage({
      userId: user.id,
      username: user.username,
      text,
      channel: "clan_chat",
      staff: isSupportStaff(user),
    });
    if (moderation) {
      return NextResponse.json(
        {
          ok: false,
          error: moderation.message,
          moderation: {
            kind: moderation.kind,
            strikes: moderation.strikes,
            remaining: moderation.remaining,
            banned: moderation.banned,
            staff: moderation.staff,
          },
        },
        { status: 403 }
      );
    }

    const created = (await queryOne(
      `INSERT INTO clan_messages (clan_id, user_id, body) VALUES ($1, $2, $3)
       RETURNING id`,
      [clanId, user.id, text]
    )) as { id: number } | null;

    const message = created
      ? await queryOne(
          `SELECT cm.id, cm.body, cm.created_at, cm.user_id, u.username, u.avatar_url, u.nickname_color
           FROM clan_messages cm
           LEFT JOIN users u ON u.id = cm.user_id
           WHERE cm.id = $1`,
          [created.id]
        )
      : null;

    // Сообщения не дают XP: иначе чат превращается в бесконечный фарм.
    await query(
      "UPDATE clan_members SET last_active_at = NOW() WHERE user_id = $1 AND clan_id = $2",
      [user.id, clanId]
    );

    return NextResponse.json({ ok: true, message });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
