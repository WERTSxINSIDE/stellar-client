import { query } from "./db";

export type ShowcaseType = "config" | "video";

export const SHOWCASE_TYPES: ShowcaseType[] = ["config", "video"];

/** Награда на баланс за принятый материал (можно изменить в админке). */
export const SHOWCASE_DEFAULT_REWARD: Record<ShowcaseType, number> = {
  config: 75,
  video: 150,
};

/** Максимальная цена платного конфига. */
export const SHOWCASE_MAX_PRICE = 10000;

/** Минимальная цена, если конфиг платный (0 = бесплатно). */
export const SHOWCASE_MIN_PAID_PRICE = 10;

/**
 * Доля продавца от цены. 1 = 100% уходит автору.
 * Если понадобится комиссия площадки — уменьшите значение.
 */
export const SHOWCASE_SELLER_SHARE = 1;

/** Сколько получит автор с продажи. */
export function sellerPayout(price: number): number {
  return Math.max(0, Math.floor(Number(price) * SHOWCASE_SELLER_SHARE));
}

/** Проверяет и нормализует цену. Возвращает null, если цена неверная. */
export function normalizePrice(value: unknown): number | null {
  if (value === undefined || value === null || String(value).trim() === "") return 0;
  const price = Number(value);
  if (!Number.isInteger(price) || price < 0 || price > SHOWCASE_MAX_PRICE) return null;
  if (price > 0 && price < SHOWCASE_MIN_PAID_PRICE) return null;
  return price;
}

/** Игры, для которых можно публиковать материалы. */
export const SHOWCASE_GAMES = [
  "minecraft",
  "cs2",
  "gta5",
  "rust",
  "roblox",
  "other",
] as const;

export type ShowcaseGame = (typeof SHOWCASE_GAMES)[number];

export function isShowcaseGame(value: unknown): value is ShowcaseGame {
  return SHOWCASE_GAMES.includes(value as ShowcaseGame);
}

/** Нормализует игру. Пустая/неизвестная игра превращается в null. */
export function normalizeGame(value: unknown): ShowcaseGame | null {
  const game = String(value || "").trim().toLowerCase();
  return isShowcaseGame(game) ? game : null;
}

/** Максимальная длина строки версии. */
export const SHOWCASE_MAX_VERSION_LENGTH = 24;

/** Нормализует версию конфига: " v1.2 " -> "v1.2", пусто -> "1.0". */
export function normalizeVersion(value: unknown): string {
  const version = String(value || "")
    .trim()
    .replace(/[^\w.\-+ ]/g, "")
    .slice(0, SHOWCASE_MAX_VERSION_LENGTH)
    .trim();
  return version || "1.0";
}

/** Максимальная скидка на материал/набор, %. */
export const SHOWCASE_MAX_DISCOUNT = 90;

/** Нормализует скидку: целое число 0..90, всё остальное -> 0. */
export function normalizeDiscount(value: unknown): number {
  if (value === undefined || value === null || String(value).trim() === "") return 0;
  const percent = Number(value);
  if (!Number.isFinite(percent)) return 0;
  return Math.max(0, Math.min(SHOWCASE_MAX_DISCOUNT, Math.floor(percent)));
}

/** Нормализует дату окончания скидки. null = бессрочно/без скидки. */
export function normalizeDiscountUntil(value: unknown): string | null {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/** Действует ли скидка прямо сейчас. */
export function discountActive(
  percent: unknown,
  until: unknown
): boolean {
  const value = Number(percent || 0);
  if (!Number.isFinite(value) || value <= 0) return false;
  if (!until) return true;
  const date = new Date(String(until));
  if (Number.isNaN(date.getTime())) return true;
  return date.getTime() > Date.now();
}

/** Итоговая цена с учётом действующей скидки. */
export function discountedPrice(
  price: unknown,
  percent: unknown,
  until: unknown
): number {
  const base = Math.max(0, Math.floor(Number(price) || 0));
  if (base <= 0) return 0;
  if (!discountActive(percent, until)) return base;
  const value = Math.max(0, Math.min(SHOWCASE_MAX_DISCOUNT, Math.floor(Number(percent) || 0)));
  if (value <= 0) return base;
  return Math.max(1, Math.round((base * (100 - value)) / 100));
}

/** Максимальный размер файла конфига до base64. */
export const SHOWCASE_MAX_FILE_BYTES = 1_500_000;

/** Максимум тегов на материал и длина одного тега. */
export const SHOWCASE_MAX_TAGS = 5;
export const SHOWCASE_MAX_TAG_LENGTH = 24;

export type ShowcaseSort = "new" | "rating" | "popular" | "price_asc" | "price_desc";

export function normalizeSort(value: unknown): ShowcaseSort {
  const sort = String(value || "");
  if (sort === "rating" || sort === "popular" || sort === "price_asc" || sort === "price_desc") {
    return sort;
  }
  return "new";
}

/** Чистит теги: нижний регистр, без # и лишних символов, максимум 5 штук. */
export function normalizeTags(value: unknown): string[] {
  const input = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  const tags: string[] = [];
  for (const entry of input) {
    const tag = String(entry)
      .trim()
      .toLowerCase()
      .replace(/^#+/, "")
      .replace(/\s+/g, " ")
      .replace(/[^\p{L}\p{N}\- ]/gu, "")
      .slice(0, SHOWCASE_MAX_TAG_LENGTH)
      .trim();

    if (tag.length < 2 || tags.includes(tag)) continue;
    tags.push(tag);
    if (tags.length >= SHOWCASE_MAX_TAGS) break;
  }
  return tags;
}

/** Расширения, которые принимаем как конфиг. */
export const SHOWCASE_ALLOWED_EXT = [
  ".cfg",
  ".txt",
  ".json",
  ".ini",
  ".toml",
  ".yml",
  ".yaml",
  ".zip",
];

export function isShowcaseType(value: unknown): value is ShowcaseType {
  return value === "config" || value === "video";
}

export function isAllowedFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return SHOWCASE_ALLOWED_EXT.some((ext) => lower.endsWith(ext));
}

/** Простая проверка ссылки на видео: только http(s) и не пустой хост. */
export function isSafeUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return (url.protocol === "http:" || url.protocol === "https:") && !!url.hostname;
  } catch {
    return false;
  }
}

/** Убираем пути и опасные символы из имени файла. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() || "config";
  return base.replace(/[^\w.\-() ]+/g, "_").slice(0, 120) || "config";
}

export function contentTypeForFile(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".yml") || lower.endsWith(".yaml")) return "text/yaml";
  if (lower.endsWith(".toml")) return "text/plain";
  return "text/plain; charset=utf-8";
}

/**
 * Пересчитывает рейтинг материала и возвращает актуальные значения.
 * Используется после выставления оценки.
 */
export async function getItemRating(itemId: number) {
  const row = (await query(
    `SELECT COALESCE(AVG(rating), 0)::float AS avg, COUNT(*)::int AS count
     FROM showcase_ratings WHERE item_id = $1`,
    [itemId]
  )).rows[0] as { avg: number; count: number } | undefined;

  return {
    avg: Number(row?.avg || 0),
    count: Number(row?.count || 0),
  };
}
