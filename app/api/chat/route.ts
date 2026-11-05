import { NextResponse } from "next/server";
import { getCurrentUser, isSupportStaff, requireAdmin } from "@/lib/auth";
import { query, queryAll, queryOne } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { moderateMessage } from "@/lib/moderation";
import { touchPresence } from "@/lib/presence";

export const dynamic = "force-dynamic";

const CHANNELS = ["general", "trade"] as const;
type Channel = (typeof CHANNELS)[number];

function normalizeChannel(value: unknown): Channel {
  return value === "trade" ? "trade" : "general";
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (user) await touchPresence(user.id);
  } catch {
    // Presence не должен ломать чтение чата.
  }

  try {
    const rows = (await queryAll(
      `SELECT id, channel, body, created_at, user_id, username, avatar_url, nickname_color
       FROM (
         SELECT cm.id, cm.channel, cm.body, cm.created_at, cm.user_id,
                u.username, u.avatar_url, u.nickname_color,
                ROW_NUMBER() OVER (PARTITION BY cm.channel ORDER BY cm.id DESC) AS rn
         FROM chat_messages cm
         LEFT JOIN users u ON u.id = cm.user_id
       ) sub
       WHERE sub.rn <= 200
       ORDER BY sub.id ASC`
    )) as unknown[];

    return NextResponse.json({ ok: true, messages: rows });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    await touchPresence(user.id);

    const limited = await enforceRateLimit(
      req,
      [
        { scope: "chat:global", identifier: user.id, limit: 15, windowMs: 2 * 60 * 1000 },
      ],
      "Не так быстро: подождите пару минут перед следующим сообщением."
    );
    if (limited) return limited;

    const payload = (await req.json().catch(() => ({}))) as {
      body?: unknown;
      channel?: unknown;
      action?: unknown;
      id?: unknown;
    };

    if (String(payload.action || "") === "delete") {
      const admin = await requireAdmin();
      if (!admin) {
        return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
      }
      const id = Number(payload.id);
      if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ error: "Неверное сообщение" }, { status: 400 });
      }
      const deleted = await query(
        "DELETE FROM chat_messages WHERE id = $1 RETURNING id",
        [id]
      );
      if (!deleted.rows.length) {
        return NextResponse.json({ error: "Сообщение не найдено" }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }

    const channel = normalizeChannel(payload.channel);
    const text = String(payload.body || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 500);

    if (text.length < 1) {
      return NextResponse.json({ error: "Введите сообщение" }, { status: 400 });
    }

    const moderation = await moderateMessage({
      userId: user.id,
      username: user.username,
      text,
      channel: "global_chat",
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
      `INSERT INTO chat_messages (user_id, channel, body)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [user.id, channel, text]
    )) as { id: number } | null;

    const message = created
      ? await queryOne(
          `SELECT cm.id, cm.channel, cm.body, cm.created_at, cm.user_id,
                  u.username, u.avatar_url, u.nickname_color
           FROM chat_messages cm
           LEFT JOIN users u ON u.id = cm.user_id
           WHERE cm.id = $1`,
          [created.id]
        )
      : null;

    return NextResponse.json({ ok: true, message });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
