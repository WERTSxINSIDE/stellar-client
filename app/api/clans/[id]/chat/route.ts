import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryAll, queryOne } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getMembership, logClanActivity } from "@/lib/clan-service";

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

    const rows = await queryAll(
      `SELECT cm.id, cm.body, cm.created_at, cm.user_id, u.username, u.avatar_url, u.nickname_color
       FROM clan_messages cm
       LEFT JOIN users u ON u.id = cm.user_id
       WHERE cm.clan_id = $1 AND cm.id > $2
       ORDER BY cm.id ASC
       LIMIT 100`,
      [clanId, Number.isInteger(after) && after > 0 ? after : 0]
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

    const created = (await queryOne(
      `INSERT INTO clan_messages (clan_id, user_id, body) VALUES ($1, $2, $3)
       RETURNING id, body, created_at, user_id`,
      [clanId, user.id, text]
    )) as { id: number; body: string; created_at: string; user_id: number } | null;

    await logClanActivity(clanId, user.id, "chat", 1);

    return NextResponse.json({
      ok: true,
      message: created ? { ...created, username: user.username } : null,
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
