import { query, queryOne } from "./db";

export type ActivityType =
  | "key"
  | "launch"
  | "achievement"
  | "showcase"
  | "review"
  | "purchase";

/**
 * Публичное событие для live-ленты.
 * Ошибка записи не должна ломать основное действие (активацию, запуск и т.п.).
 */
export async function logActivity(
  userId: number | null,
  type: ActivityType,
  title: string,
  details?: string | null,
  isPublic = true
): Promise<void> {
  try {
    await query(
      `INSERT INTO activity_events (user_id, type, title, details, is_public)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, type, title.slice(0, 200), details ? details.slice(0, 500) : null, isPublic ? 1 : 0]
    );
  } catch (e: any) {
    console.error("activity log error:", e?.message || e);
  }
}

/**
 * Не пишет одно и то же событие слишком часто.
 * Нужно для запусков клиента, чтобы лента не превращалась в спам.
 */
export async function logActivityOnce(
  userId: number,
  type: ActivityType,
  title: string,
  details: string | null,
  withinMinutes: number
): Promise<void> {
  try {
    const recent = await queryOne(
      `SELECT id FROM activity_events
       WHERE user_id = $1 AND type = $2
         AND created_at > NOW() - ($3::int * INTERVAL '1 minute')
       LIMIT 1`,
      [userId, type, Math.max(1, Math.floor(withinMinutes))]
    );
    if (recent) return;
  } catch {
    // если проверка не удалась — просто пишем событие
  }
  await logActivity(userId, type, title, details);
}
