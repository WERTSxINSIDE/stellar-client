import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, queryOne, addBalanceHistory } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { username, amount } = await req.json();
    if (!username || !amount) {
      return NextResponse.json({ error: "Укажите получателя и сумму" }, { status: 400 });
    }

    if (amount < 1) {
      return NextResponse.json({ error: "Минимум 1₽" }, { status: 400 });
    }

    if (username.toLowerCase() === user.username.toLowerCase()) {
      return NextResponse.json({ error: "Нельзя переводить себе" }, { status: 400 });
    }

    const senderData = await queryOne("SELECT balance FROM users WHERE id = $1", [user.id]) as any;
    if (!senderData || (senderData.balance || 0) < amount) {
      return NextResponse.json({ error: `Недостаточно баланса. У вас ${senderData?.balance || 0}₽` }, { status: 400 });
    }

    const recipient = await queryOne("SELECT id FROM users WHERE LOWER(username) = LOWER($1)", [username]) as any;
    if (!recipient) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    await query("UPDATE users SET balance = balance - $1 WHERE id = $2", [amount, user.id]);
    await query("UPDATE users SET balance = balance + $1 WHERE id = $2", [amount, recipient.id]);
    await addBalanceHistory(user.id, -amount, "transfer", `Перевод: ${recipient.username}`);
    await addBalanceHistory(recipient.id, amount, "transfer", `Перевод от: ${user.username}`);

    return NextResponse.json({ ok: true, balance: (senderData.balance || 0) - amount });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}