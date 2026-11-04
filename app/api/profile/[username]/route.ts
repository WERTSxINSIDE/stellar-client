import { NextResponse } from "next/server";
import { queryAll, queryOne } from "@/lib/db";
import { computeAchievements } from "@/lib/achievements";
import { getAchievementStats, isSubscriptionActive } from "@/lib/achievement-stats";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;
    const name = decodeURIComponent(username || "").trim();
    if (!name || name.length > 64) {
      return NextResponse.json({ error: "Некорректный ник" }, { status: 400 });
    }

    const user = (await queryOne(
      `SELECT id, username, created_at, subscription_end, role, is_admin, avatar_url, bio, banner_url, accent_color
       FROM users
       WHERE LOWER(username) = LOWER($1)
       LIMIT 1`,
      [name]
    )) as Record<string, unknown> | null;

    if (!user) {
      return NextResponse.json({ error: "Игрок не найден" }, { status: 404 });
    }

    const userId = Number(user.id);
    const stats = await getAchievementStats(userId);
    if (!stats) {
      return NextResponse.json({ error: "Игрок не найден" }, { status: 404 });
    }

    const [savedRows, reviewRow, launchRow] = await Promise.all([
      queryAll(
        "SELECT achievement_key, unlocked_at FROM user_achievements WHERE user_id = $1",
        [userId]
      ),
      queryOne(
        `SELECT COUNT(*)::int AS count, COALESCE(ROUND(AVG(rating))::int, 0) AS rating
         FROM reviews
         WHERE user_id = $1 AND status = 'approved'`,
        [userId]
      ) as Promise<Record<string, unknown> | null>,
      queryOne(
        "SELECT COUNT(*)::int AS launches FROM play_sessions WHERE user_id = $1",
        [userId]
      ) as Promise<Record<string, unknown> | null>,
    ]);

    const unlockedAt = new Map<string, unknown>(
      savedRows.map((r) => [String(r.achievement_key), r.unlocked_at])
    );

    const computed = computeAchievements(stats);
    const achievements = computed
      .filter((a) => a.unlocked || unlockedAt.has(a.key))
      .map((a) => ({
        key: a.key,
        title: a.title,
        description: a.description,
        icon: a.icon,
        category: a.category,
        rarity: a.rarity,
        unlocked_at: unlockedAt.get(a.key) ?? null,
      }));

    const createdAt = user.created_at
      ? user.created_at instanceof Date
        ? user.created_at.toISOString()
        : String(user.created_at).replace(" ", "T")
      : null;

    return NextResponse.json({
      ok: true,
      profile: {
        username: String(user.username),
        avatar_url: user.avatar_url ? String(user.avatar_url) : null,
        bio: user.bio ? String(user.bio) : null,
        banner_url: user.banner_url ? String(user.banner_url) : null,
        accent_color: user.accent_color ? String(user.accent_color) : null,
        created_at: createdAt,
        days_in_club: stats.accountAgeDays,
        subscription_active: isSubscriptionActive(user.subscription_end),
        is_admin: Number(user.is_admin) === 1 || user.role === "admin",
        is_partner: stats.partnerApproved > 0,
        stats: {
          seconds: stats.playSeconds,
          launches: Number(launchRow?.launches) || 0,
          achievements_unlocked: achievements.length,
          achievements_total: computed.length,
          reviews: Number(reviewRow?.count) || 0,
          review_rating: Number(reviewRow?.rating) || 0,
        },
        achievements,
      },
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
