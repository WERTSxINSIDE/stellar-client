import { GUIDES } from "./guides";

/**
 * Локальный помощник: ищет ответ по FAQ и гайдам без внешних API.
 * Если совпадение слабое, страница предлагает создать тикет.
 */

export type AssistantLang = "ru" | "en";

export type AssistantSource = {
  id: string;
  kind: "guide" | "faq";
  title: string;
  url: string;
  snippet: string;
  score: number;
};

export type AssistantAnswer = {
  answer: string;
  sources: AssistantSource[];
  escalate: boolean;
  suggestions: string[];
  matched: number;
};

type FaqEntry = {
  id: string;
  question: { ru: string; en: string };
  answer: { ru: string; en: string };
  keywords?: string[];
};

/** Частые вопросы, включая те, что не попали в короткий блок FAQ на сайте. */
const FAQ: FaqEntry[] = [
  {
    id: "faq-launch",
    question: { ru: "Как запустить клиент?", en: "How do I launch the client?" },
    answer: {
      ru: "Скачайте лаунчер, откройте его и укажите объём оперативной памяти (рекомендуем не больше 8 ГБ). Нажмите «Старт» и дождитесь загрузки клиента. Перед запуском убедитесь, что подписка активна и вы вошли в тот же аккаунт, что и на сайте.",
      en: "Download the launcher, open it and set the RAM amount (we recommend no more than 8 GB). Press “Start” and wait for the client to load. Make sure your subscription is active and you are signed in with the same account as on the website.",
    },
    keywords: ["запуск", "старт", "лаунчер", "launcher", "start", "играть", "play"],
  },
  {
    id: "faq-config",
    question: {
      ru: "Как загрузить конфиг в клиент?",
      en: "How do I load a config into the client?",
    },
    answer: {
      ru: "Запустите клиент хотя бы один раз, затем откройте папку C:\\stellar\\configs и поместите туда файл конфига. После этого конфиг появится в списке внутри клиента — выберите его и активируйте.",
      en: "Launch the client at least once, then open C:\\stellar\\configs and put the config file there. The config will appear in the client's list — select and activate it.",
    },
    keywords: ["конфиг", "config", "папка", "folder", "stellar", "загрузить", "load"],
  },
  {
    id: "faq-script",
    question: {
      ru: "Как создать собственный скрипт?",
      en: "How do I create my own script?",
    },
    answer: {
      ru: "Сначала прочитайте документацию: в ней есть примеры, хуки событий и описание API. Следуйте рекомендациям по разработке, чтобы скрипт оставался совместимым с клиентом. Готовые скрипты можно публиковать в витрине сообщества.",
      en: "Read the documentation first: it contains examples, event hooks and the API description. Follow the development guidelines so the script stays compatible with the client. Finished scripts can be published in the community showcase.",
    },
    keywords: ["скрипт", "script", "api", "документация", "documentation", "хук", "hook"],
  },
  {
    id: "faq-support",
    question: { ru: "Как связаться с поддержкой?", en: "How do I contact support?" },
    answer: {
      ru: "Откройте раздел «Поддержка» на сайте и создайте тикет. Опишите проблему, приложите скриншот и укажите примерное время события — так ответ будет быстрее. Также можно написать владельцу клиента в Telegram.",
      en: "Open the “Support” section on the website and create a ticket. Describe the issue, attach a screenshot and include the approximate time — this speeds up the answer. You can also message the client owner on Telegram.",
    },
    keywords: ["поддержка", "support", "тикет", "ticket", "помощь", "help", "телеграм", "telegram"],
  },
  {
    id: "faq-payment",
    question: {
      ru: "Как оплатить подписку и что делать, если платёж не пришёл?",
      en: "How do I pay for a subscription and what if the payment is missing?",
    },
    answer: {
      ru: "Оплатить можно на странице тарифов или пополнить баланс и оплатить с него. Пополнение доступно на 10, 20, 50, 150, 200, 300 и 400 ₽. Если деньги списались, а баланс не изменился, подождите пару минут и обновите страницу; если не помогло — создайте тикет с чеком и временем оплаты.",
      en: "Pay on the pricing page or top up your balance and pay from it. Top-ups are available for 10, 20, 50, 150, 200, 300 and 400 ₽. If money was charged but the balance did not change, wait a couple of minutes and refresh; if that does not help, open a ticket with the receipt and payment time.",
    },
    keywords: ["оплата", "payment", "пополнить", "topup", "баланс", "balance", "платеж", "чек"],
  },
  {
    id: "faq-promo",
    question: { ru: "Как активировать промокод?", en: "How do I activate a promo code?" },
    answer: {
      ru: "Промокод на баланс вводится в кабинете в блоке пополнения. Промокод на скидку применяется при покупке конфига в витрине. Коды чувствительны к регистру и пробелам: скопируйте код целиком и не добавляйте лишние символы.",
      en: "A balance promo code is entered in the dashboard's top-up block. A discount code is applied when buying a config in the showcase. Codes are case- and whitespace-sensitive: copy the whole code and do not add extra characters.",
    },
    keywords: ["промокод", "promo", "купон", "coupon", "скидка", "discount", "код", "code"],
  },
  {
    id: "faq-hwid",
    question: { ru: "Как сбросить HWID?", en: "How do I reset HWID?" },
    answer: {
      ru: "Войдите в кабинет, откройте «Дополнения» (или «Действия»), нажмите сброс HWID и подтвердите списание 150 ₽ с баланса. После сброса запустите лаунчер заново — привязка произойдёт автоматически. Сброс не нужен при обновлении драйверов или переустановке лаунчера.",
      en: "Sign in to the dashboard, open “Add-ons” (or “Actions”), click HWID reset and confirm the 150 ₽ charge. Then restart the launcher — binding happens automatically. A reset is not needed for driver updates or launcher reinstallation.",
    },
    keywords: ["hwid", "сброс", "reset", "привязка", "binding", "устройство", "device"],
  },
  {
    id: "faq-coins",
    question: { ru: "Что такое SC-монеты и как их получить?", en: "What are SC coins and how do I earn them?" },
    answer: {
      ru: "SC — внутренняя валюта клуба. Монеты дают за ежедневные квесты (до 65 SC в день), ежедневную награду (+10 SC, всего 7 получений на аккаунт), одобренный отзыв (+25), покупки (1 SC за каждые 10 ₽), достижения (+50) и игру в клиенте (+1 SC за 10 минут, до 30 SC в день). Ещё SC начисляются за приглашённых друзей. Тратить их можно на косметику или обменять на рубли в кабинете.",
      en: "SC is the club's internal currency. You earn it from daily quests (up to 65 SC/day), the daily reward (+10 SC, 7 claims per account in total), approved reviews (+25), purchases (1 SC per 10 ₽), achievements (+50) and playtime (+1 SC per 10 minutes, up to 30 SC/day). Referrals also give SC. Spend it on cosmetics or exchange it for rubles in the dashboard.",
    },
    keywords: ["sc", "монеты", "coins", "валюта", "currency", "косметика", "cosmetics", "квесты", "quests"],
  },
  {
    id: "faq-exchange",
    question: { ru: "Как обменять SC на рубли?", en: "How do I exchange SC for rubles?" },
    answer: {
      ru: "Откройте в кабинете раздел «Обменник». Курс фиксированный: 50 SC = 1 ₽. В рубли можно перевести любую сумму SC от 50: рубли начисляются целыми, а остаток SC (меньше 50) остаётся на счету. Рубли на SC меняются любой целой суммой. Обмен происходит сразу, комиссии нет.",
      en: "Open the “Exchange” section in the dashboard. The rate is fixed: 50 SC = 1 ₽. You can convert any SC amount from 50: rubles are credited in whole numbers and the SC remainder (under 50) stays on your balance. Rubles can be swapped to SC in any whole amount. The exchange is instant and has no fee.",
    },
    keywords: ["обмен", "exchange", "обменник", "sc в рубли", "рубли в sc", "курс", "rate"],
  },
  {
    id: "faq-clans",
    question: { ru: "Что дают кланы?", en: "What do clans give?" },
    answer: {
      ru: "Клан объединяет игроков: общий прогресс и уровень, лидерборд, казна и бонус к ежедневным SC за состав. XP клану дают ежедневная награда, покупки, отзывы, взносы в казну и время в игре. Раз в неделю доступны клановые миссии — за них каждый участник получает SC. Забрать награду может офицер и выше, если в клане хотя бы 3 человека. Вступить можно по заявке или приглашению.",
      en: "A clan brings players together: shared progress and level, a leaderboard, treasury and a daily SC bonus based on composition. Clan XP comes from daily rewards, purchases, reviews, treasury deposits and playtime. Weekly clan missions give SC to every member. An officer or higher can claim the reward once the clan has at least 3 members. Join by application or invite.",
    },
    keywords: ["клан", "clan", "кланы", "clans", "миссии", "missions", "лидерборд", "leaderboard", "казна", "treasury"],
  },
  {
    id: "faq-download",
    question: {
      ru: "Почему кнопка скачивания лаунчера неактивна?",
      en: "Why is the launcher download button disabled?",
    },
    answer: {
      ru: "Скачивание открывается только при активной подписке. Активируйте ключ в разделе «Дополнения» или оплатите подписку с баланса. Если подписка активна, а кнопка всё равно не работает, обновите страницу и проверьте, что вы вошли в аккаунт.",
      en: "Downloads unlock only with an active subscription. Activate a key in “Add-ons” or pay for a subscription from your balance. If the subscription is active but the button still does not work, refresh the page and make sure you are signed in.",
    },
    keywords: ["скачать", "download", "лаунчер", "launcher", "кнопка", "button", "неактивна"],
  },
  {
    id: "faq-banned",
    question: {
      ru: "Что делать, если аккаунт заблокировали?",
      en: "What if my account was banned?",
    },
    answer: {
      ru: "Причина блокировки указывается в кабинете. Если вы считаете блокировку ошибкой, создайте тикет в поддержке: приложите ник, примерное время блокировки и объяснение ситуации. Не создавайте новые аккаунты — это может усложнить разбор.",
      en: "The ban reason is shown in the dashboard. If you believe the ban is a mistake, open a support ticket with your username, the approximate ban time and an explanation. Do not create new accounts — this can complicate the review.",
    },
    keywords: ["бан", "ban", "блокировка", "blocked", "аккаунт", "account"],
  },
  {
    id: "faq-refund",
    question: { ru: "Можно ли вернуть деньги?", en: "Can I get a refund?" },
    answer: {
      ru: "Возврат рассматривается индивидуально через поддержку. Опишите причину, приложите чек и данные заказа. Если проблема в работе конфига, сначала напишите автору или в поддержку — часто вопрос решается обновлением файла.",
      en: "Refunds are reviewed individually through support. Describe the reason and attach the receipt and order details. If a config is not working, contact the author or support first — often an updated file solves the issue.",
    },
    keywords: ["возврат", "refund", "деньги", "money", "отмена", "cancel"],
  },
];

type IndexEntry = {
  id: string;
  kind: "guide" | "faq";
  title: string;
  url: string;
  answer: string;
  titleTokens: Set<string>;
  bodyTokens: Map<string, number>;
  bodyText: string;
};

const STOPWORDS = new Set([
  "и", "в", "во", "не", "что", "он", "на", "я", "с", "со", "как", "а", "то", "все", "она", "так",
  "его", "но", "да", "ты", "к", "у", "же", "вы", "за", "бы", "по", "только", "ее", "мне", "было",
  "вот", "от", "меня", "еще", "нет", "о", "из", "ему", "теперь", "когда", "даже", "ну", "вдруг",
  "ли", "если", "уже", "или", "ни", "быть", "был", "него", "до", "вас", "нибудь", "опять",
  "уж", "вам", "ведь", "там", "потом", "себя", "ничего", "ей", "может", "они", "тут", "где",
  "есть", "надо", "ней", "для", "мы", "тебя", "их", "чем", "была", "сам", "чтоб", "без",
  "будто", "чего", "раз", "тоже", "себе", "под", "будет", "ж", "тогда", "кто", "этот",
  "того", "потому", "этого", "какой", "совсем", "ним", "здесь", "этом", "один", "почти",
  "мой", "тем", "чтобы", "нее", "были", "куда", "зачем", "всех", "никогда", "можно", "при",
  "наконец", "два", "об", "другой", "хоть", "после", "над", "больше", "тот", "через", "эти",
  "нас", "про", "всего", "них", "какая", "много", "разве", "три", "эту", "моя", "впрочем",
  "хорошо", "свою", "этой", "перед", "иногда", "лучше", "чуть", "том", "нельзя", "такой",
  "им", "более", "всегда", "конечно", "всю", "между",
  "the", "a", "an", "and", "or", "but", "if", "then", "than", "that", "this", "these", "those",
  "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
  "will", "would", "can", "could", "should", "may", "might", "must", "i", "you", "he", "she",
  "it", "we", "they", "me", "him", "her", "us", "them", "my", "your", "his", "its", "our", "their",
  "what", "which", "who", "whom", "when", "where", "why", "how", "to", "of", "in", "on", "for",
  "with", "at", "by", "from", "as", "about", "into", "through", "before", "after", "above",
  "below", "between", "up", "down", "out", "off", "over", "under", "again", "further", "once",
  "here", "there", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such",
  "no", "nor", "not", "only", "own", "same", "so", "too", "very", "just", "don", "now",
]);

const RU_ENDINGS = [
  "иями", "ями", "ами", "ыми", "ими", "ого", "его", "ому", "ему", "ыми", "их", "ых",
  "ая", "ое", "ые", "ий", "ый", "ой", "ей", "ую", "юю", "ом", "ем", "ам", "ям", "ах",
  "ях", "ию", "ью", "ия", "ья", "ов", "ев", "ите", "ешь", "ать", "ить", "еть", "ует",
  "ают", "яют", "тся", "ться", "ли", "ла", "ло", "ны", "на", "но", "ть", "ся", "сь",
];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\u00a0/g, " ")
    .replace(/[^a-zа-я0-9+#.\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stem(word: string): string {
  if (word.length <= 4) return word;
  for (const ending of RU_ENDINGS) {
    if (word.endsWith(ending) && word.length - ending.length >= 3) {
      return word.slice(0, word.length - ending.length);
    }
  }
  return word;
}

function tokenize(value: string): string[] {
  const text = normalizeText(value);
  if (!text) return [];

  return text
    .split(" ")
    .map((word) => word.replace(/^[.-]+|[.-]+$/g, ""))
    .filter((word) => word.length >= 2 && !STOPWORDS.has(word))
    .map(stem)
    .filter(Boolean);
}

function countTokens(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokenize(text)) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return counts;
}

function joinLocalized(value: { ru: string; en: string } | undefined, lang: AssistantLang): string {
  if (!value) return "";
  return lang === "en" ? value.en : value.ru;
}

function guideSectionText(section: (typeof GUIDES)[number]["sections"][number], lang: AssistantLang): string {
  const parts: string[] = [];
  const heading = joinLocalized(section.heading, lang);
  if (heading) parts.push(heading);
  for (const paragraph of section.paragraphs || []) parts.push(joinLocalized(paragraph, lang));
  for (const bullet of section.bullets || []) parts.push(`• ${joinLocalized(bullet, lang)}`);
  for (const step of section.steps || []) parts.push(`→ ${joinLocalized(step, lang)}`);
  const note = joinLocalized(section.note, lang);
  if (note) parts.push(note);
  return parts.filter(Boolean).join("\n");
}

function buildIndex(lang: AssistantLang): IndexEntry[] {
  const entries: IndexEntry[] = [];

  for (const item of FAQ) {
    const title = joinLocalized(item.question, lang);
    const answer = joinLocalized(item.answer, lang);
    const bodyText = `${title} ${answer} ${(item.keywords || []).join(" ")}`;
    entries.push({
      id: item.id,
      kind: "faq",
      title,
      url: "/faq",
      answer,
      titleTokens: new Set(tokenize(title)),
      bodyTokens: countTokens(bodyText),
      bodyText: normalizeText(bodyText),
    });
  }

  for (const guide of GUIDES) {
    const guideTitle = joinLocalized(guide.title, lang);
    const guideDescription = joinLocalized(guide.description, lang);
    const category = joinLocalized(guide.category, lang);

    for (const [index, section] of guide.sections.entries()) {
      const heading = joinLocalized(section.heading, lang);
      const text = guideSectionText(section, lang);
      const title = `${guideTitle} — ${heading}`;
      const bodyText = `${title} ${guideDescription} ${category} ${text}`;

      entries.push({
        id: `${guide.slug}-${index}`,
        kind: "guide",
        title,
        url: `/guides/${guide.slug}`,
        answer: text.slice(0, 1200),
        titleTokens: new Set([...tokenize(title), ...tokenize(guideTitle), ...tokenize(category)]),
        bodyTokens: countTokens(bodyText),
        bodyText: normalizeText(bodyText),
      });
    }
  }

  return entries;
}

const INDEXES: Record<AssistantLang, IndexEntry[]> = {
  ru: buildIndex("ru"),
  en: buildIndex("en"),
};

const POPULAR: Record<AssistantLang, string[]> = {
  ru: [
    "Как установить лаунчер?",
    "Как сбросить HWID?",
    "Где взять конфиг?",
    "Как оплатить подписку?",
    "Что такое SC-монеты?",
    "Что дают кланы?",
  ],
  en: [
    "How do I install the launcher?",
    "How do I reset HWID?",
    "Where do I get a config?",
    "How do I pay for a subscription?",
    "What are SC coins?",
    "What do clans give?",
  ],
};

export function popularQuestions(lang: AssistantLang): string[] {
  return POPULAR[lang];
}

function snippet(text: string, length = 220): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= length ? clean : `${clean.slice(0, length).trimEnd()}…`;
}

export function searchAssistant(
  message: string,
  lang: AssistantLang = "ru",
  limit = 4
): AssistantAnswer {
  const query = String(message || "").slice(0, 500);
  const queryTokens = [...new Set(tokenize(query))];

  if (!queryTokens.length) {
    return {
      answer:
        lang === "en"
          ? "Ask a question about installing, launching, HWID, payments, configs, SC coins or clans."
          : "Спросите об установке, запуске, HWID, оплате, конфигах, SC-монетах или кланах.",
      sources: [],
      escalate: false,
      suggestions: [],
      matched: 0,
    };
  }

  const index = INDEXES[lang];
  const normalizedQuery = normalizeText(query);

  const scored = index
    .map((entry) => {
      let score = 0;
      let matched = 0;

      for (const token of queryTokens) {
        const inTitle = entry.titleTokens.has(token);
        const bodyCount = entry.bodyTokens.get(token) || 0;

        if (inTitle) {
          score += 4;
          matched += 1;
        } else if (bodyCount > 0) {
          score += Math.min(3, bodyCount) * 1.5;
          matched += 1;
        }
      }

      // Точное вхождение фразы заметно повышает релевантность.
      if (normalizedQuery.length >= 5 && entry.bodyText.includes(normalizedQuery)) {
        score += 6;
      }

      const coverage = matched / queryTokens.length;
      if (coverage < 0.34) score *= 0.35;
      else if (coverage < 0.6) score *= 0.7;

      return { entry, score, matched };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title));

  const best = scored[0];
  const coverage = best ? best.matched / queryTokens.length : 0;
  const escalate = !best || best.score < 3 || coverage < 0.34;

  if (escalate) {
    return {
      answer:
        lang === "en"
          ? "I couldn't find a confident answer in the guides. Create a support ticket and describe the issue — a human will help."
          : "Не нашёл уверенного ответа в гайдах. Создайте тикет в поддержке и опишите проблему — там поможет человек.",
      sources: scored.slice(0, 2).map((item) => ({
        id: item.entry.id,
        kind: item.entry.kind,
        title: item.entry.title,
        url: item.entry.url,
        snippet: snippet(item.entry.answer),
        score: Math.round(item.score),
      })),
      escalate: true,
      suggestions: [],
      matched: 0,
    };
  }

  const sources = scored.slice(0, Math.max(1, Math.min(limit, 4))).map((item) => ({
    id: item.entry.id,
    kind: item.entry.kind,
    title: item.entry.title,
    url: item.entry.url,
    snippet: snippet(item.entry.answer),
    score: Math.round(item.score),
  }));

  const suggestions = scored
    .slice(1, 4)
    .map((item) => item.entry.title)
    .filter((title) => title !== best.entry.title)
    .slice(0, 3);

  return {
    answer: best.entry.answer,
    sources,
    escalate: false,
    suggestions,
    matched: best.matched,
  };
}
