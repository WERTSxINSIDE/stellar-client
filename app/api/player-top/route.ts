import { NextResponse } from "next/server";
import { queryAll } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const top = await queryAll(
      `SELECT u.username, COALESCE(SUM(ps.seconds), 0)::int as seconds, COUNT(ps.id)::int as launches
       FROM users u
       LEFT JOIN play_sessions ps ON ps.user_id = u.id
       GROUP BY u.id
       ORDER BY seconds DESC
       LIMIT 20`
    );

    return NextResponse.json({ ok: true, top });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
