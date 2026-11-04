import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  createTelegramLinkToken,
  getBotUsername,
  telegramEnabled,
} from "@/lib/telegram";
import { getTelegramLink, removeTelegramLink } from "@/lib/telegram-links";

export const dynamic = "force-dynamic";

/** Статус привязки Telegram для текущего пользователя. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const link = await getTelegramLink(user.id);

    return NextResponse.json({
      ok: true,
      enabled: telegramEnabled(),
      linked: Boolean(link),
      username: link?.username ?? null,
      linked_at: link?.linked_at ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

/** Возвращает deep-link на привязку чата. */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    if (!telegramEnabled()) {
      return NextResponse.json(
        { error: "Telegram-уведомления пока не настроены" },
        { status: 503 }
      );
    }

    const botUsername = await getBotUsername();
    if (!botUsername) {
      return NextResponse.json(
        { error: "Не удалось получить имя бота" },
        { status: 503 }
      );
    }

    const token = createTelegramLinkToken(user.id);
    return NextResponse.json({
      ok: true,
      url: `https://t.me/${botUsername}?start=${encodeURIComponent(token)}`,
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

/** Отвязывает Telegram от аккаунта. */
export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    await removeTelegramLink(user.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
