/** Одноразовый бонус пригласившему за регистрацию по реферальной ссылке. */
export const REFERRAL_SIGNUP_BONUS = 10;

/** Доля от стоимости активированного ключа, которую получает пригласивший. */
export const REFERRAL_KEY_PERCENT = 0.15;

/** Каждые N успешных приглашений дают пригласившему бонус. */
export const REFERRAL_MILESTONE_STEP = 5;

/** Размер бонуса за достижение очередной ступени приглашений. */
export const REFERRAL_MILESTONE_BONUS = 30;

/**
 * Цена ключа по длительности — используется, если у ключа не задана цена.
 * Соответствует ценам на /pricing.
 */
export function defaultKeyPrice(durationDays: number): number {
  if (durationDays >= 99999) return 300; // навсегда
  if (durationDays >= 180) return 400;
  if (durationDays >= 90) return 250;
  if (durationDays >= 30) return 130;
  return 0;
}

export function keyPrice(durationDays: number, price?: number | string | null): number {
  const parsed = Number(price);
  if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
  return defaultKeyPrice(durationDays);
}

export function referralKeyBonus(price: number): number {
  return Math.max(0, Math.round(price * REFERRAL_KEY_PERCENT));
}
