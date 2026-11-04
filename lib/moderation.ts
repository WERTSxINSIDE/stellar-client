import { withTransaction } from "./db";
import { escapeTelegramHtml, notifyAdmins } from "./telegram";

/**
 * Автоматическая модерация чатов Stellar Client.
 *
 * Проверяем два типа нарушений:
 *  - мат/оскорбления (включая leet-замены и растянутые буквы);
 *  - попытки джейлбрейка (обход инструкций, запрос системного промпта).
 *
 * Наказание: 3 страйка за 30 дней → блокировка аккаунта.
 * Гости и служебные аккаунты страйков не получают.
 */

export type ModerationChannel = "assistant" | "clan_chat" | "support";
export type ViolationKind = "profanity" | "jailbreak";

export const MAX_STRIKES = 3;
export const STRIKE_WINDOW_DAYS = 30;

export type Violation = {
  kind: ViolationKind;
  match: string;
};

export type ModerationResult = {
  kind: ViolationKind;
  strikes: number;
  remaining: number;
  banned: boolean;
  staff: boolean;
  message: string;
};

type ModerationInput = {
  userId: number;
  username: string;
  text: string;
  channel: ModerationChannel;
  staff?: boolean;
  lang?: "ru" | "en";
};

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "6": "b",
  "7": "t",
  "8": "b",
  "9": "g",
  "@": "a",
  $: "s",
  "!": "i",
  "|": "i",
  "+": "t",
};

/** Приводит текст к нижнему регистру, убирает leet-замены и лишние разделители. */
function normalize(value: string): string {
  let text = String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[ії]/g, "i")
    .replace(/є/g, "e")
    .replace(/ґ/g, "г");

  text = text
    .replace(/[013456789@$!|+]/g, (char) => LEET[char] || char)
    .replace(/[\u0300-\u036f]/g, "")
    .normalize("NFC");

  // Не раскладываем кириллицу через NFD: «й» превратилась бы в «и».
  return text
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Дополнительно склеиваем слова, чтобы ловить «п и з д а» и подобное. */
function compact(value: string): string {
  return value.replace(/\s+/g, "");
}

function collapseRepeats(value: string): string {
  return value.replace(/([a-zа-я])\1+/gi, "$1");
}

/**
 * Корни, которые можно искать подстрокой даже в склеенном тексте.
 * Специально без коротких «еб»-форм: иначе «тебе»/«себе» дадут ложное срабатывание.
 */
const RU_STRONG_ROOTS = [
  "пизд",
  "хуй",
  "хуя",
  "хую",
  "хуе",
  "хуи",
  "бляд",
  "блят",
  "долбоеб",
  "долбоёб",
  "заеб",
  "наеб",
  "уеб",
  "отъеб",
  "въеб",
  "разъеб",
  "съеб",
  "выеб",
  "перееб",
  "проеб",
  "недоеб",
  "пидор",
  "пидар",
  "педик",
  "педер",
  "пидр",
  "залуп",
  "дроч",
  "шлюх",
  "гандон",
  "мудак",
  "мудил",
  "мудозв",
  "мудень",
  "мудло",
  "сучк",
  "сучар",
  "сучон",
  "жопа",
  "жопу",
  "жопе",
  "жопой",
  "жопы",
  "говн",
  "срат",
  "срал",
  "срут",
  "срач",
  "херн",
  "похер",
  "нахер",
];

const RU_EXACT_WORDS = new Set([
  "бля",
  "сука",
  "суки",
  "суке",
  "суку",
  "сукой",
  "сукою",
  "сукам",
  "суками",
  "суках",
  "хер",
]);

const RU_BARE_EB = /(?:^| )е[б6][аеиуляно]/;

const EN_ROOTS = [
  "fuck",
  "fuk",
  "fck",
  "phuck",
  "motherfuck",
  "shit",
  "bullshit",
  "bitch",
  "bastard",
  "asshole",
  "dumbass",
  "jackass",
  "dipshit",
  "cunt",
  "dickhead",
  "pussy",
  "whore",
  "faggot",
  "wanker",
  "bollocks",
  "douche",
];

const EN_EXACT_WORDS = new Set([
  "ass",
  "dick",
  "cock",
  "cum",
  "fag",
  "prick",
  "slut",
  "sluts",
  "slutty",
  "twat",
]);

/** Обезфускированные английские формы: f*ck, sh1t, b1tch и т.п. */
const EN_OBFUSCATED = [
  /f+[u@a]*c+k+/i,
  /f+c+u+k+/i,
  /sh+[i1!]+t+/i,
  /b+[i1!]+t+ch+/i,
  /c+u+n+t+/i,
  /d+[i1!]+c+k+/i,
  /p+u+s+y+/i,
  /wh+o+r+e+/i,
  /f+a+g+o+t+/i,
  /n+[i1!]+g+(?:er|a|ah|az|uh)/i,
  /r+e+t+a+r+d+/i,
  /w+a+n+k+e+r+/i,
  /b+o+l+l+o+c+k+s+/i,
];

/** Явные команды, которые пытаются переписать поведение модели. */
const JAILBREAK = [
  // Английский: переопределение инструкций.
  /(?:^| )(?:ignore|disregard|forget|override)(?: all)?(?: the)?(?: previous|prior|above|earlier|system|your)(?: instructions|prompts?|rules|directions)(?: |$)/,
  // Английский: покажи системный промпт.
  /(?:^| )(?:reveal|show|print|repeat|output|display|leak|tell me)(?: me)?(?: your| the)(?: system)?(?: prompt|instructions|rules|message)(?: |$)/,
  // Английский: режимы без ограничений.
  /(?:^| )(?:enable|activate|enter|switch to)(?: the)? (?:developer mode|dan mode|jailbreak mode)(?: |$)/,
  /(?:^| )(?:bypass|disable|remove|turn off|ignore)(?: your)?(?: safety|security|content|moderation|filter|restrictions|limitations|guidelines|rules)(?: |$)/,
  /(?:^| )(?:you are|act as|pretend to be|pretend you are|simulate)(?: now)? (?:dan|jailbreak|developer mode|an? (?:unrestricted|uncensored|evil) (?:ai|assistant|model))(?: |$)/,
  /(?:^| )do anything now(?: |$)/,
  /(?:^| )jailbreak(?: mode| prompt| the bot| the assistant| ai| model)(?: |$)/,
  // Русский: переопределение инструкций.
  /(?:^| )(?:игнорируй|проигнорируй|забудь|отмени|обойди)(?: все)?(?: предыдущие| прошлые| системные| свои| все)(?: инструкции| правила| указания| промпты?)(?: |$)/,
  /(?:^| )(?:игнорируй|проигнорируй)(?: все)?(?: инструкции| указания)(?: |$)/,
  // Русский: покажи системный промпт.
  /(?:^| )(?:покажи|раскрой|выведи|повтори|скинь|напиши|скажи)(?: мне)?(?: (?:свой|твой))?(?: (?:системный|скрытый|внутренний))?(?: (?:промпт|инструкции|правила|сообщение))(?: |$)/,
  // Русский: режимы без ограничений.
  /(?:^| )(?:включи|активируй|перейди в)(?: режим разработчика| режим dan| джейлбрейк| jailbreak)(?: |$)/,
  /(?:^| )(?:сними|обойди|отключи|убери)(?: с себя| у себя| свои| все свои)(?: ограничения| фильтры| защиту| цензуру| правила)(?: |$)/,
  /(?:^| )(?:отвечай|говори|пиши|работай|действуй)(?: теперь)? без (?:ограничений|цензуры|фильтров|правил)(?: |$)/,
  /(?:^| )(?:представь|вообрази)(?:,? что)? ты (?:dan|без ограничений|без цензуры|не подчиняешься|свободен от)(?: |$)/,
  /(?:^| )ты теперь (?:dan|без ограничений|без цензуры|не подчиняешься)(?: |$)/,
  /(?:^| )(?:взломай|обмани|перепрограммируй)(?: бота| ассистента| систему| нейросеть| модель)(?: |$)/,
];

/** Те же команды, но для склеенного текста («i g n o r e  p r e v i o u s...»). */
const JAILBREAK_COMPACT = [
  /ignore(?:all)?(?:the)?(?:previous|prior|above|earlier|system|your)(?:instructions|prompts?|rules|directions)/,
  /disregard(?:all)?(?:the)?(?:previous|prior|above|earlier|system|your)(?:instructions|prompts?|rules|directions)/,
  /forget(?:all)?(?:the)?(?:previous|prior|above|earlier|system|your)(?:instructions|prompts?|rules|directions)/,
  /reveal(?:me)?(?:your|the)(?:system)?(?:prompt|instructions|rules|message)/,
  /show(?:me)?(?:your|the)(?:system)?prompt/,
  /developermode/,
  /danmode/,
  /doanythingnow/,
  /jailbreak(?:mode|prompt|thebot|theassistant|ai|model)/,
  /игнорируй(?:все)?(?:предыдущие|прошлые|системные|свои)(?:инструкции|правила|указания|промпты?)/,
  /забудь(?:все)?(?:предыдущие|прошлые|системные|свои)(?:инструкции|правила|указания|промпты?)/,
  /покажи(?:мне)?(?:свой|твой)?(?:системный|скрытый|внутренний)?(?:промпт|инструкции|правила|сообщение)/,
  /режимразработчика/,
  /режимdan/,
  /джейлбрейк(?:режим|промпт)?/,
  /отвечайбез(?:ограничений|цензуры|фильтров|правил)/,
  /говорибез(?:ограничений|цензуры|фильтров|правил)/,
  /пишибез(?:ограничений|цензуры|фильтров|правил)/,
];

function firstRoot(text: string, roots: string[]): string | null {
  for (const root of roots) {
    if (text.includes(root)) return root;
  }
  return null;
}

function detectProfanity(normalized: string): Violation | null {
  const tokens = normalized.split(" ").filter(Boolean);
  const squashedTokens = tokens.map(collapseRepeats);
  const squashed = squashedTokens.join(" ");
  const glued = compact(normalized);
  const gluedSquashed = compact(squashed);

  for (const token of [...tokens, ...squashedTokens]) {
    if (RU_EXACT_WORDS.has(token) || EN_EXACT_WORDS.has(token)) {
      return { kind: "profanity", match: token };
    }
  }

  const ru = firstRoot(squashed, RU_STRONG_ROOTS) || firstRoot(gluedSquashed, RU_STRONG_ROOTS);
  if (ru) return { kind: "profanity", match: ru };

  if (RU_BARE_EB.test(squashed)) {
    return { kind: "profanity", match: "еб" };
  }

  // Английские корни ищем в тексте и в склеенном варианте (для f*ck и т.п.).
  const en = firstRoot(normalized, EN_ROOTS) || firstRoot(glued, EN_ROOTS);
  if (en) return { kind: "profanity", match: en };

  for (const pattern of EN_OBFUSCATED) {
    const match = glued.match(pattern);
    if (match) return { kind: "profanity", match: match[0] };
  }

  return null;
}

function detectJailbreak(normalized: string): Violation | null {
  for (const pattern of JAILBREAK) {
    const match = normalized.match(pattern);
    if (match) return { kind: "jailbreak", match: match[0] };
  }

  const glued = compact(normalized);
  for (const pattern of JAILBREAK_COMPACT) {
    const match = glued.match(pattern);
    if (match) return { kind: "jailbreak", match: match[0] };
  }

  return null;
}

/** Чистая проверка текста: ничего не пишет в БД. */
export function detectViolation(value: string): Violation | null {
  const normalized = normalize(value);
  if (!normalized) return null;
  return detectJailbreak(normalized) || detectProfanity(normalized);
}

function channelLabel(channel: ModerationChannel): string {
  if (channel === "clan_chat") return "чат клана";
  if (channel === "support") return "поддержка";
  return "помощник";
}

function buildMessage(
  lang: "ru" | "en",
  kind: ViolationKind,
  strikes: number,
  remaining: number,
  banned: boolean,
  staff: boolean,
  failed = false
): string {
  if (failed) {
    return lang === "en"
      ? "The message was blocked by moderation. Please rephrase it."
      : "Сообщение отклонено модерацией. Попробуйте переформулировать.";
  }

  if (staff) {
    return lang === "en"
      ? "The message was blocked and logged. Staff accounts are not auto-banned."
      : "Сообщение заблокировано и записано в журнал. Служебные аккаунты не блокируются автоматически.";
  }

  if (banned) {
    return lang === "en"
      ? `Your account has been banned after ${MAX_STRIKES} violations. You can appeal through support.`
      : `Аккаунт заблокирован после ${MAX_STRIKES} нарушений. Обжаловать можно через поддержку.`;
  }

  if (lang === "en") {
    const what = kind === "profanity" ? "Profanity" : "Jailbreak attempts";
    return `${what} are not allowed. Strike ${strikes} of ${MAX_STRIKES}. ${remaining} ${
      remaining === 1 ? "strike" : "strikes"
    } left before a ban.`;
  }

  const what = kind === "profanity" ? "Мат" : "Попытки обхода инструкций";
  const left =
    remaining === 1 ? "До блокировки остался 1 страйк." : `До блокировки осталось ${remaining} страйка.`;
  return `${what} запрещены. Страйк ${strikes} из ${MAX_STRIKES}. ${left}`;
}

/** Ответ гостю: сообщение отклоняется, но страйк не начисляется. */
export function guestViolationMessage(kind: ViolationKind, lang: "ru" | "en" = "ru"): string {
  if (lang === "en") {
    return kind === "profanity"
      ? "Profanity is not allowed here. Guests are not penalized, but the message was not sent."
      : "Jailbreak attempts are not allowed here. Guests are not penalized, but the message was not sent.";
  }
  return kind === "profanity"
    ? "Мат здесь запрещён. Гости не получают страйки, но сообщение не отправлено."
    : "Попытки обхода инструкций запрещены. Гости не получают страйки, но сообщение не отправлено.";
}

async function recordViolation(input: ModerationInput, violation: Violation): Promise<ModerationResult> {
  const lang = input.lang ?? "ru";
  const staff = Boolean(input.staff);
  const excerpt = String(input.text || "").replace(/\s+/g, " ").trim().slice(0, 300);

  try {
    const result = await withTransaction(async (client) => {
      const countRow = await client.query(
        `SELECT COUNT(*)::int AS count
         FROM moderation_events
         WHERE user_id = $1 AND action = 'strike'
           AND created_at > NOW() - ($2 || ' days')::interval`,
        [input.userId, String(STRIKE_WINDOW_DAYS)]
      );

      const previous = Number(countRow.rows[0]?.count ?? 0);
      const strikes = staff ? previous : previous + 1;
      const banned = !staff && strikes >= MAX_STRIKES;
      const action = staff ? "logged" : banned ? "ban" : "strike";
      const reason = `Автобан: ${MAX_STRIKES} страйка за мат или попытки обхода инструкций (${channelLabel(
        input.channel
      )}).`;

      await client.query(
        `INSERT INTO moderation_events (user_id, channel, kind, excerpt, action)
         VALUES ($1, $2, $3, $4, $5)`,
        [input.userId, input.channel, violation.kind, excerpt, action]
      );

      if (banned) {
        await client.query("UPDATE users SET banned = 1, ban_reason = $1 WHERE id = $2", [
          reason,
          input.userId,
        ]);
        await client.query("DELETE FROM sessions WHERE user_id = $1", [input.userId]);
      }

      return { strikes, banned };
    });

    if (result.banned) {
      await notifyAdmins(
        [
          "🚫 <b>Автобан за нарушения в чате</b>",
          `Пользователь: ${escapeTelegramHtml(input.username)} (#${input.userId})`,
          `Канал: ${escapeTelegramHtml(channelLabel(input.channel))}`,
          `Нарушение: ${violation.kind === "profanity" ? "мат" : "джейлбрейк"}`,
          `Фрагмент: ${escapeTelegramHtml(excerpt.slice(0, 180))}`,
        ].join("\n")
      ).catch(() => {});
    }

    return {
      kind: violation.kind,
      strikes: result.strikes,
      remaining: Math.max(0, MAX_STRIKES - result.strikes),
      banned: result.banned,
      staff,
      message: buildMessage(lang, violation.kind, result.strikes, Math.max(0, MAX_STRIKES - result.strikes), result.banned, staff),
    };
  } catch (error: any) {
    console.error("moderation error:", error?.message || error);
    return {
      kind: violation.kind,
      strikes: 0,
      remaining: MAX_STRIKES,
      banned: false,
      staff,
      message: buildMessage(lang, violation.kind, 0, MAX_STRIKES, false, staff, true),
    };
  }
}

/**
 * Проверяет сообщение и, если нужно, начисляет страйк / банит.
 * Возвращает null, если нарушений нет.
 */
export async function moderateMessage(input: ModerationInput): Promise<ModerationResult | null> {
  const violation = detectViolation(input.text);
  if (!violation) return null;
  return recordViolation(input, violation);
}
