import { getCurrentUser } from "./auth";
import { queryOne } from "./db";
import { verifyToken } from "./launch-token";

export type PartyUser = {
  id: number;
  username: string;
};

/**
 * Авторизация для запросов из игры/клиента.
 * Поддерживает обычную сессию сайта (cookie) и Bearer launch-токен,
 * который лаунчер получает через /api/launch-token.
 */
export async function getPartyUser(req: Request): Promise<PartyUser | null> {
  const sessionUser = await getCurrentUser();
  if (sessionUser) {
    if (sessionUser.banned) return null;
    return { id: sessionUser.id, username: sessionUser.username };
  }

  const header = req.headers.get("authorization") || "";
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : req.headers.get("x-stellar-token")?.trim() || "";

  if (!token) return null;

  const verified = verifyToken(token);
  if (!verified.valid || !verified.userId) return null;

  const row = (await queryOne(
    "SELECT id, username, banned FROM users WHERE id = $1",
    [verified.userId]
  )) as { id: number; username: string; banned: number | null } | null;

  if (!row || row.banned) return null;
  return { id: row.id, username: row.username };
}
