import { NextResponse } from "next/server";
import { addBalanceHistory, query, queryOne, withTransaction, type DbExecutor } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { grantCoins } from "@/lib/coins";
import { clanBonusPercent, CLAN_XP } from "@/lib/clans";
import { logClanActivity } from "@/lib/clan-service";

export const dynamic = "force-dynamic";

export const REWARDS: {
  day: number;
  type: "balance" | "spin";
  amount?: number;
  spins?: number;
  label: string;
}[] = [
  { day: 1, type: "balance", amount: 5, label: "5₽ на баланс" },
  { day: 2, type: "balance", amount: 5, label: "5₽ на баланс" },
  { day: 3, type: "spin", spins: 1, label: "1 крутка рулетки" },
  { day: 4, type: "balance", amount: 5, label: "5₽ на баланс" },
  { day: 5, type: "balance", amount: 5, label: "5₽ на баланс" },
  { day: 6, type: "balance", amount: 5, label: "5₽ на баланс" },
  { day: 7, type: "spin", spins: 1, label: "1 крутка рулетки" },
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

type RewardRow = { streak_day: number | null; last_claim: string | null };

function stateFromRow(row: RewardRow | null | undefined, today: string, yesterday: string) {
  if (!row) {
    return { day: 1, claimedToday: false, finished: false };
  }

  const streak = Number(row.streak_day) || 0;
  const last = row.last_claim || null;

  if (streak < 1) {
    return { day: 1, claimedToday: last === today, finished: false };
  }

  // Цикл уже пройден полностью — повторов нет
  if (streak >= 7) {
    return { day: 7, claimedToday: last === today, finished: true };
  }

  if (last === today) {
    return { day: streak, claimedToday: true, finished: false };
  }
  if (last === yesterday) {
    return { day: streak + 1, claimedToday: false, finished: false };
  }
  // пропуск дня — продолжаем с того же дня, без возврата к 1
  return { day: streak, claimedToday: false, finished: false };
}

async function saveClaim(
  userId: number,
  day: number,
  today: string,
  db?: DbExecutor
) {
  const text = `INSERT INTO daily_rewards (user_id, streak_day, last_claim) VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET streak_day = $2, last_claim = $3`;

  if (db) {
    await db.query(text, [userId, day, today]);
    return;
  }

  await query(text, [userId, day, today]);
}

// Какой день цикла сегодня: 1..7, забран ли уже сегодняшний, не завершён ли цикл
async function getState(userId: number) {
  const row = (await queryOne(
    "SELECT streak_day, to_char(last_claim, 'YYYY-MM-DD') AS last_claim FROM daily_rewards WHERE user_id = $1",
    [userId]
  )) as RewardRow | null;

  return stateFromRow(row, todayStr(), yesterdayStr());
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

    const result = await withTransaction(async (client) => {
      // Сериализуем получение награды конкретным пользователем,
      // чтобы двойной клик не выдал награду дважды.
      await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [user.id]);

      const locked = await client.query(
        `SELECT streak_day, to_char(last_claim, 'YYYY-MM-DD') AS last_claim
         FROM daily_rewards WHERE user_id = $1`,
        [user.id]
      );

      const today = todayStr();
      const state = stateFromRow(locked.rows[0], today, yesterdayStr());

      if (state.finished) {
        return { error: "Все награды уже получены", status: 409 } as const;
      }
      if (state.claimedToday) {
        return { error: "Награда за сегодня уже получена", status: 409 } as const;
      }

      const reward = REWARDS[state.day - 1];
      if (!reward) {
        return { error: "Награда не найдена", status: 500 } as const;
      }

      const nowFinished = reward.day >= 7;

      // Клановый бонус: состав и разнообразие ролей увеличивают ежедневные SC.
      const clanRow = await client.query(
        `SELECT c.id, c.xp,
                (SELECT COUNT(*)::int FROM clan_members cm2 WHERE cm2.clan_id = c.id) AS member_count,
                (SELECT COUNT(DISTINCT cm2.role)::int FROM clan_members cm2 WHERE cm2.clan_id = c.id) AS role_count
         FROM clan_members cm
         JOIN clans c ON c.id = cm.clan_id
         WHERE cm.user_id = $1`,
        [user.id]
      );
      const clan = clanRow.rows[0] as
        | { id: number; member_count: number; role_count: number }
        | undefined;
      const clanPercent = clan
        ? clanBonusPercent(Number(clan.member_count) || 0, Number(clan.role_count) || 0)
        : 0;
      const clanBonus = clanPercent > 0 ? Math.max(1, Math.round((10 * clanPercent) / 100)) : 0;
      const coins = 10 + clanBonus;
      const coinsNote = clanBonus > 0 ? ` (клановый бонус +${clanBonus})` : "";

      if (reward.type === "balance") {
        const amount = reward.amount ?? 0;
        const updated = await client.query(
          `UPDATE users SET balance = COALESCE(balance, 0) + $1
           WHERE id = $2 RETURNING balance`,
          [amount, user.id]
        );
        await addBalanceHistory(
          user.id,
          amount,
          "reward",
          `Ежедневная награда — день ${reward.day}`,
          client
        );
        await saveClaim(user.id, reward.day, today, client);
        await grantCoins(
          user.id,
          coins,
          "daily_reward",
          `Ежедневная награда — день ${reward.day}${coinsNote}`,
          client
        );
        if (clan) {
          await logClanActivity(
            clan.id,
            user.id,
            "daily",
            CLAN_XP.dailyReward,
            `Ежедневная награда участника (день ${reward.day})`,
            client
          );
        }

        return {
          day: reward.day,
          message: `+${amount}₽ на баланс и +${coins} SC`,
          balance: Number(updated.rows[0]?.balance) || 0,
          finished: nowFinished,
          coins,
          clan_bonus: clanBonus,
        } as const;
      }

      // крутки рулетки
      const spins = reward.spins ?? 1;
      await client.query(
        "UPDATE users SET spin_count = COALESCE(spin_count, 0) + $1 WHERE id = $2",
        [spins, user.id]
      );
      await saveClaim(user.id, reward.day, today, client);
      await grantCoins(
        user.id,
        coins,
        "daily_reward",
        `Ежедневная награда — день ${reward.day}${coinsNote}`,
        client
      );
      if (clan) {
        await logClanActivity(
          clan.id,
          user.id,
          "daily",
          CLAN_XP.dailyReward,
          `Ежедневная награда участника (день ${reward.day})`,
          client
        );
      }

      return {
        day: reward.day,
        message: `+${spins} крут${spins === 1 ? "ка" : "ки"} рулетки и +${coins} SC`,
        balance: null,
        finished: nowFinished,
        coins,
        clan_bonus: clanBonus,
      } as const;
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      ok: true,
      day: result.day,
      message: result.message,
      balance: result.balance,
      subscription_end: null,
      finished: result.finished,
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
