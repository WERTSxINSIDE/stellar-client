import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { username, action } = await req.json();
    if (!username || !action) {
      return NextResponse.json({ error: "Нужен username и action" }, { status: 400 });
    }

    const user = await queryOne("SELECT id FROM users WHERE LOWER(username) = LOWER($1)", [username]);
    if (!user) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    if (action === "start") {
      const res = await query(
        "INSERT INTO play_sessions (user_id, started_at) VALUES ($1, NOW()) RETURNING id",
        [user.id]
      );
      return NextResponse.json({ ok: true, session_id: res.rows[0].id });
    }

    if (action === "end") {
      const { session_id } = await req.json();
      if (!session_id) return NextResponse.json({ error: "Нужен session_id" }, { status: 400 });

      const res = await query(
        `UPDATE play_sessions
         SET ended_at = NOW(),
             seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::int
         WHERE id = $1 AND user_id = $2 AND ended_at IS NULL
         RETURNING seconds`,
        [session_id, user.id]
      );
      if (!res.rows.length) return NextResponse.json({ ok: true, seconds: 0 });
      return NextResponse.json({ ok: true, seconds: res.rows[0].seconds });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const total = await queryOne(
      "SELECT COALESCE(SUM(seconds), 0)::int as seconds, COUNT(*)::int as launches FROM play_sessions WHERE user_id = $1",
      [user.id]
    );

    return NextResponse.json({
      ok: true,
      stats: { seconds: total?.seconds || 0, launches: total?.launches || 0 },
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
