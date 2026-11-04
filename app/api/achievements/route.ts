import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryAll, withTransaction } from "@/lib/db";
import { computeAchievements } from "@/lib/achievements";
import { getAchievementStats } from "@/lib/achievement-stats";
import { createNotification, emailNotification } from "@/lib/notify";
import { logActivity } from "@/lib/activity";
import { grantCoins } from "@/lib/coins";

export const dynamic = "force-dynamic";

/** Сколько SC-монет даём за каждое новое достижение. */
const ACHIEVEMENT_COINS = 50;

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const stats = await getAchievementStats(user.id);
    if (!stats) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    const computed = computeAchievements(stats);

    const rows = await queryAll(
      "SELECT achievement_key, unlocked_at FROM user_achievements WHERE user_id = $1",
      [user.id]
    );
    const unlockedMap = new Map<string, unknown>(
      rows.map((r) => [String(r.achievement_key), r.unlocked_at])
    );

    const newly = computed.filter(
      (a) => a.unlocked && a.available && !unlockedMap.has(a.key)
    );

    let coinsEarned = 0;

    if (newly.length) {
      const unlockedAt = new Date().toISOString();
      await withTransaction(async (client) => {
        for (const achievement of newly) {
          const inserted = await client.query(
            `INSERT INTO user_achievements (user_id, achievement_key)
             VALUES ($1, $2)
             ON CONFLICT (user_id, achievement_key) DO NOTHING
             RETURNING achievement_key`,
            [user.id, achievement.key]
          );
          if (inserted.rows.length) {
            await grantCoins(
              user.id,
              ACHIEVEMENT_COINS,
              "achievement",
              `Достижение: ${achievement.title}`,
              client
            );
            coinsEarned += ACHIEVEMENT_COINS;
          }
        }
      });
      for (const achievement of newly) {
        unlockedMap.set(achievement.key, unlockedAt);
      }

      await Promise.allSettled(
        newly.map((achievement) =>
          createNotification(user.id, {
            type: "achievement",
            title: `Достижение: ${achievement.title}`,
            body: achievement.description,
            link: "/dashboard",
          })
        )
      );

      if (newly.length === 1) {
        await logActivity(
          user.id,
          "achievement",
          `Достижение: ${newly[0].title}`,
          newly[0].description
        );
      } else {
        await logActivity(
          user.id,
          "achievement",
          `Открыто достижений: ${newly.length}`,
          newly.map((a) => a.title).join(", ")
        );
      }

      // Одно письмо-сводка на пачку достижений, чтобы не заваливать почту.
      await emailNotification(user.id, {
        type: "achievement",
        title:
          newly.length === 1
            ? `Новое достижение: ${newly[0].title}`
            : `Открыто достижений: ${newly.length}`,
        body: newly.map((a) => a.title).join(", "),
        link: "/dashboard",
      });
    }

    const achievements = computed.map((achievement) => {
      const unlocked = achievement.unlocked || unlockedMap.has(achievement.key);
      return {
        ...achievement,
        // На клиент отдаём название сезона строкой: объект нельзя рендерить в React.
        season: achievement.season?.title ?? null,
        progress: unlocked ? achievement.target : achievement.progress,
        unlocked,
        unlocked_at: unlockedMap.get(achievement.key) ?? null,
      };
    });

    return NextResponse.json({
      ok: true,
      achievements,
      stats: {
        unlocked: achievements.filter((a) => a.unlocked).length,
        total: achievements.length,
      },
      newlyUnlocked: newly.map((a) => a.key),
      coins_earned: coinsEarned,
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
