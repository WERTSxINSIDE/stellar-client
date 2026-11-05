import { query } from "./db";

/** Сколько минут после последней активности считаем пользователя онлайн. */
export const ONLINE_WINDOW_MINUTES = 5;

/**
 * Обновляет время последней активности.
 * Пишем не чаще раза в минуту, чтобы не нагружать БД на каждом запросе.
 */
export async function touchPresence(userId: number) {
  try {
    await query(
      `UPDATE users SET last_seen = NOW()
       WHERE id = $1
         AND (last_seen IS NULL OR last_seen < NOW() - INTERVAL '1 minute')`,
      [userId]
    );
  } catch {
    // Присутствие не должно ломать основной запрос.
  }
}
