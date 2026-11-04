/**
 * Косметика профиля: общие проверки значений.
 * Значение "rgb" — служебный маркер анимированного радужного эффекта.
 */
export const RGB_VALUE = "rgb";
export const COSMIC_BADGE = "🌈";

/** Это анимированный RGB-эффект, а не обычный цвет/градиент. */
export function isRgbValue(value: string | null | undefined): boolean {
  return String(value ?? "").trim().toLowerCase() === RGB_VALUE;
}

/** Обычный hex-цвет из косметики; всё остальное безопасно отбрасываем. */
export function safeHexColor(value: string | null | undefined): string | undefined {
  const raw = String(value ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(raw) ? raw : undefined;
}

/** Космический бейдж требует отдельного свечения. */
export function isCosmicBadge(value: string | null | undefined): boolean {
  return String(value ?? "").trim() === COSMIC_BADGE;
}
