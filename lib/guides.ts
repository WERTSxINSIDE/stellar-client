export type LocalizedText = { ru: string; en: string };

export type GuideSection = {
  heading: LocalizedText;
  paragraphs?: LocalizedText[];
  bullets?: LocalizedText[];
  steps?: LocalizedText[];
  note?: LocalizedText;
};

export type Guide = {
  slug: string;
  title: LocalizedText;
  description: LocalizedText;
  category: LocalizedText;
  readingMinutes: number;
  updated: string;
  sections: GuideSection[];
};

export const GUIDES: Guide[] = [
  {
    slug: "kak-ustanovit-launcher",
    title: {
      ru: "Как установить лаунчер Stellar Client",
      en: "How to install the Stellar Client launcher",
    },
    description: {
      ru: "Пошаговая установка лаунчера: от активации ключа до первого запуска Minecraft. Что делать, если Windows блокирует файл.",
      en: "Step-by-step launcher setup: from key activation to the first Minecraft launch, including Windows SmartScreen fixes.",
    },
    category: { ru: "Установка", en: "Setup" },
    readingMinutes: 6,
    updated: "2026-11-04",
    sections: [
      {
        heading: { ru: "Что понадобится", en: "What you need" },
        bullets: [
          {
            ru: "Windows 10 или Windows 11 (64-бит).",
            en: "Windows 10 or Windows 11 (64-bit).",
          },
          {
            ru: "Активная подписка Stellar Client — ключ или оплата с баланса.",
            en: "An active Stellar Client subscription — a key or a balance payment.",
          },
          {
            ru: "Стабильное интернет-соединение для входа в аккаунт.",
            en: "A stable internet connection to sign in.",
          },
        ],
        paragraphs: [
          {
            ru: "Лаунчер не требует установки: это архив с исполняемым файлом. Его можно хранить в любой папке, кроме системной.",
            en: "The launcher needs no installation: it is an archive with an executable. Keep it in any folder except a system one.",
          },
        ],
      },
      {
        heading: { ru: "Шаг 1. Активируйте ключ", en: "Step 1. Activate your key" },
        steps: [
          {
            ru: "Войдите в аккаунт на сайте.",
            en: "Sign in to your account on the website.",
          },
          {
            ru: "Откройте «Кабинет» → «Дополнения».",
            en: "Open “Dashboard” → “Add-ons”.",
          },
          {
            ru: "Вставьте ключ в поле активации и подтвердите.",
            en: "Paste the key into the activation field and confirm.",
          },
        ],
        paragraphs: [
          {
            ru: "После активации в кабинете появится срок подписки. Если ключ не подходит, проверьте раскладку и лишние пробелы — код чувствителен к символам.",
            en: "After activation the subscription period appears in your dashboard. If the key is rejected, check for extra spaces and typos — codes are character-sensitive.",
          },
        ],
      },
      {
        heading: { ru: "Шаг 2. Скачайте лаунчер", en: "Step 2. Download the launcher" },
        steps: [
          {
            ru: "В кабинете откройте раздел «Действия».",
            en: "In the dashboard open the “Actions” section.",
          },
          {
            ru: "Нажмите «Скачать лаунчер».",
            en: "Click “Download launcher”.",
          },
          {
            ru: "Дождитесь окончания загрузки архива.",
            en: "Wait for the archive to download.",
          },
        ],
        note: {
          ru: "Без активной подписки кнопка ведёт на страницу тарифов: скачивание открывается только после оплаты или активации ключа.",
          en: "Without an active subscription the button leads to pricing: downloads unlock only after payment or key activation.",
        },
      },
      {
        heading: { ru: "Шаг 3. Запустите и войдите", en: "Step 3. Run and sign in" },
        steps: [
          {
            ru: "Распакуйте архив в отдельную папку.",
            en: "Extract the archive into a separate folder.",
          },
          {
            ru: "Запустите файл лаунчера от имени администратора.",
            en: "Run the launcher executable as administrator.",
          },
          {
            ru: "Войдите тем же логином, что и на сайте.",
            en: "Sign in with the same login you use on the website.",
          },
          {
            ru: "Выберите версию Minecraft и нажмите «Играть».",
            en: "Pick a Minecraft version and press “Play”.",
          },
        ],
        paragraphs: [
          {
            ru: "При первом запуске клиент привязывает ваш компьютер по HWID. Это защита подписки от передачи третьим лицам.",
            en: "On the first launch the client binds your computer by HWID. This protects the subscription from being shared.",
          },
        ],
      },
      {
        heading: { ru: "Если Windows блокирует файл", en: "If Windows blocks the file" },
        bullets: [
          {
            ru: "SmartScreen: «Подробнее» → «Выполнить в любом случае».",
            en: "SmartScreen: “More info” → “Run anyway”.",
          },
          {
            ru: "Антивирус: добавьте папку с лаунчером в исключения.",
            en: "Antivirus: add the launcher folder to exclusions.",
          },
          {
            ru: "Архив не распаковывается: обновите 7-Zip или WinRAR.",
            en: "The archive won't extract: update 7-Zip or WinRAR.",
          },
          {
            ru: "Лаунчер закрывается сразу: запустите его от администратора и проверьте, что путь не содержит кириллицы.",
            en: "The launcher closes instantly: run it as administrator and make sure the path has no non-Latin characters.",
          },
        ],
        paragraphs: [
          {
            ru: "Если ошибка сохраняется, создайте тикет в поддержке и приложите скриншот — так мы разберёмся быстрее.",
            en: "If the issue persists, open a support ticket and attach a screenshot so we can help faster.",
          },
        ],
      },
    ],
  },
  {
    slug: "kak-vybrat-konfig",
    title: {
      ru: "Как выбрать конфиг в витрине",
      en: "How to choose a config in the showcase",
    },
    description: {
      ru: "На что смотреть перед покупкой конфига: версия игры, тип, рейтинг, автор, обновления и совместимость.",
      en: "What to check before buying a config: game version, type, rating, author, updates and compatibility.",
    },
    category: { ru: "Витрина", en: "Showcase" },
    readingMinutes: 5,
    updated: "2026-11-04",
    sections: [
      {
        heading: { ru: "Сначала определите задачу", en: "Start with your goal" },
        paragraphs: [
          {
            ru: "Конфиги в витрине делятся по назначению: PvP, движение, визуал и автоматизация. Не покупайте набор модулей «на всё сразу» — чаще всего половина функций не подходит под ваш стиль игры.",
            en: "Showcase configs differ by purpose: PvP, movement, visuals and automation. Avoid buying an “everything” pack — half of its features usually don't fit your playstyle.",
          },
        ],
        bullets: [
          {
            ru: "PvP — точность, таргет, информация о противнике.",
            en: "PvP — accuracy, targeting, opponent info.",
          },
          {
            ru: "Движение — ускорение, прыжки, обход препятствий.",
            en: "Movement — speed, jumps, obstacle handling.",
          },
          {
            ru: "Визуал — ESP, подсветка, интерфейс.",
            en: "Visuals — ESP, highlighting, interface.",
          },
          {
            ru: "Автоматизация — сценарии и упрощение рутины.",
            en: "Automation — scripts and routine simplification.",
          },
        ],
      },
      {
        heading: { ru: "Проверьте версию игры", en: "Check the game version" },
        paragraphs: [
          {
            ru: "В карточке конфига указана поддерживаемая версия Minecraft. Если вы играете на другой версии, модули могут не загрузиться или работать некорректно.",
            en: "The config card lists the supported Minecraft version. On a different version modules may fail to load or behave incorrectly.",
          },
        ],
        note: {
          ru: "Перед покупкой обновите страницу конфига: автор мог выпустить новую версию под свежий патч игры.",
          en: "Refresh the config page before buying: the author may have released a new version for the latest game patch.",
        },
      },
      {
        heading: { ru: "Посмотрите на автора и рейтинг", en: "Look at the author and rating" },
        bullets: [
          {
            ru: "Рейтинг и отзывы показывают, как конфиг ведёт себя в реальной игре.",
            en: "Ratings and reviews show how the config performs in real games.",
          },
          {
            ru: "Откройте профиль автора: сколько конфигов опубликовано и как давно он на площадке.",
            en: "Open the author's profile: how many configs they published and how long they've been around.",
          },
          {
            ru: "История версий и changelog — признак того, что автор поддерживает работу.",
            en: "Version history and changelog show that the author maintains the work.",
          },
        ],
      },
      {
        heading: { ru: "Сравните цену и состав", en: "Compare price and contents" },
        paragraphs: [
          {
            ru: "Дешёвый конфиг не всегда хуже дорогого: смотрите на список модулей и частоту обновлений. Наборы выгоднее, если вам нужно несколько конфигов одного автора.",
            en: "A cheaper config isn't always worse: check the module list and update frequency. Bundles are more economical if you need several configs from one author.",
          },
          {
            ru: "Все покупки сохраняются в разделе «Мои покупки» — скачать конфиг можно в любой момент, даже через месяц.",
            en: "All purchases are stored in “My purchases” — you can download a config at any time, even months later.",
          },
        ],
      },
      {
        heading: { ru: "Тестируйте по одному", en: "Test one at a time" },
        paragraphs: [
          {
            ru: "Не включайте несколько новых конфигов сразу. Если игра начнёт вылетать, вы не поймёте, какой из них виноват. Добавляйте по одному и проверяйте поведение клиента.",
            en: "Don't enable several new configs at once. If the game starts crashing, you won't know which one is at fault. Add them one by one and watch the client.",
          },
        ],
      },
    ],
  },
  {
    slug: "chto-delat-s-hwid",
    title: {
      ru: "Что делать с HWID: привязка и сброс",
      en: "HWID: binding and reset explained",
    },
    description: {
      ru: "Как работает привязка компьютера, когда нужен сброс HWID, сколько он стоит и что делать, если привязка не проходит.",
      en: "How computer binding works, when a HWID reset is needed, what it costs and what to do if binding fails.",
    },
    category: { ru: "Аккаунт", en: "Account" },
    readingMinutes: 5,
    updated: "2026-11-04",
    sections: [
      {
        heading: { ru: "Что такое HWID", en: "What HWID is" },
        paragraphs: [
          {
            ru: "HWID — аппаратный идентификатор компьютера. При первом запуске клиент запоминает его и привязывает к нему вашу подписку, чтобы ключом не могли пользоваться посторонние.",
            en: "HWID is a hardware identifier of your computer. On the first launch the client remembers it and binds your subscription so others can't use the key.",
          },
          {
            ru: "Одна подписка — одно активное устройство. Смена комплектующих или переустановка Windows может изменить идентификатор, и тогда потребуется сброс.",
            en: "One subscription — one active device. Changing hardware or reinstalling Windows may change the identifier, which then requires a reset.",
          },
        ],
      },
      {
        heading: { ru: "Когда нужен сброс", en: "When a reset is needed" },
        bullets: [
          {
            ru: "Вы купили новый компьютер или заменили материнскую плату.",
            en: "You bought a new PC or replaced the motherboard.",
          },
          {
            ru: "Переустановили Windows или полностью сменили диск.",
            en: "You reinstalled Windows or replaced the drive.",
          },
          {
            ru: "Клиент пишет, что устройство не совпадает, хотя вы играете на прежнем ПК.",
            en: "The client reports a device mismatch although you use the same PC.",
          },
        ],
        note: {
          ru: "Сброс не нужен при обычном обновлении драйверов, смене видеокарты и переустановке лаунчера.",
          en: "A reset isn't needed for regular driver updates, a GPU swap or launcher reinstallation.",
        },
      },
      {
        heading: { ru: "Как сбросить HWID", en: "How to reset HWID" },
        steps: [
          {
            ru: "Войдите в кабинет на сайте.",
            en: "Sign in to your dashboard.",
          },
          {
            ru: "Откройте раздел «Дополнения» (или «Действия»).",
            en: "Open the “Add-ons” section (or “Actions”).",
          },
          {
            ru: "Нажмите сброс HWID и подтвердите списание 150 ₽ с баланса.",
            en: "Click the HWID reset and confirm the 150 ₽ charge from your balance.",
          },
          {
            ru: "Запустите лаунчер заново — привязка произойдёт автоматически.",
            en: "Restart the launcher — binding happens automatically.",
          },
        ],
        paragraphs: [
          {
            ru: "Если на балансе недостаточно средств, пополните его промокодом или на странице тарифов, а затем повторите сброс. Сброс также можно оформить отдельным лотом на FunPay.",
            en: "If your balance is too low, top it up with a promo code or on the pricing page and repeat the reset. A reset can also be purchased as a separate FunPay lot.",
          },
        ],
      },
      {
        heading: { ru: "Если привязка не проходит", en: "If binding fails" },
        paragraphs: [
          {
            ru: "Убедитесь, что лаунчер запущен от администратора и вы вошли в тот же аккаунт, что и на сайте. Отключите VPN: резкая смена IP иногда мешает первичной привязке.",
            en: "Make sure the launcher runs as administrator and you signed in to the same account as on the website. Disable VPN: a sudden IP change can interfere with first-time binding.",
          },
          {
            ru: "Если ошибка осталась, напишите в поддержку. Приложите текст ошибки и дату последнего успешного запуска — так мы быстрее проверим привязку.",
            en: "If the error persists, contact support. Include the error text and the date of your last successful launch so we can check the binding faster.",
          },
        ],
      },
    ],
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((guide) => guide.slug === slug);
}
