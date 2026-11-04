import { query, queryOne } from "./db";

export type TelegramLink = {
  user_id: number;
  chat_id: string;
  username: string | null;
  linked_at: string;
  updated_at: string;
};

export async function getTelegramLink(userId: number): Promise<TelegramLink | null> {
  return (await queryOne(
    "SELECT user_id, chat_id, username, linked_at, updated_at FROM telegram_links WHERE user_id = $1",
    [userId]
  )) as TelegramLink | null;
}

export async function getTelegramLinkByChat(chatId: string): Promise<TelegramLink | null> {
  return (await queryOne(
    "SELECT user_id, chat_id, username, linked_at, updated_at FROM telegram_links WHERE chat_id = $1",
    [chatId]
  )) as TelegramLink | null;
}

export async function saveTelegramLink(
  userId: number,
  chatId: string,
  username: string | null
): Promise<void> {
  await query(
    `INSERT INTO telegram_links (user_id, chat_id, username, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET chat_id = EXCLUDED.chat_id,
                   username = EXCLUDED.username,
                   updated_at = NOW()`,
    [userId, chatId, username]
  );
}

export async function removeTelegramLink(userId: number): Promise<void> {
  await query("DELETE FROM telegram_links WHERE user_id = $1", [userId]);
}

export async function removeTelegramLinkByChat(chatId: string): Promise<void> {
  await query("DELETE FROM telegram_links WHERE chat_id = $1", [chatId]);
}
