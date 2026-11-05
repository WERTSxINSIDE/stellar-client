import { query, type DbExecutor } from "./db";

/**
 * Сезонный батл-пасс.
 *
 * Сезон = календарный месяц (UTC). XP начисляется за ежедневные квесты,
 * ежедневную награду и игру в клиенте. Уровни открываются накопленным XP.
 * Бесплатная ветка доступна всем, премиальная — после покупки за SC.
 */
export const BATTLE_PASS = {
  maxLevel: 20,
  xpPerLevel: 100,
  premiumPrice: 1200,
  xp: {
    quest: 20,
    dailyReward: 30,
  },
} as const;

const MONTHS_RU = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export type BattlePassSeason = {
  id: string;
  title_ru: string;
  title_en: string;
  starts_at: string;
  ends_at: string;
};

export function currentSeason(now = new Date()): BattlePassSeason {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return {
    id: `${year}-${String(month + 1).padStart(2, "0")}`,
    title_ru: `Сезон · ${MONTHS_RU[month]} ${year}`,
    title_en: `${MONTHS_EN[month]} ${year} season`,
    starts_at: new Date(Date.UTC(year, month, 1)).toISOString(),
    ends_at: new Date(Date.UTC(year, month + 1, 1)).toISOString(),
  };
}

export type BattlePassReward =
  | { kind: "coins"; amount: number }
  | { kind: "cosmetic"; key: string; title: string; icon: string | null };

export type BattlePassLevel = {
  level: number;
  xp: number;
  free: BattlePassReward;
  premium: BattlePassReward;
};

/** Эксклюзивные премиальные награды на контрольных уровнях. */
const PREMIUM_COSMETICS: Record<number, string> = {
  4: "badge_comet",
  8: "frame_toxic",
  12: "badge_galaxy",
  16: "theme_nebula",
  20: "badge_cosmic",
};

export const PREMIUM_COSMETIC_KEYS = Object.values(PREMIUM_COSMETICS);

function cosmeticReward(key: string): BattlePassReward {
  return { kind: "cosmetic", key, title: key, icon: null };
}

/** Полный список уровней сезона (одинаковый для всех сезонов). */
export function battlePassLevels(): BattlePassLevel[] {
  return Array.from({ length: BATTLE_PASS.maxLevel }, (_, index) => {
    const level = index + 1;
    const cosmeticKey = PREMIUM_COSMETICS[level];
    return {
      level,
      xp: (level - 1) * BATTLE_PASS.xpPerLevel,
      free: { kind: "coins", amount: 20 + level * 5 },
      premium: cosmeticKey
        ? cosmeticReward(cosmeticKey)
        : { kind: "coins", amount: 40 + level * 10 },
    };
  });
}

export function levelForXp(xp: number): number {
  const safe = Math.max(0, Math.floor(Number(xp) || 0));
  return Math.min(
    BATTLE_PASS.maxLevel,
    Math.floor(safe / BATTLE_PASS.xpPerLevel) + 1
  );
}

export function xpToNextLevel(xp: number): number {
  const level = levelForXp(xp);
  if (level >= BATTLE_PASS.maxLevel) return 0;
  return level * BATTLE_PASS.xpPerLevel - Math.max(0, Math.floor(xp || 0));
}

/**
 * Начисляет XP батл-пасса. При смене сезона прогресс начинается заново.
 * Можно передать транзакцию, чтобы XP начислялся вместе с наградой.
 */
export async function addBattlePassXp(
  userId: number,
  amount: number,
  db?: DbExecutor
) {
  const value = Math.floor(Number(amount) || 0);
  if (value <= 0) return;

  const season = currentSeason().id;
  const text = `INSERT INTO battle_pass_progress (user_id, season, xp)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET
       xp = CASE
         WHEN battle_pass_progress.season = $2 THEN battle_pass_progress.xp + $3
         ELSE $3
       END,
       season = $2,
       updated_at = NOW()`;

  if (db) {
    await db.query(text, [userId, season, value]);
    return;
  }

  await query(text, [userId, season, value]);
}
