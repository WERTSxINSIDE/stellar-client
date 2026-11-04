import { query } from "./db";

type AdminLike = { id: number; username: string };

/**
 * Пишет действие администратора в журнал.
 * Ошибка логирования не должна ломать основную операцию.
 */
export async function logAdminAction(
  admin: AdminLike,
  action: string,
  target?: { id?: number | null; username?: string | null } | null,
  details?: string | null
) {
  try {
    await query(
      `INSERT INTO admin_actions (admin_id, admin_username, action, target_user_id, target_username, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        admin.id,
        admin.username,
        action,
        target?.id ?? null,
        target?.username ?? null,
        details ?? null,
      ]
    );
  } catch (e) {
    console.error("Admin log error:", e);
  }
}

export async function findUserForLog(userId: number) {
  const result = await query("SELECT id, username FROM users WHERE id = $1", [userId]);
  return (result.rows[0] as { id: number; username: string } | undefined) ?? null;
}
