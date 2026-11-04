import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryAll, queryOne } from "@/lib/db";
import { discountActive, discountedPrice } from "@/lib/showcase";

export const dynamic = "force-dynamic";

type ItemRow = {
  id: number;
  user_id: number;
  type: string;
  title: string;
  description: string | null;
  url: string | null;
  file_name: string | null;
  price: number | null;
  tags: string[] | null;
  views: number | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  game: string | null;
  version: string | null;
  discount_percent: number | null;
  discount_until: string | null;
  username: string;
  avatar_url: string | null;
  avg_rating: number;
  ratings: number;
  my_rating: number | null;
  my_comment: string | null;
  is_owner: boolean;
  purchased: boolean;
  is_favorite: boolean;
  following: boolean;
  followers: number;
  sales: number;
};

/** Детальная карточка материала + текстовые отзывы. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const itemId = Number(id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ error: "Неверный материал" }, { status: 400 });
    }

    const user = await getCurrentUser();
    const userId = user?.id ?? null;
    const isAdmin = !!user && (user.role === "admin" || Number(user.is_admin) === 1);

    const item = (await queryOne(
      `SELECT s.id, s.user_id, s.type, s.title, s.description, s.url, s.file_name,
              s.price, s.tags, s.views, s.status, s.admin_note, s.created_at,
              s.game, s.version, s.discount_percent, s.discount_until,
              u.username, u.avatar_url,
              COALESCE(AVG(r.rating), 0)::float AS avg_rating,
              COUNT(r.id)::int AS ratings,
              (SELECT rr.rating FROM showcase_ratings rr
               WHERE rr.item_id = s.id AND rr.user_id = $2) AS my_rating,
              (SELECT rr.comment FROM showcase_ratings rr
               WHERE rr.item_id = s.id AND rr.user_id = $2) AS my_comment,
              (s.user_id = $2) AS is_owner,
              EXISTS(
                SELECT 1 FROM showcase_purchases sp
                WHERE sp.item_id = s.id AND sp.buyer_id = $2
              ) AS purchased,
              EXISTS(
                SELECT 1 FROM showcase_favorites f
                WHERE f.item_id = s.id AND f.user_id = $2
              ) AS is_favorite,
              EXISTS(
                SELECT 1 FROM showcase_follows f
                WHERE f.follower_id = $2 AND f.author_id = s.user_id
              ) AS following,
              (SELECT COUNT(*)::int FROM showcase_follows f WHERE f.author_id = s.user_id) AS followers,
              (SELECT COUNT(*)::int FROM showcase_purchases sp WHERE sp.item_id = s.id) AS sales
       FROM showcase_items s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN showcase_ratings r ON r.item_id = s.id
       WHERE s.id = $1
       GROUP BY s.id, u.username, u.avatar_url`,
      [itemId, userId]
    )) as ItemRow | null;

    if (!item) {
      return NextResponse.json({ error: "Материал не найден" }, { status: 404 });
    }

    if (item.status !== "approved" && !isAdmin && item.user_id !== userId) {
      return NextResponse.json({ error: "Материал не найден" }, { status: 404 });
    }

    const reviews = (await queryAll(
      `SELECT r.id, r.rating, r.comment, r.author_reply, r.reply_at, r.created_at,
              u.username, u.avatar_url
       FROM showcase_ratings r
       JOIN users u ON u.id = r.user_id
       WHERE r.item_id = $1
         AND r.comment IS NOT NULL
         AND LENGTH(TRIM(r.comment)) > 0
         AND COALESCE(u.banned, 0) = 0
       ORDER BY r.created_at DESC
       LIMIT 50`,
      [itemId]
    )) as {
      id: number;
      rating: number;
      comment: string;
      author_reply: string | null;
      reply_at: string | null;
      created_at: string;
      username: string;
      avatar_url: string | null;
    }[];

    const versions = (await queryAll(
      `SELECT id, version, changelog, file_name, created_at
       FROM showcase_versions
       WHERE item_id = $1
       ORDER BY created_at DESC
       LIMIT 30`,
      [itemId]
    )) as {
      id: number;
      version: string;
      changelog: string | null;
      file_name: string | null;
      created_at: string;
    }[];

    const price = Number(item.price || 0);
    const discountPercent = Number(item.discount_percent || 0);
    const finalPrice = discountedPrice(price, discountPercent, item.discount_until);
    const canReview =
      !!user &&
      item.user_id !== user.id &&
      (item.type !== "config" || finalPrice === 0 || !!item.purchased);

    return NextResponse.json(
      {
        ok: true,
        item: {
          ...item,
          price,
          discount_percent: discountPercent,
          discount_active: discountActive(discountPercent, item.discount_until),
          final_price: finalPrice,
          is_favorite: !!item.is_favorite,
          following: !!item.following,
        },
        reviews,
        versions,
        can_review: canReview,
        is_admin: isAdmin,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
