import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

const COOLDOWN_HOURS = 72;

export type Prize = {
  key: string;
  label: string;
  weight: number;
  kind: "sub" | "hwid";
  hours?: number;
  days?: number;
};

export const PRIZES: Prize[] = [
  { key: "sub_1h", label: "1 час подписки", weight: 75, kind: "sub", hours: 1 },
  { key: "sub_3h", label: "3 часа подписки", weight: 15, kind: "sub", hours: 3 },
  { key: "sub_6h", label: "6 часов подписки", weight: 13, kind: "sub", hours: 6 },
  { key: "sub_12h", label: "12 часов подписки", weight: 10, kind: "sub", hours: 12 },
  { key: "sub_1d", label: "1 день подписки", weight: 6, kind: "sub", days: 1 },
  { key: "hwid", label: "Сброс HWID", weight: 4, kind: "hwid" },
  { key: "sub_7d", label: "7 дней подписки", weight: 3, kind: "sub", days: 7 },
  { key: "sub_30d", label: "30 дней подписки", weight: 0.5, kind: "sub", days: 30 },
  { key: "sub_90d", label: "90 дней подписки", weight: 0.25, kind: "sub", days: 90 },
  { key: "sub_180d", label: "180 дней подписки", weight: 0.1, kind: "sub", days: 180 },
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

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const row = await queryOne(
      "SELECT last_wheel_at, spin_count FROM users WHERE id = $1",
      [user.id]
    ) as any;

    const now = new Date();
    let hoursLeft = 0;
    if (row?.last_wheel_at) {
      const last = row.last_wheel_at instanceof Date ? row.last_wheel_at : new Date(String(row.last_wheel_at).replace(" ", "T"));
      const readyAt = new Date(last.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000);
      if (readyAt > now) {
        hoursLeft = Math.ceil((readyAt.getTime() - now.getTime()) / (60 * 60 * 1000));
      }
    }

    const spins = row?.spin_count ?? 0;

    return NextResponse.json({
      ok: true,
      canSpin: hoursLeft === 0 || spins > 0,
      hoursLeft,
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

    // Сначала пытаемся потратить бонус-крутку
    const bonus = await query(
      "UPDATE users SET spin_count = spin_count - 1 WHERE id = $1 AND spin_count > 0 RETURNING spin_count",
      [user.id]
    );
    let usedBonus = (bonus.rowCount ?? 0) > 0;

    if (!usedBonus) {
      const cd = await query(
        `UPDATE users SET last_wheel_at = NOW()
         WHERE id = $1 AND (last_wheel_at IS NULL OR last_wheel_at <= NOW() - INTERVAL '${COOLDOWN_HOURS} hours')
         RETURNING id`,
        [user.id]
      );
      if ((cd.rowCount ?? 0) === 0) {
        const left = await queryOne(
          `SELECT CEIL(EXTRACT(EPOCH FROM (last_wheel_at + INTERVAL '${COOLDOWN_HOURS} hours' - NOW())) / 3600)::int AS hours_left
           FROM users WHERE id = $1`,
          [user.id]
        ) as any;
        return NextResponse.json(
          { error: `Следующая бесплатная крутка через ${left?.hours_left ?? COOLDOWN_HOURS} ч.` },
          { status: 403 }
        );
      }
    }

    const prize = pickPrize();
    let subscriptionEnd: string | null = null;

    if (prize.kind === "hwid") {
      await query("UPDATE users SET hwid = NULL WHERE id = $1", [user.id]);
    } else {
      const u = await queryOne(
        "SELECT subscription_end FROM users WHERE id = $1",
        [user.id]
      ) as { subscription_end: string | null };
      const now = new Date();
      let base: Date;
      if (u.subscription_end) {
        const current = new Date(String(u.subscription_end).replace(" ", "T"));
        base = current > now ? current : new Date(now);
      } else {
        base = new Date(now);
      }
      if (prize.hours) base.setHours(base.getHours() + prize.hours);
      if (prize.days) base.setDate(base.getDate() + prize.days);
      subscriptionEnd = base.toISOString().slice(0, 19).replace("T", " ");
      await query(
        "UPDATE users SET subscription_end = $1, sub_gifted = 0 WHERE id = $2",
        [subscriptionEnd, user.id]
      );
    }

    const updated = await queryOne(
      "SELECT last_wheel_at, spin_count FROM users WHERE id = $1",
      [user.id]
    ) as any;
    const now = new Date();
    let hoursLeft = 0;
    if (updated?.last_wheel_at) {
      const last = updated.last_wheel_at instanceof Date ? updated.last_wheel_at : new Date(String(updated.last_wheel_at).replace(" ", "T"));
      const readyAt = new Date(last.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000);
      if (readyAt > now) hoursLeft = Math.ceil((readyAt.getTime() - now.getTime()) / (60 * 60 * 1000));
    }

    return NextResponse.json({
      ok: true,
      prize: { key: prize.key, label: prize.label },
      index: PRIZES.findIndex((p) => p.key === prize.key),
      subscription_end: subscriptionEnd,
      usedBonus,
      spins: updated?.spin_count ?? 0,
      hoursLeft,
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
