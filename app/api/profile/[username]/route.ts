import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryAll, queryOne } from "@/lib/db";
import { computeAchievements } from "@/lib/achievements";
import { getAchievementStats, isSubscriptionActive } from "@/lib/achievement-stats";
import { discountActive, discountedPrice } from "@/lib/showcase";

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

    const viewer = await getCurrentUser();
    const viewerId = viewer?.id ?? null;
    const isSelf = viewerId === userId;

    let isFollowing = false;
    if (viewerId && !isSelf) {
      const followRow = (await queryOne(
        "SELECT 1 AS found FROM showcase_follows WHERE follower_id = $1 AND author_id = $2",
        [viewerId, userId]
      )) as { found?: number } | null;
      isFollowing = !!followRow;
    }

    const [
      savedRows,
      reviewRow,
      launchRow,
      followersRow,
      followingRow,
      authorRatingRow,
      configRows,
    ] = await Promise.all([
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
      queryOne(
        "SELECT COUNT(*)::int AS count FROM showcase_follows WHERE author_id = $1",
        [userId]
      ) as Promise<Record<string, unknown> | null>,
      queryOne(
        "SELECT COUNT(*)::int AS count FROM showcase_follows WHERE follower_id = $1",
        [userId]
      ) as Promise<Record<string, unknown> | null>,
      queryOne(
        `SELECT COALESCE(AVG(r.rating), 0)::float AS rating, COUNT(r.id)::int AS count
         FROM showcase_ratings r
         JOIN showcase_items s ON s.id = r.item_id
         WHERE s.user_id = $1 AND s.status = 'approved'`,
        [userId]
      ) as Promise<Record<string, unknown> | null>,
      queryAll(
        `SELECT s.id, s.type, s.title, s.description, s.tags, s.price, s.views,
                s.game, s.version, s.discount_percent, s.discount_until, s.created_at,
                COALESCE(AVG(r.rating), 0)::float AS avg_rating,
                COUNT(r.id)::int AS ratings,
                (SELECT COUNT(*)::int FROM showcase_purchases sp WHERE sp.item_id = s.id) AS sales
         FROM showcase_items s
         LEFT JOIN showcase_ratings r ON r.item_id = s.id
         WHERE s.user_id = $1 AND s.status = 'approved' AND s.type = 'config'
         GROUP BY s.id
         ORDER BY s.created_at DESC
         LIMIT 60`,
        [userId]
      ),
    ]);

    const configs = (configRows as Record<string, unknown>[]).map((row) => {
      const price = Number(row.price || 0);
      const percent = Number(row.discount_percent || 0);
      return {
        id: Number(row.id),
        type: String(row.type),
        title: String(row.title),
        description: row.description ? String(row.description) : null,
        tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
        views: Number(row.views) || 0,
        sales: Number(row.sales) || 0,
        game: row.game ? String(row.game) : null,
        version: row.version ? String(row.version) : null,
        price,
        discount_percent: percent,
        discount_active: discountActive(percent, row.discount_until),
        final_price: discountedPrice(price, percent, row.discount_until),
        avg_rating: Number(row.avg_rating) || 0,
        ratings: Number(row.ratings) || 0,
        created_at: row.created_at
          ? row.created_at instanceof Date
            ? row.created_at.toISOString()
            : String(row.created_at).replace(" ", "T")
          : null,
      };
    });

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
        id: userId,
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
        followers: Number(followersRow?.count) || 0,
        following: Number(followingRow?.count) || 0,
        is_following: isFollowing,
        is_self: isSelf,
        author_rating: Number(authorRatingRow?.rating) || 0,
        author_ratings: Number(authorRatingRow?.count) || 0,
        sales_total: configs.reduce((sum, item) => sum + item.sales, 0),
        stats: {
          seconds: stats.playSeconds,
          launches: Number(launchRow?.launches) || 0,
          achievements_unlocked: achievements.length,
          achievements_total: computed.length,
          reviews: Number(reviewRow?.count) || 0,
          review_rating: Number(reviewRow?.rating) || 0,
        },
        achievements,
        configs,
      },
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
