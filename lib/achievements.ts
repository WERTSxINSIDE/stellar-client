export type AchievementCategory = "start" | "money" | "activity" | "social" | "loyalty";

export type AchievementRarity = "common" | "rare" | "epic" | "legendary";

export type AchievementUnit = "count" | "rub" | "seconds" | "days";

export type AchievementStats = {
  totalSpent: number;
  purchases: number;
  transfersSent: number;
  wheelWins: number;
  dailyClaims: number;
  dailyStreak: number;
  playSeconds: number;
  reviews: number;
  mediaApproved: number;
  partnerApproved: number;
  bugs: number;
  tickets: number;
  hwidResets: number;
  subscriptionDaysLeft: number;
  hadSubscription: boolean;
  isLifetime: boolean;
  accountAgeDays: number;
};

export type Achievement = {
  key: string;
  title: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  unit: AchievementUnit;
  target: number;
  getProgress: (stats: AchievementStats) => number;
};

export type ComputedAchievement = Omit<Achievement, "getProgress"> & {
  progress: number;
  unlocked: boolean;
};

function make(
  key: string,
  title: string,
  description: string,
  icon: string,
  category: AchievementCategory,
  rarity: AchievementRarity,
  unit: AchievementUnit,
  target: number,
  getProgress: (stats: AchievementStats) => number
): Achievement {
  return { key, title, description, icon, category, rarity, unit, target, getProgress };
}

export const ACHIEVEMENTS: Achievement[] = [
  // Старт
  make("welcome", "В клубе", "Создать аккаунт в Stellar Client", "🎉", "start", "common", "count", 1, () => 1),
  make("account_30", "С нами месяц", "Провести в клубе 30 дней", "📅", "start", "rare", "days", 30, (s) => s.accountAgeDays),

  // Покупки в клиенте
  make("first_purchase", "Первый заказ", "Купить подписку или сброс HWID", "🛒", "money", "common", "count", 1, (s) => s.purchases),
  make("spent_500", "Покупатель", "Купить вещей в клиенте на 500 ₽", "🧾", "money", "rare", "rub", 500, (s) => s.totalSpent),
  make("spent_1000", "Постоянный клиент", "Купить вещей в клиенте на 1 000 ₽", "💎", "money", "epic", "rub", 1000, (s) => s.totalSpent),
  make("spent_2500", "Крупный заказ", "Купить вещей в клиенте на 2 500 ₽", "🏦", "money", "legendary", "rub", 2500, (s) => s.totalSpent),
  make("purchases_5", "Коллекционер", "Сделать 5 покупок в клиенте", "🛍️", "money", "rare", "count", 5, (s) => s.purchases),
  make("first_transfer", "Щедрая душа", "Перевести деньги другому игроку", "🤝", "money", "common", "count", 1, (s) => s.transfersSent),

  // Активность
  make("first_spin", "Испытай удачу", "Выиграть приз в колесе фортуны", "🎰", "activity", "common", "count", 1, (s) => s.wheelWins),
  make("lucky_10", "Любимчик фортуны", "Получить 10 призов из колеса", "🍀", "activity", "epic", "count", 10, (s) => s.wheelWins),
  make("daily_3", "Три дня подряд", "Забрать ежедневную награду 3 раза", "🔥", "activity", "rare", "days", 3, (s) => s.dailyStreak),
  make("daily_7", "Неделя дисциплины", "Пройти полный цикл ежедневных наград", "🗓️", "activity", "epic", "days", 7, (s) => s.dailyStreak),
  make("play_1h", "Первый шаг", "Провести в клиенте 1 час", "⏱️", "activity", "common", "seconds", 3600, (s) => s.playSeconds),
  make("play_10h", "Вкус азарта", "Провести в клиенте 10 часов", "🕹️", "activity", "rare", "seconds", 36000, (s) => s.playSeconds),
  make("play_100h", "Опытный боец", "Провести в клиенте 100 часов", "🏆", "activity", "epic", "seconds", 360000, (s) => s.playSeconds),
  make("play_1000h", "Закалённый ветеран", "Провести в клиенте 1 000 часов", "🌙", "activity", "legendary", "seconds", 3600000, (s) => s.playSeconds),
  make("play_2500h", "Гроссмейстер", "Провести в клиенте 2 500 часов", "🚀", "activity", "legendary", "seconds", 9000000, (s) => s.playSeconds),
  make("play_5000h", "Живая легенда", "Провести в клиенте 5 000 часов", "🛸", "activity", "legendary", "seconds", 18000000, (s) => s.playSeconds),
  make("play_10000h", "Высшая лига", "Провести в клиенте 10 000 часов", "🌌", "activity", "legendary", "seconds", 36000000, (s) => s.playSeconds),
  make("play_15000h", "Абсолютный чемпион", "Провести в клиенте 15 000 часов", "🌠", "activity", "legendary", "seconds", 54000000, (s) => s.playSeconds),
  make("play_20000h", "Вне конкуренции", "Провести в клиенте 20 000 часов", "💫", "activity", "legendary", "seconds", 72000000, (s) => s.playSeconds),
  make("hwid_reset", "Новое железо", "Сбросить HWID", "🔧", "activity", "common", "count", 1, (s) => s.hwidResets),

  // Лояльность
  make("sub_active", "Подписка активна", "Активировать подписку", "⭐", "loyalty", "common", "count", 1, (s) => (s.hadSubscription ? 1 : 0)),
  make("sub_30", "Месяц в строю", "Иметь 30+ дней активной подписки", "🛡️", "loyalty", "rare", "days", 30, (s) => s.subscriptionDaysLeft),
  make("lifetime", "Навсегда", "Получить вечную подписку", "👑", "loyalty", "legendary", "count", 1, (s) => (s.isLifetime ? 1 : 0)),

  // Сообщество
  make("first_review", "Есть мнение", "Оставить отзыв о клиенте", "✍️", "social", "common", "count", 1, (s) => s.reviews),
  make("first_bug", "Багрепортер", "Отправить первый баг-репорт", "🐞", "social", "common", "count", 1, (s) => s.bugs),
  make("bug_5", "Охотник за багами", "Отправить 5 баг-репортов", "🔎", "social", "rare", "count", 5, (s) => s.bugs),
  make("first_ticket", "На связи", "Создать обращение в поддержку", "🎫", "social", "common", "count", 1, (s) => s.tickets),
  make("media_first", "Контент-мейкер", "Получить одобрение первого видео", "🎬", "social", "rare", "count", 1, (s) => s.mediaApproved),
  make("media_5", "Медиа-звезда", "Получить одобрение 5 видео", "🌟", "social", "epic", "count", 5, (s) => s.mediaApproved),
  make("partner", "Партнёр", "Стать партнёром Stellar Client", "🤵", "social", "epic", "count", 1, (s) => s.partnerApproved),
];

export const ACHIEVEMENT_EN: Record<string, { title: string; description: string }> = {
  welcome: { title: "In the club", description: "Create a Stellar Client account" },
  account_30: { title: "One month with us", description: "Spend 30 days in the club" },

  first_purchase: { title: "First order", description: "Buy a subscription or an HWID reset" },
  spent_500: { title: "Shopper", description: "Buy 500 ₽ worth of items in the client" },
  spent_1000: { title: "Regular customer", description: "Buy 1,000 ₽ worth of items in the client" },
  spent_2500: { title: "Big spender", description: "Buy 2,500 ₽ worth of items in the client" },
  purchases_5: { title: "Collector", description: "Make 5 purchases in the client" },
  first_transfer: { title: "Generous soul", description: "Transfer money to another player" },

  first_spin: { title: "Try your luck", description: "Win a prize on the wheel of fortune" },
  lucky_10: { title: "Fortune's favourite", description: "Win 10 prizes from the wheel" },
  daily_3: { title: "Three days in a row", description: "Claim the daily reward 3 times" },
  daily_7: { title: "Week of discipline", description: "Complete a full cycle of daily rewards" },
  play_1h: { title: "First step", description: "Spend 1 hour in the client" },
  play_10h: { title: "Taste for the game", description: "Spend 10 hours in the client" },
  play_100h: { title: "Seasoned fighter", description: "Spend 100 hours in the client" },
  play_1000h: { title: "Battle-hardened veteran", description: "Spend 1,000 hours in the client" },
  play_2500h: { title: "Grandmaster", description: "Spend 2,500 hours in the client" },
  play_5000h: { title: "Living legend", description: "Spend 5,000 hours in the client" },
  play_10000h: { title: "Top league", description: "Spend 10,000 hours in the client" },
  play_15000h: { title: "Absolute champion", description: "Spend 15,000 hours in the client" },
  play_20000h: { title: "Beyond competition", description: "Spend 20,000 hours in the client" },
  hwid_reset: { title: "New hardware", description: "Reset your HWID" },

  sub_active: { title: "Subscription active", description: "Activate a subscription" },
  sub_30: { title: "A month in the ranks", description: "Have 30+ days of active subscription" },
  lifetime: { title: "Forever", description: "Get a lifetime subscription" },

  first_review: { title: "Have a say", description: "Leave a review about the client" },
  first_bug: { title: "Bug reporter", description: "Submit your first bug report" },
  bug_5: { title: "Bug hunter", description: "Submit 5 bug reports" },
  first_ticket: { title: "In touch", description: "Create a support ticket" },
  media_first: { title: "Content maker", description: "Get your first video approved" },
  media_5: { title: "Media star", description: "Get 5 videos approved" },
  partner: { title: "Partner", description: "Become a Stellar Client partner" },
};

/** English copy for an achievement, or null when the language is RU / key is unknown. */
export function achievementEn(
  key: string
): { title: string; description: string } | null {
  return ACHIEVEMENT_EN[key] ?? null;
}

export function computeAchievements(stats: AchievementStats): ComputedAchievement[] {
  return ACHIEVEMENTS.map(({ getProgress, ...meta }) => {
    const value = Math.max(0, Math.floor(getProgress(stats)));
    return {
      ...meta,
      progress: Math.min(value, meta.target),
      unlocked: value >= meta.target,
    };
  });
}
