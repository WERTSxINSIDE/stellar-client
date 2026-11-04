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
      `SELECT id, username, created_at, subscription_end, role, is_admin, avatar_url, bio, banner_url, accent_color,
              nickname_color, profile_theme, equipped_frame, equipped_badge
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
      clanRow,
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
      queryOne(
        `SELECT c.id, c.name, c.tag, c.emblem, c.color, cm.role
         FROM clan_members cm
         JOIN clans c ON c.id = cm.clan_id
         WHERE cm.user_id = $1
         LIMIT 1`,
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
      .filter((a) => a.available || a.unlocked || unlockedAt.has(a.key))
      .map((a) => ({
        key: a.key,
        title: a.hidden && !a.unlocked && !unlockedAt.has(a.key) ? "Секретное достижение" : a.title,
        description:
          a.hidden && !a.unlocked && !unlockedAt.has(a.key)
            ? "Откроется, когда выполните скрытое условие"
            : a.description,
        icon: a.hidden && !a.unlocked && !unlockedAt.has(a.key) ? "🔒" : a.icon,
        category: a.category,
        rarity: a.rarity,
        hidden: !!a.hidden,
        season: a.season?.title ?? null,
        unlocked_at: unlockedAt.get(a.key) ?? null,
      }));
    const visibleTotal = computed.filter(
      (a) => a.available || unlockedAt.has(a.key)
    ).length;

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
        cosmetics: {
          nickname_color: user.nickname_color ? String(user.nickname_color) : null,
          profile_theme: user.profile_theme ? String(user.profile_theme) : null,
          frame: user.equipped_frame ? String(user.equipped_frame) : null,
          badge: user.equipped_badge ? String(user.equipped_badge) : null,
        },
        created_at: createdAt,
        days_in_club: stats.accountAgeDays,
        subscription_active: isSubscriptionActive(user.subscription_end),
        is_admin: Number(user.is_admin) === 1 || user.role === "admin",
        is_partner: stats.partnerApproved > 0,
        clan: clanRow
          ? {
              id: Number((clanRow as Record<string, unknown>).id),
              name: String((clanRow as Record<string, unknown>).name),
              tag: String((clanRow as Record<string, unknown>).tag),
              emblem: String((clanRow as Record<string, unknown>).emblem || "🛡️"),
              color: String((clanRow as Record<string, unknown>).color || "#a78bfa"),
              role: String((clanRow as Record<string, unknown>).role || "member"),
            }
          : null,
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
          achievements_unlocked: achievements.filter((a) => !!a.unlocked_at).length,
          achievements_total: visibleTotal,
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
