import pool, { type DbExecutor, queryOne } from "./db";
import { sendMail } from "./email";
import { escapeHtml, renderEmail } from "./email-template";
import {
  categoryForType,
  emailAllowed,
  getNotificationSettings,
  type NotificationSettings,
} from "./notification-settings";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stellar-client.vercel.app";

export type NotificationInput = {
  type?: string;
  title: string;
  body?: string;
  link?: string;
};

export async function createNotification(
  userId: number,
  input: NotificationInput,
  db: DbExecutor = pool
) {
  await db.query(
    "INSERT INTO notifications (user_id, type, title, body, link) VALUES ($1, $2, $3, $4, $5)",
    [userId, input.type || "info", input.title, input.body || null, input.link || null]
  );
}

export async function emailUser(userId: number, subject: string, text: string, html?: string) {
  try {
    const user = (await queryOne("SELECT email FROM users WHERE id = $1", [userId])) as
      | { email?: string }
      | null;
    if (!user?.email) return;
    await sendMail(String(user.email), subject, text, html);
  } catch (e) {
    console.error("Notification email error:", e);
  }
}

async function sendNotificationEmail(userId: number, input: NotificationInput) {
  let settings: NotificationSettings | null = null;
  try {
    settings = await getNotificationSettings(userId);
  } catch {
    // Если настройки недоступны — письмо всё равно отправляем.
  }

  const category = categoryForType(input.type);
  if (settings && !emailAllowed(settings, category)) return;

  const linkUrl = input.link ? new URL(input.link, SITE_URL).toString() : null;
  const unsubscribeUrl =
    settings?.unsubscribe_token
      ? `${SITE_URL}/api/notifications/unsubscribe?token=${encodeURIComponent(
          settings.unsubscribe_token
        )}&category=${encodeURIComponent(category)}`
      : null;

  const bodyHtml = input.body
    ? `<p style="margin:0 0 8px;">${escapeHtml(input.body)}</p>`
    : "";

  const html = renderEmail({
    title: input.title,
    bodyHtml,
    linkUrl,
    linkLabel: "Открыть в кабинете",
    unsubscribeUrl,
  });

  const lines = [
    input.title,
    "",
    input.body || "",
    linkUrl ? `\nОткрыть: ${linkUrl}` : "",
    unsubscribeUrl ? `\nОтписаться от таких писем: ${unsubscribeUrl}` : "",
    "",
    "— Stellar Client",
  ];

  await emailUser(userId, `${input.title} — Stellar Client`, lines.join("\n"), html);
}

/** Письмо без создания уведомления в колокольчике (например, сводка по достижениям). */
export async function emailNotification(userId: number, input: NotificationInput) {
  try {
    await sendNotificationEmail(userId, input);
  } catch (e) {
    console.error("Notification email error:", e);
  }
}

/**
 * Создаёт уведомление в колокольчике и (опционально) дублирует его на почту.
 * Почтовые категории можно отключить в настройках уведомлений.
 */
export async function notifyUser(
  userId: number,
  input: NotificationInput,
  opts: { email?: boolean } = {}
) {
  await createNotification(userId, input);

  if (opts.email) {
    await emailNotification(userId, input);
  }
}
