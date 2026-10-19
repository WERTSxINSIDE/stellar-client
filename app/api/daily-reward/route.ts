import { NextResponse } from "next/server";
import { query, queryOne, addBalanceHistory } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const REWARDS: {
  day: number;
  type: "balance" | "subscription";
  amount?: number;
  days?: number;
  label: string;
}[] = [
  { day: 1, type: "balance", amount: 5, label: "5₽ на баланс" },
  { day: 2, type: "balance", amount: 5, label: "5₽ на баланс" },
  { day: 3, type: "subscription", days: 1, label: "1 день подписки" },
  { day: 4, type: "balance", amount: 5, label: "5₽ на баланс" },
  { day: 5, type: "balance", amount: 5, label: "5₽ на баланс" },
  { day: 6, type: "balance", amount: 5, label: "5₽ на баланс" },
  { day: 7, type: "subscription", days: 3, label: "3 дня подписки" },
];

function todayStr(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function formatDate(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 19);
}

async function saveClaim(userId: number, day: number, today: string) {
  await query(
    `INSERT INTO daily_rewards (user_id, streak_day, last_claim) VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET streak_day = $2, last_claim = $3`,
    [userId, day, today]
  );
}

// Какой день цикла сегодня: 1..7, забран ли уже сегодняшний, не завершён ли цикл
async function getState(userId: number) {
  const row = await queryOne(
    "SELECT streak_day, to_char(last_claim, 'YYYY-MM-DD') AS last_claim FROM daily_rewards WHERE user_id = $1",
    [userId]
  ) as { streak_day: number; last_claim: string | null } | undefined;

  if (!row) {
    return { day: 1, claimedToday: false, finished: false };
  }

  const last = row.last_claim || null;

  // Цикл уже пройден полностью — повторов нет
  if (row.streak_day >= 7) {
    return { day: 7, claimedToday: last === todayStr(), finished: true };
  }

  if (last === todayStr()) {
    return { day: row.streak_day, claimedToday: true, finished: false };
  }
  if (last === yesterdayStr()) {
    return { day: row.streak_day + 1, claimedToday: false, finished: false };
  }
  // пропуск дня — продолжаем с того же дня, без возврата к 1
  return { day: row.streak_day, claimedToday: false, finished: false };
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const state = await getState(user.id);
    return NextResponse.json({
      ok: true,
      day: state.day,
      claimedToday: state.claimedToday,
      finished: state.finished,
      rewards: REWARDS,
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const state = await getState(user.id);
    if (state.finished) {
      return NextResponse.json({ error: "Все награды уже получены" }, { status: 409 });
    }
    if (state.claimedToday) {
      return NextResponse.json({ error: "Награда за сегодня уже получена" }, { status: 409 });
    }

    const reward = REWARDS[state.day - 1];
    const today = todayStr();
    const nowFinished = reward.day >= 7;
    let message = "";

    if (reward.type === "balance") {
      const amount = reward.amount ?? 0;
      await query("UPDATE users SET balance = COALESCE(balance, 0) + $1 WHERE id = $2", [amount, user.id]);
      await addBalanceHistory(user.id, amount, "reward", `Ежедневная награда — день ${reward.day}`);
      const u = await queryOne("SELECT balance FROM users WHERE id = $1", [user.id]) as { balance: number };
      message = `+${amount}₽ на баланс`;
      await saveClaim(user.id, reward.day, today);
      return NextResponse.json({
        ok: true,
        day: reward.day,
        message,
        balance: u.balance,
        subscription_end: null,
        finished: nowFinished,
      });
    }

    // подписка
    const u = await queryOne("SELECT subscription_end FROM users WHERE id = $1", [user.id]) as { subscription_end: string | null };
    const now = new Date();
    let subEnd: Date;
    if (u.subscription_end) {
      const current = new Date(u.subscription_end.replace(" ", "T"));
      subEnd = current > now ? new Date(current) : new Date(now);
    } else {
      subEnd = new Date(now);
    }
    subEnd.setDate(subEnd.getDate() + (reward.days || 1));
    const newEnd = formatDate(subEnd);

    await query("UPDATE users SET subscription_end = $1, sub_gifted = 0 WHERE id = $2", [newEnd, user.id]);
    await saveClaim(user.id, reward.day, today);
    message = `+${reward.days} дн. подписки`;

    return NextResponse.json({
      ok: true,
      day: reward.day,
      message,
      balance: null,
      subscription_end: newEnd,
      finished: nowFinished,
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
