import { query, queryOne, withTransaction, type DbExecutor } from "./db";

/** Начисляет SC-монеты и пишет операцию в историю. */
export async function grantCoins(
  userId: number,
  amount: number,
  type: string,
  note?: string,
  db?: DbExecutor
): Promise<number> {
  const value = Math.max(0, Math.floor(Number(amount) || 0));
  if (value <= 0) {
    const row = await queryOne("SELECT COALESCE(sc_coins, 0)::int AS coins FROM users WHERE id = $1", [userId]);
    return Number(row?.coins || 0);
  }

  if (db) {
    const updated = await db.query(
      "UPDATE users SET sc_coins = COALESCE(sc_coins, 0) + $2 WHERE id = $1 RETURNING COALESCE(sc_coins, 0)::int AS coins",
      [userId, value]
    );
    await db.query(
      "INSERT INTO coin_transactions (user_id, amount, type, note) VALUES ($1, $2, $3, $4)",
      [userId, value, type, note || null]
    );
    return Number(updated.rows[0]?.coins || 0);
  }

  return withTransaction(async (client) => {
    const updated = await client.query(
      "UPDATE users SET sc_coins = COALESCE(sc_coins, 0) + $2 WHERE id = $1 RETURNING COALESCE(sc_coins, 0)::int AS coins",
      [userId, value]
    );
    await client.query(
      "INSERT INTO coin_transactions (user_id, amount, type, note) VALUES ($1, $2, $3, $4)",
      [userId, value, type, note || null]
    );
    return Number(updated.rows[0]?.coins || 0);
  });
}

/** Списывает SC-монеты. Возвращает новый баланс или null, если средств не хватило. */
export async function spendCoins(
  userId: number,
  amount: number,
  type: string,
  note?: string
): Promise<number | null> {
  const value = Math.max(0, Math.floor(Number(amount) || 0));
  if (value <= 0) return null;

  return withTransaction(async (client) => {
    const updated = await client.query(
      `UPDATE users
       SET sc_coins = COALESCE(sc_coins, 0) - $2
       WHERE id = $1 AND COALESCE(sc_coins, 0) >= $2
       RETURNING COALESCE(sc_coins, 0)::int AS coins`,
      [userId, value]
    );
    if (!updated.rows.length) return null;

    await client.query(
      "INSERT INTO coin_transactions (user_id, amount, type, note) VALUES ($1, $2, $3, $4)",
      [userId, -value, type, note || null]
    );
    return Number(updated.rows[0].coins);
  });
}

/** Сколько SC-монет начислять за покупку: 1 монета за каждые 10 ₽. */
export function coinsForPurchase(price: number): number {
  return Math.max(0, Math.floor((Number(price) || 0) / 10));
}
