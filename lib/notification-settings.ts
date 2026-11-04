import crypto from "crypto";
import { query, queryOne } from "./db";

export type NotificationCategory = "security" | "referral" | "support" | "achievements" | "other";

export const NOTIFICATION_CATEGORIES: {
  key: NotificationCategory;
  label: string;
  labelEn: string;
  description: string;
  descriptionEn: string;
}[] = [
  {
    key: "security",
    label: "Безопасность",
    labelEn: "Security",
    description: "Вход с нового устройства, смена пароля и другие действия с аккаунтом.",
    descriptionEn: "New device sign-ins, password changes and other account actions.",
  },
  {
    key: "referral",
    label: "Бонусы и рефералка",
    labelEn: "Bonuses and referrals",
    description: "Начисления за приглашённых, реферальные проценты и промокоды.",
    descriptionEn: "Rewards for invited friends, referral percentages and promo codes.",
  },
  {
    key: "support",
    label: "Поддержка",
    labelEn: "Support",
    description: "Ответы сотрудников в ваших тикетах.",
    descriptionEn: "Staff replies in your tickets.",
  },
  {
    key: "achievements",
    label: "Достижения",
    labelEn: "Achievements",
    description: "Новые открытые достижения.",
    descriptionEn: "Newly unlocked achievements.",
  },
  {
    key: "other",
    label: "Партнёрам и медиа",
    labelEn: "Partners and media",
    description: "Решения по видео, заявкам и другие события.",
    descriptionEn: "Video and application decisions and other events.",
  },
];

export type NotificationSettings = {
  user_id: number;
  email_security: boolean;
  email_referral: boolean;
  email_support: boolean;
  email_achievements: boolean;
  email_other: boolean;
  unsubscribe_token: string;
};

type SettingsRow = {
  user_id: number;
  email_security: number;
  email_referral: number;
  email_support: number;
  email_achievements: number;
  email_other: number;
  unsubscribe_token: string | null;
};

export function categoryForType(type?: string | null): NotificationCategory {
  switch (type) {
    case "security":
      return "security";
    case "referral":
    case "referral_key":
    case "promo":
      return "referral";
    case "support":
      return "support";
    case "achievement":
      return "achievements";
    default:
      return "other";
  }
}

function mapRow(row: SettingsRow): NotificationSettings {
  return {
    user_id: Number(row.user_id),
    email_security: !!row.email_security,
    email_referral: !!row.email_referral,
    email_support: !!row.email_support,
    email_achievements: !!row.email_achievements,
    email_other: !!row.email_other,
    unsubscribe_token: String(row.unsubscribe_token || ""),
  };
}

/** Возвращает настройки, создавая строку с токеном отписки при первом обращении. */
export async function getNotificationSettings(userId: number): Promise<NotificationSettings> {
  await query(
    `INSERT INTO notification_settings (user_id, unsubscribe_token)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, crypto.randomBytes(24).toString("hex")]
  );

  const row = (await queryOne(
    `SELECT user_id, email_security, email_referral, email_support,
            email_achievements, email_other, unsubscribe_token
     FROM notification_settings WHERE user_id = $1`,
    [userId]
  )) as SettingsRow | null;

  if (row) {
    if (!row.unsubscribe_token) {
      const token = crypto.randomBytes(24).toString("hex");
      await query("UPDATE notification_settings SET unsubscribe_token = $1 WHERE user_id = $2", [
        token,
        userId,
      ]);
      row.unsubscribe_token = token;
    }
    return mapRow(row);
  }

  return {
    user_id: userId,
    email_security: true,
    email_referral: true,
    email_support: true,
    email_achievements: true,
    email_other: true,
    unsubscribe_token: "",
  };
}

export function emailAllowed(settings: NotificationSettings, category: NotificationCategory): boolean {
  return !!settings[`email_${category}` as keyof NotificationSettings];
}

/** Обновляет только переданные категории. Возвращает актуальные настройки. */
export async function updateNotificationSettings(
  userId: number,
  patch: Partial<Record<NotificationCategory, boolean>>
): Promise<NotificationSettings> {
  await getNotificationSettings(userId);

  const columns: string[] = [];
  const values: unknown[] = [];

  for (const category of NOTIFICATION_CATEGORIES) {
    if (patch[category.key] === undefined) continue;
    values.push(patch[category.key] ? 1 : 0);
    columns.push(`email_${category.key} = $${values.length}`);
  }

  if (columns.length) {
    values.push(userId);
    await query(
      `UPDATE notification_settings SET ${columns.join(", ")}, updated_at = NOW()
       WHERE user_id = $${values.length}`,
      values
    );
  }

  return getNotificationSettings(userId);
}

/** Отписка по токену из письма. category = "all" отключает все письма. */
export async function unsubscribeByToken(
  token: string,
  category: string
): Promise<{ ok: boolean; category: string }> {
  const row = (await queryOne(
    "SELECT user_id FROM notification_settings WHERE unsubscribe_token = $1",
    [token]
  )) as { user_id: number } | null;

  if (!row) return { ok: false, category: "all" };

  if (category === "all" || !NOTIFICATION_CATEGORIES.some((c) => c.key === category)) {
    await query(
      `UPDATE notification_settings
       SET email_security = 0, email_referral = 0, email_support = 0,
           email_achievements = 0, email_other = 0, updated_at = NOW()
       WHERE user_id = $1`,
      [row.user_id]
    );
    return { ok: true, category: "all" };
  }

  await query(
    `UPDATE notification_settings SET email_${category} = 0, updated_at = NOW() WHERE user_id = $1`,
    [row.user_id]
  );
  return { ok: true, category };
}
