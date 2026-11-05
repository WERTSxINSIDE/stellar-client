import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryAll, queryOne, withTransaction } from "@/lib/db";
import { grantCoins } from "@/lib/coins";
import {
  BATTLE_PASS,
  battlePassLevels,
  currentSeason,
  levelForXp,
  xpToNextLevel,
  type BattlePassReward,
} from "@/lib/battle-pass";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type ProgressRow = {
  season: string;
  xp: number;
  premium: number;
};

type ClaimRow = {
  level: number;
  track: string;
};

type CosmeticRow = {
  key: string;
  title: string;
  value: string | null;
  price: number;
  rarity: string;
};

async function loadState(userId: number) {
  const season = currentSeason();
  const progress = (await queryOne(
    "SELECT season, xp, premium FROM battle_pass_progress WHERE user_id = $1",
    [userId]
  )) as ProgressRow | null;

  const xp = progress?.season === season.id ? Number(progress.xp || 0) : 0;
  const premium = progress?.season === season.id && Number(progress.premium) === 1;
  const level = levelForXp(xp);

  const claims = (await queryAll(
    "SELECT level, track FROM battle_pass_claims WHERE user_id = $1 AND season = $2",
    [userId, season.id]
  )) as ClaimRow[];
  const claimed = new Set(claims.map((row) => `${row.level}:${row.track}`));

  const cosmeticKeys = battlePassLevels()
    .flatMap((item) => [item.free, item.premium])
    .filter((reward): reward is Extract<BattlePassReward, { kind: "cosmetic" }> => reward.kind === "cosmetic")
    .map((reward) => reward.key);

  const cosmetics = (
    (await queryAll(
      "SELECT key, title, value, price, rarity FROM cosmetic_items WHERE key = ANY($1::text[])",
      [cosmeticKeys]
    )) as CosmeticRow[]
  ).reduce<Record<string, CosmeticRow>>((acc, item) => {
    acc[item.key] = item;
    return acc;
  }, {});

  const levels = battlePassLevels().map((item) => {
    const freeReward =
      item.free.kind === "cosmetic"
        ? { ...item.free, title: cosmetics[item.free.key]?.title || item.free.key, icon: cosmetics[item.free.key]?.value || null }
        : item.free;
    const premiumReward =
      item.premium.kind === "cosmetic"
        ? {
            ...item.premium,
            title: cosmetics[item.premium.key]?.title || item.premium.key,
            icon: cosmetics[item.premium.key]?.value || null,
            rarity: cosmetics[item.premium.key]?.rarity || null,
          }
        : item.premium;

    return {
      level: item.level,
      xp: item.xp,
      free: freeReward,
      premium: premiumReward,
      unlocked: level >= item.level,
      free_claimed: claimed.has(`${item.level}:free`),
      premium_claimed: claimed.has(`${item.level}:premium`),
    };
  });

  return {
    season,
    xp,
    level,
    premium,
    premium_price: BATTLE_PASS.premiumPrice,
    max_level: BATTLE_PASS.maxLevel,
    xp_per_level: BATTLE_PASS.xpPerLevel,
    xp_to_next: xpToNextLevel(xp),
    levels,
    claimable:
      levels.filter((item) => item.unlocked).length * (premium ? 2 : 1) -
      levels.reduce(
        (sum, item) => sum + (item.free_claimed ? 1 : 0) + (item.premium_claimed ? 1 : 0),
        0
      ),
  };
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    return NextResponse.json({ ok: true, ...(await loadState(user.id)) });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const limited = await enforceRateLimit(req, [
      { scope: "battle-pass:account", identifier: user.id, limit: 30, windowMs: 60_000 },
    ]);
    if (limited) return limited;

    const body = (await req.json().catch(() => ({}))) as {
      action?: unknown;
      level?: unknown;
      track?: unknown;
    };
    const action = String(body.action || "");

    if (action === "buy-premium") {
      const season = currentSeason();
      const progress = (await queryOne(
        "SELECT season, premium FROM battle_pass_progress WHERE user_id = $1",
        [user.id]
      )) as { season: string; premium: number } | null;

      if (progress?.season === season.id && Number(progress.premium) === 1) {
        return NextResponse.json({ error: "Премиум уже активен" }, { status: 409 });
      }

      const paid = await withTransaction(async (client) => {
        const updated = await client.query(
          `UPDATE users
           SET sc_coins = COALESCE(sc_coins, 0) - $2
           WHERE id = $1 AND COALESCE(sc_coins, 0) >= $2
           RETURNING COALESCE(sc_coins, 0)::int AS coins`,
          [user.id, BATTLE_PASS.premiumPrice]
        );
        if (!updated.rows.length) return null;

        await client.query(
          "INSERT INTO coin_transactions (user_id, amount, type, note) VALUES ($1, $2, $3, $4)",
          [user.id, -BATTLE_PASS.premiumPrice, "battle_pass_premium", season.title_ru]
        );

        await client.query(
          `INSERT INTO battle_pass_progress (user_id, season, xp, premium)
           VALUES ($1, $2, 0, 1)
           ON CONFLICT (user_id) DO UPDATE SET
             season = $2,
             xp = CASE WHEN battle_pass_progress.season = $2 THEN battle_pass_progress.xp ELSE 0 END,
             premium = 1,
             updated_at = NOW()`,
          [user.id, season.id]
        );

        return Number(updated.rows[0].coins);
      });

      if (paid === null) {
        return NextResponse.json({ error: "Недостаточно SC" }, { status: 400 });
      }

      return NextResponse.json({ ok: true, coins: paid, ...(await loadState(user.id)) });
    }

    if (action === "claim") {
      const level = Math.floor(Number(body.level));
      const track = String(body.track || "");
      if (!Number.isInteger(level) || level < 1 || level > BATTLE_PASS.maxLevel) {
        return NextResponse.json({ error: "Неверный уровень" }, { status: 400 });
      }
      if (!["free", "premium"].includes(track)) {
        return NextResponse.json({ error: "Неверная ветка" }, { status: 400 });
      }

      const season = currentSeason();
      const progress = (await queryOne(
        "SELECT season, xp, premium FROM battle_pass_progress WHERE user_id = $1",
        [user.id]
      )) as ProgressRow | null;
      const xp = progress?.season === season.id ? Number(progress.xp || 0) : 0;
      const premium = progress?.season === season.id && Number(progress.premium) === 1;

      if (levelForXp(xp) < level) {
        return NextResponse.json({ error: "Уровень ещё не открыт" }, { status: 400 });
      }
      if (track === "premium" && !premium) {
        return NextResponse.json({ error: "Нужен премиум-пропуск" }, { status: 400 });
      }

      const reward = battlePassLevels().find((item) => item.level === level)?.[
        track as "free" | "premium"
      ];
      if (!reward) {
        return NextResponse.json({ error: "Награда не найдена" }, { status: 404 });
      }

      const result = await withTransaction(async (client) => {
        const inserted = await client.query(
          `INSERT INTO battle_pass_claims (user_id, season, level, track)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, season, level, track) DO NOTHING
           RETURNING level`,
          [user.id, season.id, level, track]
        );
        if (!inserted.rows.length) {
          return { already: true as const };
        }

        if (reward.kind === "coins") {
          await grantCoins(
            user.id,
            reward.amount,
            "battle_pass",
            `${season.title_ru} · уровень ${level}`,
            client
          );
          return { already: false as const, reward: { kind: "coins" as const, amount: reward.amount } };
        }

        const item = (await client.query(
          "SELECT key, title, price FROM cosmetic_items WHERE key = $1",
          [reward.key]
        )) as { rows: { key: string; title: string; price: number }[] };
        const cosmetic = item.rows[0];
        if (!cosmetic) {
          return { already: false as const, reward: { kind: "coins" as const, amount: 0 } };
        }

        const owned = await client.query(
          "SELECT 1 FROM user_cosmetics WHERE user_id = $1 AND cosmetic_key = $2",
          [user.id, cosmetic.key]
        );

        if (owned.rows.length) {
          const compensation = Math.max(100, Math.floor(Number(cosmetic.price || 0) / 2));
          await grantCoins(
            user.id,
            compensation,
            "battle_pass_duplicate",
            `${cosmetic.title} уже был — компенсация`,
            client
          );
          return {
            already: false as const,
            reward: { kind: "coins" as const, amount: compensation, duplicate: true },
          };
        }

        await client.query(
          "INSERT INTO user_cosmetics (user_id, cosmetic_key) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [user.id, cosmetic.key]
        );
        return {
          already: false as const,
          reward: { kind: "cosmetic" as const, key: cosmetic.key, title: cosmetic.title },
        };
      });

      if (result.already) {
        return NextResponse.json({ error: "Награда уже получена" }, { status: 409 });
      }

      return NextResponse.json({
        ok: true,
        reward: result.reward,
        ...(await loadState(user.id)),
      });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
