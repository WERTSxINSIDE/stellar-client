export const SUPPORT_CATEGORIES = [
  { id: "account", label: "Аккаунт и вход", labelEn: "Account & sign-in" },
  { id: "payment", label: "Оплата и баланс", labelEn: "Payment & balance" },
  { id: "launcher", label: "Лаунчер и запуск", labelEn: "Launcher & startup" },
  { id: "configs", label: "Конфиги и витрина", labelEn: "Configs & showcase" },
  { id: "other", label: "Другое", labelEn: "Other" },
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]["id"];

export const SUPPORT_CATEGORY_IDS = SUPPORT_CATEGORIES.map((entry) => entry.id);

export function normalizeSupportCategory(value: unknown): SupportCategory {
  return SUPPORT_CATEGORY_IDS.includes(String(value) as SupportCategory)
    ? (String(value) as SupportCategory)
    : "other";
}

export function supportCategoryLabel(
  value: unknown,
  lang: "ru" | "en" = "ru"
): string {
  const id = normalizeSupportCategory(value);
  const entry = SUPPORT_CATEGORIES.find((item) => item.id === id);
  if (!entry) return lang === "en" ? "Other" : "Другое";
  return lang === "en" ? entry.labelEn : entry.label;
}

/** Разрешённые типы вложений в поддержке. */
export const SUPPORT_ATTACHMENT_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/vnd.rar",
  "application/x-7z-compressed",
];

export const SUPPORT_ATTACHMENT_EXT = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".pdf",
  ".txt",
  ".log",
  ".zip",
  ".rar",
  ".7z",
];

/** Максимальный размер base64-строки вложения. */
export const SUPPORT_ATTACHMENT_DATA_MAX = 2_500_000;

export function isAllowedAttachmentName(name: string): boolean {
  const lower = name.toLowerCase();
  return SUPPORT_ATTACHMENT_EXT.some((ext) => lower.endsWith(ext));
}

/** Картинки показываем превью, остальные файлы — ссылкой на скачивание. */
export function isImageAttachment(url: string | null | undefined): boolean {
  if (!url) return false;
  if (/^data:image\/(jpeg|png|webp|gif);base64,/i.test(url)) return true;
  return /\.(jpe?g|png|webp|gif)(\?.*)?$/i.test(url);
}
