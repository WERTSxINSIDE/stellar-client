import type { DbExecutor } from "./db";

export type DiscountKind = "author" | "partner";

/** Ключ localStorage, в котором хранится последний партнёрский код из `?ref=`. */
export const REF_STORAGE_KEY = "stellar_ref";

export type DiscountCodeRow = {
  id: number;
  owner_id: number;
  kind: DiscountKind;
  code: string;
  discount_percent: number;
  max_uses: number;
  used_count: number;
  clicks: number;
  signups: number;
  sales_count: number;
  sales_amount: number;
  active: number;
  expires_at: string | null;
};

/** Приводит код к единому виду: верхний регистр, только A-Z, 0-9 и дефис. */
export function normalizeCode(value: unknown): string {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 24);
}

/** Итоговая цена после скидки кода. Не опускается ниже 1 ₽. */
export function applyCodeDiscount(price: number, percent: number): number {
  const base = Math.max(0, Math.floor(Number(price) || 0));
  const value = Math.max(0, Math.min(90, Math.floor(Number(percent) || 0)));
  if (base <= 0 || value <= 0) return base;
  return Math.max(1, Math.round((base * (100 - value)) / 100));
}

/** Проверяет, можно ли применить код к покупке. Возвращает текст ошибки или null. */
export function discountCodeError(
  row: DiscountCodeRow | null,
  buyerId: number,
  sellerId: number | null
): string | null {
  if (!row) return "Код не найден";
  if (!row.active) return "Код отключён";
  if (row.expires_at) {
    const date = new Date(row.expires_at);
    if (!Number.isNaN(date.getTime()) && date.getTime() <= Date.now()) {
      return "Срок действия кода истёк";
    }
  }
  if (Number(row.max_uses) > 0 && Number(row.used_count) >= Number(row.max_uses)) {
    return "Лимит использований кода исчерпан";
  }
  if (row.owner_id === buyerId) return "Нельзя использовать собственный код";
  if (row.kind === "author" && sellerId !== null && row.owner_id !== sellerId) {
    return "Код автора действует только на его конфиги";
  }
  return null;
}

/** Записывает использование кода и обновляет его статистику. */
export async function recordCodeUse(
  db: DbExecutor,
  codeId: number,
  buyerId: number,
  sellerId: number | null,
  itemId: number | null,
  amount: number,
  discount: number
): Promise<void> {
  await db.query(
    `UPDATE discount_codes
     SET used_count = COALESCE(used_count, 0) + 1,
         sales_count = COALESCE(sales_count, 0) + 1,
         sales_amount = COALESCE(sales_amount, 0) + $2
     WHERE id = $1`,
    [codeId, Math.max(0, Math.floor(amount))]
  );
  await db.query(
    `INSERT INTO discount_code_uses (code_id, user_id, seller_id, item_id, amount, discount)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [codeId, buyerId, sellerId, itemId, Math.max(0, Math.floor(amount)), Math.max(0, Math.floor(discount))]
  );
}
