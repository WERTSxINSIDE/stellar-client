import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { withTransaction } from "@/lib/db";

export const dynamic = "force-dynamic";

const COOLDOWN_DAYS = 90;
const MAX_REGULAR_GIFT_DAYS = 7;
const MAX_LIFETIME_GIFT_DAYS = 30;
const LIFETIME_THRESHOLD_MS = 10 * 365 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { username, days } = await req.json();
    if (!username || days === undefined || days === null) {
      return NextResponse.json({ error: "Укажите получателя и срок" }, { status: 400 });
    }

    if (String(username).toLowerCase() === user.username.toLowerCase()) {
      return NextResponse.json({ error: "Нельзя подарить себе" }, { status: 400 });
    }

    const result = await withTransaction(async (client) => {
      // Блокируем отправителя и получателя в стабильном порядке, чтобы
      // одновременные подарки не потеряли изменения и не создали дедлок.
      const locked = await client.query(
        `SELECT id, username, subscription_end, last_gift_at, sub_gifted
         FROM users
         WHERE id = $1 OR LOWER(username) = LOWER($2)
         ORDER BY id
         FOR UPDATE`,
        [user.id, String(username)]
      );

      const sender = locked.rows.find((row) => row.id === user.id);
      const recipient = locked.rows.find((row) => row.id !== user.id);

      if (!sender) {
        return { error: "Пользователь не найден", status: 404 } as const;
      }

      const now = new Date();
      const senderEnd = toDate(sender.subscription_end);
      const senderActive = !!senderEnd && senderEnd > now;
      const isLifetime =
        !!senderEnd && senderEnd.getTime() - now.getTime() > LIFETIME_THRESHOLD_MS;

      if (!isLifetime && !senderActive) {
        return { error: "У вас нет активной подписки", status: 403 } as const;
      }

      if (sender.sub_gifted) {
        return { error: "С подаренной подписки нельзя дарить", status: 403 } as const;
      }

      const giftDays = Number(days);
      const maxDays = isLifetime ? MAX_LIFETIME_GIFT_DAYS : MAX_REGULAR_GIFT_DAYS;
      if (!Number.isInteger(giftDays) || giftDays < 1 || giftDays > maxDays) {
        return { error: `Срок от 1 до ${maxDays} дней`, status: 400 } as const;
      }

      if (!isLifetime) {
        const remainingDays = Math.floor((senderEnd!.getTime() - now.getTime()) / DAY_MS);
        if (giftDays > remainingDays) {
          return { error: "Недостаточно дней подписки", status: 400 } as const;
        }
      }

      if (!recipient) {
        return { error: "Пользователь не найден", status: 404 } as const;
      }

      // Кулдаун проверяем под блокировкой строки отправителя.
      const lastGift = toDate(sender.last_gift_at);
      if (lastGift) {
        const readyAt = lastGift.getTime() + COOLDOWN_DAYS * DAY_MS;
        if (readyAt > now.getTime()) {
          const daysLeft = Math.ceil((readyAt - now.getTime()) / DAY_MS);
          return {
            error: `Подарить можно раз в ${COOLDOWN_DAYS} дней. Следующая отправка через ${daysLeft} дн.`,
            status: 403,
          } as const;
        }
      }

      if (!isLifetime) {
        const newSenderEnd = new Date(senderEnd!);
        newSenderEnd.setDate(newSenderEnd.getDate() - giftDays);
        const newSenderStr = newSenderEnd.toISOString().slice(0, 19).replace("T", " ");
        await client.query(
          "UPDATE users SET subscription_end = $1, last_gift_at = NOW() WHERE id = $2",
          [newSenderStr, user.id]
        );
      } else {
        await client.query("UPDATE users SET last_gift_at = NOW() WHERE id = $1", [user.id]);
      }

      const recipientEnd = toDate(recipient.subscription_end);
      const recipientOwnActive = !!recipientEnd && recipientEnd > now && !recipient.sub_gifted;

      const base = recipientEnd && recipientEnd > now ? recipientEnd : new Date(now);
      base.setDate(base.getDate() + giftDays);
      const newRecipientStr = base.toISOString().slice(0, 19).replace("T", " ");

      await client.query(
        "UPDATE users SET subscription_end = $1, sub_gifted = $2 WHERE id = $3",
        [newRecipientStr, recipientOwnActive ? 0 : 1, recipient.id]
      );

      return { ok: true, isLifetime } as const;
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true, isLifetime: result.isLifetime });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
