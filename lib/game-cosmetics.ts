import { queryAll, queryOne } from "./db";

/** Слоты игровой косметики: у каждой категории своя колонка в users. */
export const GAME_SLOT_COLUMNS = {
  pet: "equipped_game_pet",
  wings: "equipped_game_wings",
  backpack: "equipped_game_backpack",
  model: "equipped_game_model",
  cape: "equipped_game_cape",
  hat: "equipped_game_hat",
  aura: "equipped_game_aura",
} as const;

export type GameSlot = keyof typeof GAME_SLOT_COLUMNS;

export type GameCosmeticItem = {
  key: string;
  title: string;
  preview: string | null;
  rarity: string;
};

/** Категория предмета по ключу: game_pet_cat → pet. */
export function gameSlotOf(key: string): GameSlot | null {
  const match = /^game_([a-z]+)_/.exec(key);
  const slot = match?.[1] as GameSlot | undefined;
  return slot && slot in GAME_SLOT_COLUMNS ? slot : null;
}

/**
 * Купленная и надетая косметика для Minecraft.
 * Возвращает предметы и карту слотов: { pet: "game_pet_cat", wings: null, ... }.
 */
export async function getGameCosmetics(userId: number) {
  const columns = Object.values(GAME_SLOT_COLUMNS);
  const values = (await queryOne(
    `SELECT ${columns.join(", ")} FROM users WHERE id = $1`,
    [userId]
  )) as Record<string, string | null> | null;

  const owned = (await queryAll(
    `SELECT ci.key, ci.title, ci.value AS preview, ci.rarity
     FROM user_cosmetics uc
     JOIN cosmetic_items ci ON ci.key = uc.cosmetic_key
     WHERE uc.user_id = $1 AND ci.type = 'game' AND ci.active = 1
     ORDER BY uc.acquired_at DESC`,
    [userId]
  )) as GameCosmeticItem[];

  const equipped = {} as Record<GameSlot, string | null>;
  for (const slot of Object.keys(GAME_SLOT_COLUMNS) as GameSlot[]) {
    const key = values?.[GAME_SLOT_COLUMNS[slot]] ?? null;
    equipped[slot] = key && owned.some((item) => item.key === key) ? key : null;
  }

  return { equipped, owned };
}
