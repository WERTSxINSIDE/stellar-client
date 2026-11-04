import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import {
  SITE_URL,
  escapeTelegramHtml,
  isValidWebhookSecret,
  sendTelegramMessage,
  telegramWebhookEnabled,
  verifyTelegramLinkToken,
} from "@/lib/telegram";
import {
  removeTelegramLinkByChat,
  saveTelegramLink,
} from "@/lib/telegram-links";

export const dynamic = "force-dynamic";

type TelegramUpdate = {
  message?: {
    chat?: { id?: number | string };
    from?: { username?: string };
    text?: string;
  };
};

const USAGE = [
  "Напишите боту команду из кабинета Stellar Client.",
  `Откройте ${SITE_URL}/dashboard → «Уведомления» → «Привязать Telegram» и перейдите по ссылке.`,
].join("\n");

/** Приём команд /start и /stop от Telegram Bot API. */
export async function POST(req: Request) {
  if (!telegramWebhookEnabled()) {
    return NextResponse.json({ ok: false, error: "Webhook не настроен" }, { status: 503 });
  }

  if (!isValidWebhookSecret(req.headers.get("x-telegram-bot-api-secret-token"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = (await req.json().catch(() => null)) as TelegramUpdate | null;
  const message = update?.message;
  const chatId = message?.chat?.id;
  if (!chatId) return NextResponse.json({ ok: true });

  const chat = String(chatId);
  const text = String(message?.text || "").trim();
  const command = text.split(/\s+/)[0].toLowerCase();

  if (command === "/start") {
    const token = text.split(/\s+/)[1] || "";
    const userId = verifyTelegramLinkToken(token);

    if (!userId) {
      await sendTelegramMessage(chat, USAGE);
      return NextResponse.json({ ok: true });
    }

    const user = (await queryOne(
      "SELECT id, username FROM users WHERE id = $1 AND COALESCE(banned, 0) = 0",
      [userId]
    )) as { id: number; username: string } | null;

    if (!user) {
      await sendTelegramMessage(chat, "Аккаунт не найден. Войдите на сайт и попробуйте снова.");
      return NextResponse.json({ ok: true });
    }

    await saveTelegramLink(userId, chat, message?.from?.username ?? null);
    await sendTelegramMessage(
      chat,
      [
        `✅ Telegram привязан к аккаунту <b>${escapeTelegramHtml(user.username)}</b>.`,
        "",
        "Теперь сюда будут приходить ответы поддержки и уведомления о новых конфигах.",
        `Отвязать: /stop или ${SITE_URL}/dashboard`,
      ].join("\n")
    );
    return NextResponse.json({ ok: true });
  }

  if (command === "/stop") {
    await removeTelegramLinkByChat(chat);
    await sendTelegramMessage(chat, "Уведомления отключены. Привязать снова можно из кабинета.");
    return NextResponse.json({ ok: true });
  }

  await sendTelegramMessage(chat, USAGE);
  return NextResponse.json({ ok: true });
}
