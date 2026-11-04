import { queryAll } from "./db";

/** Суммы пополнения баланса. */
export const TOPUP_AMOUNTS = [5, 10, 20, 50, 150, 200, 300, 400] as const;

export type TopupAmount = (typeof TOPUP_AMOUNTS)[number];

export function topupSettingKey(amount: number): string {
  return `topup_${amount}_url`;
}

/** Проверка ссылки на оплату. */
export function isSafePaymentUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return (url.protocol === "http:" || url.protocol === "https:") && !!url.hostname;
  } catch {
    return false;
  }
}

/**
 * Ссылки на оплату хранятся в app_settings и задаются в админке.
 * Если в базе пусто — используем переменные окружения FUNPAY_TOPUP_<сумма>.
 */
export async function getTopupLinks(): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  for (const amount of TOPUP_AMOUNTS) {
    const envValue = process.env[`FUNPAY_TOPUP_${amount}`];
    if (envValue && isSafePaymentUrl(envValue)) {
      result[topupSettingKey(amount)] = envValue.trim();
    }
  }

  try {
    const rows = (await queryAll(
      "SELECT key, value FROM app_settings WHERE key = ANY($1::text[])",
      [TOPUP_AMOUNTS.map((amount) => topupSettingKey(amount))]
    )) as { key: string; value: string | null }[];

    for (const row of rows) {
      if (row.value && isSafePaymentUrl(row.value)) {
        result[row.key] = row.value.trim();
      }
    }
  } catch {
    // Если таблицы ещё нет — отдаём ссылки из окружения.
  }

  return result;
}
