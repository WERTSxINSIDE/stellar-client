import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addBalanceHistory, queryOne, withTransaction } from "@/lib/db";

export const dynamic = "force-dynamic";

const COOLDOWN_HOURS = 72;

export type Prize = {
  key: string;
  label: string;
  weight: number;
  kind: "sub" | "hwid" | "balance";
  hours?: number;
  days?: number;
  amount?: number;
};

export const PRIZES: Prize[] = [
  { key: "sub_1h", label: "1 час подписки", weight: 70, kind: "sub", hours: 1 },
  { key: "sub_3h", label: "3 часа подписки", weight: 16, kind: "sub", hours: 3 },
  { key: "sub_6h", label: "6 часов подписки", weight: 13, kind: "sub", hours: 6 },
  { key: "sub_12h", label: "12 часов подписки", weight: 10, kind: "sub", hours: 12 },
  { key: "sub_1d", label: "1 день подписки", weight: 7, kind: "sub", days: 1 },
  { key: "balance_5", label: "+5 ₽", weight: 6, kind: "balance", amount: 5 },
  { key: "hwid", label: "Сброс HWID", weight: 4, kind: "hwid" },
  { key: "balance_10", label: "+10 ₽", weight: 3.5, kind: "balance", amount: 10 },
  { key: "sub_7d", label: "7 дней подписки", weight: 2.5, kind: "sub", days: 7 },
  { key: "balance_50", label: "+50 ₽", weight: 1.2, kind: "balance", amount: 50 },
  { key: "sub_30d", label: "30 дней подписки", weight: 0.5, kind: "sub", days: 30 },
  { key: "sub_90d", label: "90 дней подписки", weight: 0.25, kind: "sub", days: 90 },
  { key: "sub_180d", label: "180 дней подписки", weight: 0.12, kind: "sub", days: 180 },
  { key: "balance_100", label: "+100 ₽", weight: 0.08, kind: "balance", amount: 100 },
  { key: "lifetime", label: "Навсегда", weight: 0.01, kind: "sub", days: 999999 },
];

const TOTAL_WEIGHT = PRIZES.reduce((s, p) => s + p.weight, 0);

export function chances() {
  return PRIZES.map((p) => ({
    ...p,
    chance: Math.round((p.weight / TOTAL_WEIGHT) * 10000) / 100,
  }));
}

function pickPrize(): Prize {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const p of PRIZES) {
    roll -= p.weight;
    if (roll <= 0) return p;
  }
  return PRIZES[0];
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function hoursLeft(lastWheelAt: unknown): number {
  const last = toDate(lastWheelAt);
  if (!last) return 0;
  const readyAt = last.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((readyAt - Date.now()) / (60 * 60 * 1000)));
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const row = (await queryOne(
      "SELECT last_wheel_at, spin_count FROM users WHERE id = $1",
      [user.id]
    )) as { last_wheel_at: unknown; spin_count: number | null } | null;

    const left = hoursLeft(row?.last_wheel_at);
    const spins = Number(row?.spin_count) || 0;

    return NextResponse.json({
      ok: true,
      canSpin: left === 0 || spins > 0,
      hoursLeft: left,
      spins,
      cooldownHours: COOLDOWN_HOURS,
      prizes: chances(),
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

    const result = await withTransaction(async (client) => {
      // Блокируем пользователя: проверка кулдауна/бонусных круток и выдача приза
      // должны происходить одной атомарной операцией.
      const locked = await client.query(
        "SELECT last_wheel_at, spin_count, subscription_end FROM users WHERE id = $1 FOR UPDATE",
        [user.id]
      );
      if (!locked.rows.length) {
        return { error: "Пользователь не найден", status: 404 } as const;
      }

      const row = locked.rows[0];
      const spins = Number(row.spin_count) || 0;
      const usedBonus = spins > 0;

      if (!usedBonus) {
        const left = hoursLeft(row.last_wheel_at);
        if (left > 0) {
          return {
            error: `Следующая бесплатная крутка через ${left} ч.`,
            status: 403,
          } as const;
        }
        await client.query("UPDATE users SET last_wheel_at = NOW() WHERE id = $1", [user.id]);
      } else {
        await client.query(
          "UPDATE users SET spin_count = spin_count - 1 WHERE id = $1",
          [user.id]
        );
      }

      const prize = pickPrize();
      let subscriptionEnd: string | null = null;

      if (prize.kind === "hwid") {
        await client.query("UPDATE users SET hwid = NULL WHERE id = $1", [user.id]);
      } else if (prize.kind === "balance") {
        const amount = prize.amount || 0;
        await client.query(
          "UPDATE users SET balance = COALESCE(balance, 0) + $1 WHERE id = $2",
          [amount, user.id]
        );
        await addBalanceHistory(
          user.id,
          amount,
          "wheel",
          `Выигрыш в колесе — ${prize.label}`,
          client
        );
      } else {
        const now = new Date();
        let base: Date;
        if (row.subscription_end) {
          const current = toDate(row.subscription_end);
          base = current && current > now ? current : new Date(now);
        } else {
          base = new Date(now);
        }
        if (prize.hours) base.setHours(base.getHours() + prize.hours);
        if (prize.days) base.setDate(base.getDate() + prize.days);
        subscriptionEnd = base.toISOString().slice(0, 19).replace("T", " ");
        await client.query(
          "UPDATE users SET subscription_end = $1, sub_gifted = 0 WHERE id = $2",
          [subscriptionEnd, user.id]
        );
      }

      const updated = await client.query(
        "SELECT last_wheel_at, spin_count FROM users WHERE id = $1",
        [user.id]
      );

      return {
        prize,
        usedBonus,
        subscriptionEnd,
        spins: Number(updated.rows[0]?.spin_count) || 0,
        hoursLeft: hoursLeft(updated.rows[0]?.last_wheel_at),
      } as const;
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      ok: true,
      prize: { key: result.prize.key, label: result.prize.label },
      index: PRIZES.findIndex((p) => p.key === result.prize.key),
      subscription_end: result.subscriptionEnd,
      usedBonus: result.usedBonus,
      spins: result.spins,
      hoursLeft: result.hoursLeft,
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
