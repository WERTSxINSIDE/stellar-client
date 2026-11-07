import { NextResponse } from "next/server";
import { queryAll } from "@/lib/db";
import { getAchievementLeaderboard } from "@/lib/achievement-stats";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [top, achievements, coins] = await Promise.all([
      queryAll(
        `SELECT u.username, COALESCE(SUM(ps.seconds), 0)::int as seconds, COUNT(ps.id)::int as launches
         FROM users u
         LEFT JOIN play_sessions ps ON ps.user_id = u.id
         WHERE COALESCE(u.banned, 0) = 0
         GROUP BY u.id
         ORDER BY seconds DESC
         LIMIT 20`
      ),
      getAchievementLeaderboard(20),
      queryAll(
        `SELECT u.username, COALESCE(u.sc_coins, 0)::bigint as coins
         FROM users u
         WHERE COALESCE(u.banned, 0) = 0 AND COALESCE(u.sc_coins, 0) > 0
         ORDER BY coins DESC, u.username ASC
         LIMIT 20`
      ),
    ]);

    return NextResponse.json({
      ok: true,
      top,
      achievements,
      coins: coins.map((row: any) => ({
        username: row.username,
        coins: Number(row.coins || 0),
      })),
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
