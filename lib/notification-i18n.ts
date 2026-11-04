import { ACHIEVEMENTS, ACHIEVEMENT_EN } from "./achievements";
import type { Lang } from "./i18n";

/**
 * Уведомления хранятся в БД на русском (они же уходят в письма),
 * поэтому в EN-интерфейсе переводим их на клиенте по шаблонам.
 */
export type NotificationLike = {
  type: string;
  title: string;
  body: string | null;
};

const ACH_TITLE_EN = new Map(
  ACHIEVEMENTS.map((a) => [a.title, ACHIEVEMENT_EN[a.key]?.title ?? a.title])
);
const ACH_DESC_EN = new Map(
  ACHIEVEMENTS.map((a) => [a.description, ACHIEVEMENT_EN[a.key]?.description ?? a.description])
);

function translateAchievementTitle(title: string) {
  return ACH_TITLE_EN.get(title) ?? title;
}

function translateAchievementList(list: string) {
  return list
    .split(", ")
    .map((part) => translateAchievementTitle(part))
    .join(", ");
}

export function localizeNotification(
  item: NotificationLike,
  lang: Lang
): { title: string; body: string | null } {
  if (lang !== "en") return { title: item.title, body: item.body };

  const title = item.title;
  const body = item.body ?? "";
  let match: RegExpMatchArray | null = null;

  // Достижения
  if (title.startsWith("Достижение: ")) {
    return {
      title: `Achievement: ${translateAchievementTitle(title.slice("Достижение: ".length))}`,
      body: ACH_DESC_EN.get(body) ?? body,
    };
  }
  match = title.match(/^Открыто достижений: (\d+)$/);
  if (match) {
    return {
      title: `Achievements unlocked: ${match[1]}`,
      body: translateAchievementList(body),
    };
  }

  // Безопасность
  if (title === "Вход с нового устройства") {
    return {
      title: "New device sign-in",
      body: body.replace(
        "Если это были не вы — смените пароль и завершите сессии в разделе «Безопасность».",
        "If this wasn't you, change your password and end sessions in the Security section."
      ),
    };
  }
  if (title === "Пароль изменён") {
    return {
      title: "Password changed",
      body:
        "Your account password was changed and all sessions were ended. If this wasn't you, contact support.",
    };
  }

  // Рефералы
  match = title.match(/^\+(\d+) ₽ реферальных$/);
  if (match) {
    return {
      title: `+${match[1]} ₽ in referral bonuses`,
      body: body.replace(
        /^(.*) активировал ключ, вам начислено 15% от его стоимости\.$/,
        "$1 activated a key, you received 15% of its price."
      ),
    };
  }
  match = title.match(/^\+(\d+) ₽ за приглашённого$/);
  if (match) {
    return {
      title: `+${match[1]} ₽ for an invited friend`,
      body: body.replace(
        /^(.*) зарегистрировался по вашей реферальной ссылке\.$/,
        "$1 signed up using your referral link."
      ),
    };
  }
  match = title.match(/^\+(\d+) ₽ за приглашения$/);
  if (match) {
    return {
      title: `+${match[1]} ₽ for invitations`,
      body: body.replace(
        /^Вы пригласили ещё (\d+) человек — бонус за ступень начислен\.$/,
        "You invited $1 more people — the milestone bonus has been credited."
      ),
    };
  }

  // Промокоды
  match = title.match(/^\+(\d+) ₽ по промокоду$/);
  if (match) {
    return {
      title: `+${match[1]} ₽ from a promo code`,
      body: body.replace(
        /^Промокод (.+) активирован, бонус зачислен на баланс\.$/,
        "Promo code $1 has been activated, the bonus is credited to your balance."
      ),
    };
  }

  // Витрина
  if (title === "Материал принят") {
    match = body.match(/^«(.+)» опубликован в витрине\. На баланс начислено (\d+) ₽\.$/);
    if (match) {
      return {
        title: "Submission accepted",
        body: `“${match[1]}” has been published in the showcase. ${match[2]} ₽ has been credited to your balance.`,
      };
    }
    match = body.match(/^«(.+)» опубликован в витрине\.$/);
    if (match) {
      return {
        title: "Submission accepted",
        body: `“${match[1]}” has been published in the showcase.`,
      };
    }
    return { title: "Submission accepted", body };
  }
  if (title === "Материал отклонён") {
    match = body.match(/^«(.+)» не принят\. Причина: (.*)$/);
    if (match) {
      return {
        title: "Submission declined",
        body: `“${match[1]}” was declined. Reason: ${match[2]}`,
      };
    }
    match = body.match(/^«(.+)» не принят модератором\.$/);
    if (match) {
      return {
        title: "Submission declined",
        body: `“${match[1]}” was declined by a moderator.`,
      };
    }
    return { title: "Submission declined", body };
  }
  if (title === "Ваш конфиг купили") {
    match = body.match(/^«(.+)» купили за (\d+) ₽\. На баланс зачислено (\d+) ₽\.$/);
    if (match) {
      return {
        title: "Your config was purchased",
        body: `“${match[1]}” was purchased for ${match[2]} ₽. ${match[3]} ₽ has been credited to your balance.`,
      };
    }
    return { title: "Your config was purchased", body };
  }
  if (title === "Покупка конфига") {
    match = body.match(/^«(.+)» куплен за (\d+) ₽\. Скачать можно на странице конфига\.$/);
    if (match) {
      return {
        title: "Config purchase",
        body: `“${match[1]}” was purchased for ${match[2]} ₽. You can download it on the config page.`,
      };
    }
    return { title: "Config purchase", body };
  }

  // Медиа
  if (title === "Видео одобрено") {
    match = body.match(/^Награда (\d+) ₽ зачислена на баланс\.$/);
    if (match) {
      return {
        title: "Video approved",
        body: `A reward of ${match[1]} ₽ has been credited to your balance.`,
      };
    }
    if (body === "Ваше видео прошло проверку.") {
      return { title: "Video approved", body: "Your video passed review." };
    }
    return { title: "Video approved", body };
  }
  if (title === "Видео отклонено") {
    if (body === "Заявка не прошла проверку. Можно отправить новое видео.") {
      return {
        title: "Video declined",
        body: "The submission did not pass review. You can submit a new video.",
      };
    }
    return { title: "Video declined", body };
  }

  // Партнёрство
  if (title === "Заявка партнёра одобрена") {
    return {
      title: "Partner application approved",
      body:
        body === "Вам открыт медиа-раздел. Загружайте видео и получайте награды."
          ? "The media section is now open to you. Upload videos and earn rewards."
          : body,
    };
  }
  if (title === "Заявка партнёра отклонена") {
    return {
      title: "Partner application declined",
      body:
        body === "Вы можете подать заявку снова позже."
          ? "You can apply again later."
          : body,
    };
  }

  // Поддержка: тело — текст сообщения администратора, его не переводим.
  if (title === "Ответ поддержки") {
    return { title: "Support reply", body: item.body };
  }

  return { title: item.title, body: item.body };
}
