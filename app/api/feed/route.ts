import { NextResponse } from "next/server";
import { queryAll, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Публичная live-лента: активации ключей, запуски клиента,
 * достижения, отзывы и принятые материалы.
 */
export async function GET() {
  try {
    const [events, online, today] = await Promise.all([
      queryAll(
        `SELECT a.id, a.type, a.title, a.details, a.created_at,
                u.username, u.avatar_url
         FROM activity_events a
         LEFT JOIN users u ON u.id = a.user_id
         WHERE a.is_public = 1
           AND (u.id IS NULL OR COALESCE(u.banned, 0) = 0)
         ORDER BY a.created_at DESC
         LIMIT 40`
      ),
      queryOne(
        `SELECT COUNT(*)::int AS count
         FROM play_sessions
         WHERE started_at > NOW() - INTERVAL '5 minutes' AND ended_at IS NULL`
      ),
      queryOne(
        `SELECT COUNT(*)::int AS count
         FROM play_sessions
         WHERE started_at > NOW() - INTERVAL '1 day'`
      ),
    ]);

    return NextResponse.json(
      {
        ok: true,
        events,
        online: (online as { count?: number } | null)?.count || 0,
        launches_today: (today as { count?: number } | null)?.count || 0,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
