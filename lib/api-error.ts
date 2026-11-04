import type { Lang } from "./i18n";

/**
 * Перевод сообщений об ошибках, которые приходят из API.
 * Сервер отдаёт тексты на русском, поэтому в EN-интерфейсе их нужно
 * переводить на клиенте, иначе пользователь видит русскую строку.
 */
const EXACT: Record<string, string> = {
  "Не авторизован": "Not authorized",
  "Ошибка сервера": "Server error",
  "Доступ запрещён": "Access denied",
  "Неверный пароль": "Wrong password",
  "Неверное действие": "Invalid action",
  "Неизвестное действие": "Unknown action",
  "Пользователь не найден": "User not found",
  "Некорректная сессия": "Invalid session",
  "Нельзя завершить текущую сессию": "You cannot end the current session",
  "Некорректное уведомление": "Invalid notification",

  "Введите корректный промокод": "Enter a valid promo code",
  "Промокод не найден": "Promo code not found",
  "Промокод больше не действует": "This promo code is no longer valid",
  "Срок действия промокода истёк": "This promo code has expired",
  "Лимит активаций промокода исчерпан": "This promo code has reached its activation limit",
  "Вы уже активировали этот промокод": "You have already activated this promo code",

  "Укажите получателя и сумму": "Enter a recipient and an amount",
  "Минимум 1₽": "The minimum is 1 ₽",
  "Нельзя переводить себе": "You cannot transfer money to yourself",
  "Недостаточно баланса": "Insufficient balance",

  "Укажите получателя и срок": "Choose a recipient and a duration",
  "Нельзя подарить себе": "You cannot gift a subscription to yourself",
  "У вас нет активной подписки": "You don't have an active subscription",
  "С подаренной подписки нельзя дарить": "A gifted subscription cannot be gifted further",
  "Недостаточно дней подписки": "Not enough subscription days",

  "Заполните все поля": "Fill in all fields",
  "Неверная частота": "Invalid frequency",
  "Неверные данные": "Invalid data",

  "Все награды уже получены": "All rewards have already been claimed",
  "Награда за сегодня уже получена": "Today's reward has already been claimed",
  "Награда не найдена": "Reward not found",

  "Только для медиа": "Available to media partners only",
  "Введите ссылку на видео": "Enter a video link",

  "Нет изменений": "No changes",
  "Био должно быть текстом": "Bio must be text",
  "Ссылка на аватар должна быть текстом": "Avatar link must be text",
  "Ссылка на баннер должна быть текстом": "Banner link must be text",
  "Цвет акцента должен быть текстом": "Accent color must be text",
  "Цвет акцента в формате #RRGGBB": "Accent color must be in #RRGGBB format",

  "Отправка кодов на почту временно недоступна": "Email codes are temporarily unavailable",
  "Слишком много запросов. Попробуйте позже.": "Too many requests. Try again later.",
  "Не удалось отправить письмо. Попробуйте позже.":
    "Could not send the email. Try again later.",
  "Код не запрашивался. Запросите новый.": "No code was requested. Request a new one.",
  "Код истёк. Запросите новый.": "The code has expired. Request a new one.",
  "Слишком много неверных попыток. Запросите новый код.":
    "Too many wrong attempts. Request a new code.",
  "Введите код из письма": "Enter the code from the email",
  "Запросите код заново": "Request a new code",
  "Пароль должен быть не меньше 6 символов": "Password must be at least 6 characters",
  "Пароль минимум 6 символов": "Password must be at least 6 characters",
  "Введите ключ": "Enter a key",
  "Ключ не найден": "Key not found",
  "Ключ уже был использован": "This key has already been used",
};

const PATTERNS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [
    /^Код можно запросить повторно через (\d+) сек\.$/,
    (m) => `You can request a new code in ${m[1]}s.`,
  ],
  [
    /^Неверный код\. Осталось попыток: (\d+)$/,
    (m) => `Invalid code. Attempts left: ${m[1]}.`,
  ],
  [
    /^Следующая бесплатная крутка через (\d+) ч\.$/,
    (m) => `Next free spin in ${m[1]} h.`,
  ],
  [/^Био не длиннее (\d+) символов$/, (m) => `Bio must be at most ${m[1]} characters.`],
];

export function localizeApiError(
  message: string | null | undefined,
  lang: Lang
): string {
  const text = (message || "").trim();
  if (!text || lang !== "en") return text;

  const exact = EXACT[text];
  if (exact) return exact;

  for (const [pattern, build] of PATTERNS) {
    const match = text.match(pattern);
    if (match) return build(match);
  }

  return text;
}
