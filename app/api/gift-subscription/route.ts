import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

const COOLDOWN_DAYS = 90;
const MAX_REGULAR_GIFT_DAYS = 7;
const MAX_LIFETIME_GIFT_DAYS = 30;
const LIFETIME_THRESHOLD_MS = 10 * 365 * 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { username, days } = await req.json();
    if (!username || !days) {
      return NextResponse.json({ error: "Укажите получателя и срок" }, { status: 400 });
    }

    if (username.toLowerCase() === user.username.toLowerCase()) {
      return NextResponse.json({ error: "Нельзя подарить себе" }, { status: 400 });
    }

    const senderData = await queryOne(
      "SELECT subscription_end, last_gift_at, sub_gifted FROM users WHERE id = $1",
      [user.id]
    ) as any;

    const senderEnd = senderData?.subscription_end
      ? new Date(String(senderData.subscription_end).replace(" ", "T"))
      : null;
    const now = new Date();
    const senderActive = senderEnd && senderEnd > now;
    const isLifetime = senderEnd && senderEnd.getTime() - now.getTime() > LIFETIME_THRESHOLD_MS;

    if (!isLifetime && !senderActive) {
      return NextResponse.json({ error: "У вас нет активной подписки" }, { status: 403 });
    }

    if (senderData?.sub_gifted) {
      return NextResponse.json({ error: "С подаренной подписки нельзя дарить" }, { status: 403 });
    }

    const giftDays = Number(days);
    const maxDays = isLifetime ? MAX_LIFETIME_GIFT_DAYS : MAX_REGULAR_GIFT_DAYS;
    if (!giftDays || giftDays < 1 || giftDays > maxDays) {
      return NextResponse.json({ error: `Срок от 1 до ${maxDays} дней` }, { status: 400 });
    }

    if (!isLifetime) {
      const remainingMs = senderEnd!.getTime() - now.getTime();
      const remainingDays = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
      if (giftDays > remainingDays) {
        return NextResponse.json({ error: "Недостаточно дней подписки" }, { status: 400 });
      }
    }

    const recipient = await queryOne(
      "SELECT id, subscription_end, sub_gifted FROM users WHERE LOWER(username) = LOWER($1)",
      [username]
    ) as any;
    if (!recipient) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    // Атомарная проверка кулдауна на уровне базы
    const claim = await query(
      `UPDATE users SET last_gift_at = NOW()
       WHERE id = $1 AND (last_gift_at IS NULL OR last_gift_at <= NOW() - INTERVAL '${COOLDOWN_DAYS} days')
       RETURNING id`,
      [user.id]
    );
    if (!claim.rows.length) {
      const cd = await queryOne(
        `SELECT CEIL(EXTRACT(EPOCH FROM (last_gift_at + INTERVAL '${COOLDOWN_DAYS} days' - NOW())) / 86400)::int AS days_left
         FROM users WHERE id = $1`,
        [user.id]
      ) as any;
      return NextResponse.json(
        { error: `Подарить можно раз в ${COOLDOWN_DAYS} дней. Следующая отправка через ${cd?.days_left ?? "?"} дн.` },
        { status: 403 }
      );
    }

    const recEnd = recipient.subscription_end
      ? new Date(String(recipient.subscription_end).replace(" ", "T"))
      : null;
    const recOwnActive = recEnd && recEnd > now && !recipient.sub_gifted;

    if (!isLifetime) {
      const newSenderEnd = new Date(senderEnd);
      newSenderEnd.setDate(newSenderEnd.getDate() - giftDays);
      const newSenderStr = newSenderEnd.toISOString().slice(0, 19).replace("T", " ");
      await query("UPDATE users SET subscription_end = $1 WHERE id = $2", [newSenderStr, user.id]);
    }

    let base: Date;
    if (recipient.subscription_end) {
      const current = new Date(String(recipient.subscription_end).replace(" ", "T"));
      base = current > now ? current : new Date();
    } else {
      base = new Date();
    }
    base.setDate(base.getDate() + giftDays);
    const newRecipientStr = base.toISOString().slice(0, 19).replace("T", " ");

    await query(
      "UPDATE users SET subscription_end = $1, sub_gifted = $2 WHERE id = $3",
      [newRecipientStr, recOwnActive ? 0 : 1, recipient.id]
    );

    return NextResponse.json({ ok: true, isLifetime });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
