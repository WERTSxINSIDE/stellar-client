/**
 * Ежедневные квесты. Награда — только SC, без рублей и косметики.
 * Прогресс считается на сервере по реальным действиям за текущий день.
 */
export type QuestUnit = "count" | "seconds";

export type QuestTemplate = {
  key: string;
  titleRu: string;
  titleEn: string;
  descRu: string;
  descEn: string;
  icon: string;
  reward: number;
  target: number;
  unit: QuestUnit;
  requiresClan?: boolean;
};

export const DAILY_QUESTS: QuestTemplate[] = [
  {
    key: "login",
    titleRu: "Зайти в кабинет",
    titleEn: "Visit the dashboard",
    descRu: "Открыть личный кабинет сегодня.",
    descEn: "Open your dashboard today.",
    icon: "🌙",
    reward: 5,
    target: 1,
    unit: "count",
  },
  {
    key: "play_30",
    titleRu: "Полчаса в игре",
    titleEn: "Half an hour in game",
    descRu: "Провести 30 минут в клиенте.",
    descEn: "Spend 30 minutes in the client.",
    icon: "🎮",
    reward: 15,
    target: 30 * 60,
    unit: "seconds",
  },
  {
    key: "play_60",
    titleRu: "Час в игре",
    titleEn: "One hour in game",
    descRu: "Провести 60 минут в клиенте.",
    descEn: "Spend 60 minutes in the client.",
    icon: "🕹️",
    reward: 25,
    target: 60 * 60,
    unit: "seconds",
  },
  {
    key: "daily_reward",
    titleRu: "Ежедневная награда",
    titleEn: "Daily reward",
    descRu: "Забрать ежедневную награду.",
    descEn: "Claim the daily reward.",
    icon: "🎁",
    reward: 10,
    target: 1,
    unit: "count",
  },
  {
    key: "clan_chat",
    titleRu: "Слово в клан",
    titleEn: "A word to the clan",
    descRu: "Написать сообщение в клановый чат.",
    descEn: "Send a message to the clan chat.",
    icon: "💬",
    reward: 10,
    target: 1,
    unit: "count",
    requiresClan: true,
  },
];
