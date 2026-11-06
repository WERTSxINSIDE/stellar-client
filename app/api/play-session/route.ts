import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { logActivityOnce } from "@/lib/activity";
import { grantPlaytimeRewards } from "@/lib/playtime";
import { verifyToken } from "@/lib/launch-token";

export const dynamic = "force-dynamic";

/**
 * Максимальный кусок времени, который засчитываем за один шаг.
 *
 * Клиент присылает heartbeat раз в 3 минуты, поэтому нормальный шаг — это
 * ~180 секунд. Ограничение защищает от «забытого» на сутки клиента и от
 * сессии, которая осталась открытой после краша: иначе при следующем запуске
 * в время игры засчитались бы часы простоя.
 */
const MAX_STEP_SECONDS = 5 * 60;

/**
 * Игровые сессии для ачивок за онлайн.
 *
 * Клиент открывает сессию (`start`) после успешной проверки лицензии,
 * продлевает её (`heartbeat`) раз в 3 минуты и закрывает (`end`) при выходе.
 * Лицензионный токен живёт 5 минут, поэтому `started_at` при каждом heartbeat
 * сдвигается вперёд — по нему же считается «онлайн» в ленте и у друзей.
 *
 * Время хранится в `seconds` и накапливается шагами, так что даже краш игры
 * не обнуляет уже наигранное. Награды (SC и клановый XP) выдаются при
 * закрытии сессии по её суммарному времени.
 */
async function resolveUserId(req: Request): Promise<number | null> {
  const header = req.headers.get("authorization") || "";
  const bearer = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : req.headers.get("x-stellar-token")?.trim() || "";

  if (bearer) {
    const verified = verifyToken(bearer);
    if (verified.valid && verified.userId) return verified.userId;
  }

  const sessionUser = await getCurrentUser();
  return sessionUser?.id ?? null;
}

async function findUser(userId: number) {
  return queryOne("SELECT id, banned FROM users WHERE id = $1", [userId]) as Promise<{
    id: number;
    banned: number | null;
  } | null>;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
    };
    const action = String(body?.action || "").trim();
    if (!["start", "heartbeat", "end"].includes(action)) {
      return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
    }

    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const user = await findUser(userId);
    if (!user) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }
    if (user.banned) {
      return NextResponse.json({ error: "Аккаунт заблокирован" }, { status: 403 });
    }

    if (action === "start") {
      // Закрываем сессию прошлого запуска, если игра закрылась крашем.
      await query(
        `UPDATE play_sessions
         SET seconds = COALESCE(seconds, 0)
                       + LEAST(GREATEST(EXTRACT(EPOCH FROM (NOW() - started_at))::int, 0), $2),
             ended_at = NOW()
         WHERE user_id = $1 AND ended_at IS NULL`,
        [userId, MAX_STEP_SECONDS]
      );

      const res = await query(
        "INSERT INTO play_sessions (user_id, started_at, seconds) VALUES ($1, NOW(), 0) RETURNING id",
        [userId]
      );
      await logActivityOnce(userId, "launch", "Запуск клиента", null, 10);
      return NextResponse.json({ ok: true, session_id: res.rows[0].id });
    }

    if (action === "heartbeat") {
      const res = await query(
        `UPDATE play_sessions
         SET seconds = COALESCE(seconds, 0)
                       + LEAST(GREATEST(EXTRACT(EPOCH FROM (NOW() - started_at))::int, 0), $2),
             started_at = NOW()
         WHERE id = (
           SELECT id FROM play_sessions
           WHERE user_id = $1 AND ended_at IS NULL
           ORDER BY started_at DESC
           LIMIT 1
         )
         RETURNING id, seconds`,
        [userId, MAX_STEP_SECONDS]
      );

      if (!res.rows.length) {
        // Сессию потеряли (например, чистили БД) — открываем новую.
        const inserted = await query(
          "INSERT INTO play_sessions (user_id, started_at, seconds) VALUES ($1, NOW(), 0) RETURNING id",
          [userId]
        );
        return NextResponse.json({
          ok: true,
          session_id: inserted.rows[0].id,
          seconds: 0,
        });
      }

      return NextResponse.json({
        ok: true,
        session_id: res.rows[0].id,
        seconds: Number(res.rows[0].seconds) || 0,
      });
    }

    // action === "end"
    const res = await query(
      `UPDATE play_sessions
       SET seconds = COALESCE(seconds, 0)
                     + LEAST(GREATEST(EXTRACT(EPOCH FROM (NOW() - started_at))::int, 0), $2),
           started_at = NOW(),
           ended_at = NOW()
       WHERE id = (
         SELECT id FROM play_sessions
         WHERE user_id = $1 AND ended_at IS NULL
         ORDER BY started_at DESC
         LIMIT 1
       )
       RETURNING id, seconds`,
      [userId, MAX_STEP_SECONDS]
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
      const granted = await grantPlaytimeRewards(userId, seconds);
      rewards = { coins: granted.coins, clan_xp: granted.clan_xp };
    } catch (error) {
      // Награда не должна мешать завершению сессии.
      console.error("playtime reward error:", error);
    }

    return NextResponse.json({ ok: true, seconds, rewards });
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
