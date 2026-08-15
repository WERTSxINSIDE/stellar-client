import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

const MAX_GIFT_DAYS = 90;

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

    const giftDays = Number(days);
    if (!giftDays || giftDays < 1 || giftDays > MAX_GIFT_DAYS) {
      return NextResponse.json({ error: `Срок от 1 до ${MAX_GIFT_DAYS} дней` }, { status: 400 });
    }

    if (username.toLowerCase() === user.username.toLowerCase()) {
      return NextResponse.json({ error: "Нельзя подарить себе" }, { status: 400 });
    }

    const senderData = await queryOne("SELECT subscription_end FROM users WHERE id = $1", [user.id]) as any;
    const senderEnd = senderData?.subscription_end ? new Date(senderData.subscription_end.replace(" ", "T")) : null;
    const senderActive = senderEnd && senderEnd > new Date();

    if (!senderActive) {
      return NextResponse.json({ error: "У вас нет активной подписки" }, { status: 403 });
    }

    const recipient = await queryOne("SELECT id, subscription_end FROM users WHERE LOWER(username) = LOWER($1)", [username]) as any;
    if (!recipient) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    // Отнимаем дни у дарителя
    const newSenderEnd = new Date(senderEnd);
    newSenderEnd.setDate(newSenderEnd.getDate() - giftDays);
    const newSenderStr = newSenderEnd.toISOString().slice(0, 19).replace("T", " ");

    // Добавляем дни получателю
    let base: Date;
    if (recipient.subscription_end) {
      const current = new Date(recipient.subscription_end.replace(" ", "T"));
      base = current > new Date() ? current : new Date();
    } else {
      base = new Date();
    }
    base.setDate(base.getDate() + giftDays);
    const newRecipientStr = base.toISOString().slice(0, 19).replace("T", " ");

    await query("UPDATE users SET subscription_end = $1 WHERE id = $2", [newSenderStr, user.id]);
    await query("UPDATE users SET subscription_end = $1 WHERE id = $2", [newRecipientStr, recipient.id]);

    return NextResponse.json({ ok: true, subscription_end: newSenderStr });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
