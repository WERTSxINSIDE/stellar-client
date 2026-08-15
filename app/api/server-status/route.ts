import { NextResponse } from "next/server";
import { queryOne, queryAll } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Активные сессии за последние 5 минут
    const online = await queryOne(
      `SELECT COUNT(*)::int as count
       FROM play_sessions
       WHERE started_at > NOW() - INTERVAL '5 minutes' AND ended_at IS NULL`
    );

    // Всего запусков за сегодня
    const today = await queryOne(
      `SELECT COUNT(*)::int as count
       FROM play_sessions
       WHERE started_at > NOW() - INTERVAL '1 day'`
    );

    const onlineUsers = await queryAll(
      `SELECT u.username, ps.started_at
       FROM play_sessions ps
       JOIN users u ON ps.user_id = u.id
       WHERE ps.started_at > NOW() - INTERVAL '5 minutes' AND ps.ended_at IS NULL
       ORDER BY ps.started_at DESC`
    );

    return NextResponse.json({
      ok: true,
      online: online?.count || 0,
      launches_today: today?.count || 0,
      users: onlineUsers,
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
