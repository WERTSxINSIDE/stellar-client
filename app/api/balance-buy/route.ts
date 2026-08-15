import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, queryOne, addBalanceHistory } from "@/lib/db";

export const dynamic = "force-dynamic";

const PRICES: Record<number, number> = {
  1: 10,
  3: 20,
  7: 55,
  30: 130,
  90: 250,
  180: 400,
  999999: 300,
};

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { days } = await req.json();
    if (!days) {
      return NextResponse.json({ error: "Укажите тариф" }, { status: 400 });
    }

    const price = PRICES[days];
    if (!price) {
      return NextResponse.json({ error: "Неизвестный тариф" }, { status: 400 });
    }

    const userData = await queryOne("SELECT balance, subscription_end FROM users WHERE id = $1", [user.id]) as any;
    if (!userData) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    if ((userData.balance || 0) < price) {
      return NextResponse.json({ error: `Недостаточно баланса. Нужно ${price}₽, у вас ${userData.balance || 0}₽` }, { status: 400 });
    }

    let base: Date;
    if (userData.subscription_end) {
      const current = new Date(userData.subscription_end.replace(" ", "T"));
      base = current > new Date() ? current : new Date();
    } else {
      base = new Date();
    }
    base.setDate(base.getDate() + days);
    const newEnd = base.toISOString().slice(0, 19).replace("T", " ");

    await query("UPDATE users SET balance = balance - $1, subscription_end = $2 WHERE id = $3", [price, newEnd, user.id]);
    await addBalanceHistory(user.id, -price, "subscription", `Покупка подписки на ${days} дн.`);

    return NextResponse.json({ ok: true, balance: (userData.balance || 0) - price, subscription_end: newEnd });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}