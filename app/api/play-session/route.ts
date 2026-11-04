import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { logActivityOnce } from "@/lib/activity";
import { grantPlaytimeRewards } from "@/lib/playtime";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const username = String(body?.username || "").trim();
    const action = String(body?.action || "").trim();
    const sessionId = Number(body?.session_id);
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
      await logActivityOnce(user.id, "launch", "Запуск клиента", null, 10);
      return NextResponse.json({ ok: true, session_id: res.rows[0].id });
    }

    if (action === "end") {
      if (!Number.isInteger(sessionId) || sessionId <= 0) {
        return NextResponse.json({ error: "Нужен session_id" }, { status: 400 });
      }

      const res = await query(
        `UPDATE play_sessions
         SET ended_at = NOW(),
             seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::int
         WHERE id = $1 AND user_id = $2 AND ended_at IS NULL
         RETURNING seconds`,
        [sessionId, user.id]
      );
      if (!res.rows.length) {
        return NextResponse.json({
          ok: true,
          seconds: 0,
          rewards: { coins: 0, clan_xp: 0 },
        });
      }

      const seconds = Number(res.rows[0].seconds) || 0;
      let rewards = { coins: 0, clan_xp: 0 };
      try {
        const granted = await grantPlaytimeRewards(user.id, seconds);
        rewards = { coins: granted.coins, clan_xp: granted.clan_xp };
      } catch (error) {
        // Награда не должна мешать завершению сессии.
        console.error("playtime reward error:", error);
      }

      return NextResponse.json({ ok: true, seconds, rewards });
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
