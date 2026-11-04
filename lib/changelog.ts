import type { LocalizedText } from "./guides";

export type ChangelogEntryType = "feature" | "improvement" | "fix";

export type ChangelogEntry = {
  id: string;
  date: string;
  version?: string;
  title: LocalizedText;
  summary: LocalizedText;
  type: ChangelogEntryType;
  items: LocalizedText[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: "2026-11-04-library-guides",
    date: "2026-11-04",
    version: "1.8.0",
    title: { ru: "Библиотека покупок, гайды и changelog", en: "Purchase library, guides and changelog" },
    summary: {
      ru: "Купленные конфиги больше не теряются в витрине, а полезные инструкции теперь собраны в отдельном разделе.",
      en: "Purchased configs no longer get lost in the showcase, and helpful guides now live in a dedicated section.",
    },
    type: "feature",
    items: [
      {
        ru: "Раздел «Мои покупки»: конфиги, наборы, версии и история пополнений в одном месте.",
        en: "“My purchases” section: configs, bundles, versions and top-up history in one place.",
      },
      {
        ru: "Кнопка скачивания прямо из библиотеки — даже если карточка конфига скрыта.",
        en: "Download straight from the library even if the config card is hidden.",
      },
      {
        ru: "SEO-гайды: установка лаунчера, выбор конфига и работа с HWID.",
        en: "SEO guides: launcher setup, choosing a config and HWID handling.",
      },
      {
        ru: "Публичная страница обновлений проекта.",
        en: "Public project changelog page.",
      },
    ],
  },
  {
    id: "2026-11-03-bulk-promo",
    date: "2026-11-03",
    version: "1.7.0",
    title: { ru: "Массовые промокоды в админке", en: "Bulk promo codes in admin" },
    summary: {
      ru: "Коды теперь создаются пачками до 1000 штук, с префиксом и выгрузкой в CSV.",
      en: "Codes can now be created in batches of up to 1000, with a prefix and CSV export.",
    },
    type: "feature",
    items: [
      {
        ru: "Генерация пачки кодов: сумма, количество, лимит активаций и префикс.",
        en: "Batch generation: amount, count, activation limit and prefix.",
      },
      {
        ru: "Поиск по коду и мгновенный сброс фильтра.",
        en: "Search by code with one-click filter reset.",
      },
      {
        ru: "Экспорт текущего списка и только что созданных кодов в CSV.",
        en: "CSV export of the current list or just-created codes.",
      },
      {
        ru: "Исправлена выдача списка: раньше отображались только первые 200 кодов.",
        en: "Fixed list loading: previously only the first 200 codes were shown.",
      },
    ],
  },
  {
    id: "2026-11-02-post-payment",
    date: "2026-11-02",
    version: "1.6.0",
    title: { ru: "Понятный экран после оплаты", en: "Clear post-payment flow" },
    summary: {
      ru: "После перехода на FunPay сайт показывает три шага: оплата, промокод, активация.",
      en: "After opening FunPay the site shows three steps: payment, promo code, activation.",
    },
    type: "feature",
    items: [
      {
        ru: "Модальное окно с шагами и кнопкой «Перейти к активации кода».",
        en: "Modal with steps and a “Go to code activation” button.",
      },
      {
        ru: "Кнопка «Код не пришёл» открывает поддержку с уже заполненной темой и описанием.",
        en: "“Code didn't arrive” opens support with the subject and description prefilled.",
      },
      {
        ru: "Кабинет поддерживает прямые ссылки на вкладки, например /dashboard?tab=balance.",
        en: "Dashboard supports deep links to tabs, e.g. /dashboard?tab=balance.",
      },
    ],
  },
  {
    id: "2026-10-31-funpay-topup",
    date: "2026-10-31",
    version: "1.5.0",
    title: { ru: "Пополнение баланса через FunPay", en: "Balance top-up via FunPay" },
    summary: {
      ru: "На странице тарифов появились готовые суммы пополнения от 10 до 400 ₽.",
      en: "The pricing page now offers ready top-up amounts from 10 to 400 ₽.",
    },
    type: "feature",
    items: [
      {
        ru: "Суммы 10, 20, 50, 150, 200, 300 и 400 ₽.",
        en: "Amounts of 10, 20, 50, 150, 200, 300 and 400 ₽.",
      },
      {
        ru: "Ссылки на оплату управляются из админки и подгружаются динамически.",
        en: "Payment links are managed in admin and loaded dynamically.",
      },
      {
        ru: "Убрана сумма 5 ₽, чтобы не плодить мелкие платежи.",
        en: "Removed the 5 ₽ option to avoid tiny payments.",
      },
    ],
  },
  {
    id: "2026-10-24-showcase-versions",
    date: "2026-10-24",
    version: "1.4.0",
    title: { ru: "Версии конфигов и история обновлений", en: "Config versions and update history" },
    summary: {
      ru: "Авторы могут выпускать новые версии конфигов, а покупатели — видеть, что изменилось.",
      en: "Authors can release new config versions, and buyers can see what changed.",
    },
    type: "improvement",
    items: [
      {
        ru: "История версий с changelog и файлами.",
        en: "Version history with changelogs and files.",
      },
      {
        ru: "Покупатели получают уведомление о новой версии купленного конфига.",
        en: "Buyers get notified about a new version of a purchased config.",
      },
      {
        ru: "Наборы конфигов: покупка нескольких работ одним платежом.",
        en: "Config bundles: buy several works in one payment.",
      },
    ],
  },
  {
    id: "2026-10-12-support-csat",
    date: "2026-10-12",
    version: "1.3.0",
    title: { ru: "Оценка ответов поддержки", en: "Support reply ratings" },
    summary: {
      ru: "После закрытия тикета можно оценить, насколько ответ помог.",
      en: "After a ticket is closed you can rate how helpful the reply was.",
    },
    type: "improvement",
    items: [
      {
        ru: "Оценка от 1 до 5 звёзд и комментарий к ней.",
        en: "A 1–5 star rating with an optional comment.",
      },
      {
        ru: "Шаблоны ответов для сотрудников поддержки.",
        en: "Reply templates for support staff.",
      },
      {
        ru: "Вложения в тикетах: скриншоты, логи и архивы.",
        en: "Ticket attachments: screenshots, logs and archives.",
      },
    ],
  },
];

export function changelogTypeLabelKey(type: ChangelogEntryType): LocalizedText {
  switch (type) {
    case "feature":
      return { ru: "Новое", en: "New" };
    case "improvement":
      return { ru: "Улучшение", en: "Improvement" };
    default:
      return { ru: "Исправление", en: "Fix" };
  }
}
