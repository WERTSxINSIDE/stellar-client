import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, queryAll, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const items = await queryAll(
      `SELECT id, type, title, body, link, read_at, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 30`,
      [user.id]
    );

    const row = (await queryOne(
      "SELECT COUNT(*)::int AS unread FROM notifications WHERE user_id = $1 AND read_at IS NULL",
      [user.id]
    )) as { unread: number } | null;

    return NextResponse.json({ ok: true, items, unread: row?.unread ?? 0 });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const { id, all } = await req.json();

    if (all) {
      await query("UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL", [
        user.id,
      ]);
      return NextResponse.json({ ok: true });
    }

    const notificationId = Number(id);
    if (!Number.isInteger(notificationId) || notificationId <= 0) {
      return NextResponse.json({ error: "Некорректное уведомление" }, { status: 400 });
    }

    await query(
      "UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2 AND read_at IS NULL",
      [notificationId, user.id]
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
