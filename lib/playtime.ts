import { withTransaction } from "./db";
import { grantCoins } from "./coins";
import { logClanActivity } from "./clan-service";

/**
 * Награды за игру.
 * Считаем только завершённые сессии: время берётся из play_sessions,
 * поэтому накрутить его запросами к API нельзя.
 */
export const PLAY_REWARDS = {
  /** Минимальная сессия, после которой вообще что-то начисляем. */
  minSessionSeconds: 10 * 60,
  /** Защита от «забытого» на сутки клиента. */
  maxSessionSeconds: 6 * 60 * 60,
  /** 1 SC за каждые 10 минут. */
  coinsPerBlock: 1,
  coinsBlockSeconds: 10 * 60,
  /** 2 XP клану за каждые 30 минут. */
  clanXpPerBlock: 2,
  clanXpBlockSeconds: 30 * 60,
  /** Дневные лимиты, чтобы игра не заменяла всю экономику. */
  dailyCoinCap: 30,
  dailyClanXpCap: 20,
} as const;

export type PlaytimeReward = {
  seconds: number;
  coins: number;
  clan_xp: number;
};

export function playtimeRewardFor(seconds: number) {
  const safe = Math.min(
    Math.max(0, Math.floor(Number(seconds) || 0)),
    PLAY_REWARDS.maxSessionSeconds
  );

  if (safe < PLAY_REWARDS.minSessionSeconds) {
    return { seconds: safe, coins: 0, clanXp: 0 };
  }

  const coins =
    Math.floor(safe / PLAY_REWARDS.coinsBlockSeconds) * PLAY_REWARDS.coinsPerBlock;
  const clanXp =
    Math.floor(safe / PLAY_REWARDS.clanXpBlockSeconds) * PLAY_REWARDS.clanXpPerBlock;

  return { seconds: safe, coins, clanXp };
}

/**
 * Начисляет SC и клановый XP за завершённую игровую сессию.
 * Дневные лимиты проверяются под advisory-lock, чтобы параллельные
 * запросы не выдали награду дважды.
 */
export async function grantPlaytimeRewards(
  userId: number,
  seconds: number
): Promise<PlaytimeReward> {
  const reward = playtimeRewardFor(seconds);
  if (reward.coins <= 0 && reward.clanXp <= 0) {
    return { seconds: reward.seconds, coins: 0, clan_xp: 0 };
  }

  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [userId]);

    let coins = 0;
    if (reward.coins > 0) {
      const spent = await client.query(
        `SELECT COALESCE(SUM(amount), 0)::int AS amount
         FROM coin_transactions
         WHERE user_id = $1 AND type = 'playtime' AND created_at >= CURRENT_DATE`,
        [userId]
      );
      const left = Math.max(
        0,
        PLAY_REWARDS.dailyCoinCap - Number(spent.rows[0]?.amount || 0)
      );
      coins = Math.min(reward.coins, left);
      if (coins > 0) {
        await grantCoins(
          userId,
          coins,
          "playtime",
          `Игра в клиенте — ${Math.floor(reward.seconds / 60)} мин`,
          client
        );
      }
    }

    let clanXp = 0;
    if (reward.clanXp > 0) {
      const membership = await client.query(
        "SELECT clan_id FROM clan_members WHERE user_id = $1",
        [userId]
      );
      const clanId = Number(membership.rows[0]?.clan_id);
      if (clanId) {
        const earned = await client.query(
          `SELECT COALESCE(SUM(points), 0)::int AS points
           FROM clan_activity
           WHERE user_id = $1 AND type = 'playtime' AND created_at >= CURRENT_DATE`,
          [userId]
        );
        const left = Math.max(
          0,
          PLAY_REWARDS.dailyClanXpCap - Number(earned.rows[0]?.points || 0)
        );
        clanXp = Math.min(reward.clanXp, left);
        if (clanXp > 0) {
          await logClanActivity(
            clanId,
            userId,
            "playtime",
            clanXp,
            `Игра в клиенте — ${Math.floor(reward.seconds / 60)} мин`,
            client
          );
        }
      }
    }

    return { seconds: reward.seconds, coins, clan_xp: clanXp };
  });
}
