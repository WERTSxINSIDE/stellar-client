import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, queryAll, queryOne } from "@/lib/db";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  SHOWCASE_MAX_FILE_BYTES,
  SHOWCASE_MAX_PRICE,
  SHOWCASE_MIN_PAID_PRICE,
  discountActive,
  discountedPrice,
  isAllowedFileName,
  isSafeUrl,
  isShowcaseType,
  normalizeDiscount,
  normalizeDiscountUntil,
  normalizeGame,
  normalizePrice,
  normalizeSort,
  normalizeTags,
  normalizeVersion,
} from "@/lib/showcase";

export const dynamic = "force-dynamic";

const ORDER_BY: Record<string, string> = {
  new: "s.created_at DESC",
  rating: "avg_rating DESC, ratings DESC, s.created_at DESC",
  popular: "sales DESC, s.views DESC, s.created_at DESC",
  price_asc: "s.price ASC, s.created_at DESC",
  price_desc: "s.price DESC, s.created_at DESC",
};

/** Список одобренных материалов с рейтингом, поиском и фильтрами. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const typeParam = url.searchParams.get("type");
    const type = isShowcaseType(typeParam) ? typeParam : null;

    const user = await getCurrentUser();
    const userId = user?.id ?? null;

    const q = String(url.searchParams.get("q") || "").trim().slice(0, 80);
    const qLike = q ? `%${q}%` : null;
    const tagRaw = String(url.searchParams.get("tag") || "")
      .trim()
      .toLowerCase()
      .replace(/^#+/, "")
      .slice(0, 24);
    const tag = tagRaw.length >= 2 ? tagRaw : null;

    const minRaw = Number(url.searchParams.get("min_price"));
    const maxRaw = Number(url.searchParams.get("max_price"));
    const minPrice = Number.isInteger(minRaw) && minRaw >= 0 ? minRaw : null;
    const maxPrice = Number.isInteger(maxRaw) && maxRaw >= 0 ? maxRaw : null;

    const sort = normalizeSort(url.searchParams.get("sort"));
    const game = normalizeGame(url.searchParams.get("game"));
    const favoritesOnly = url.searchParams.get("favorites") === "1";

    const items = await queryAll(
      `SELECT s.id, s.user_id, s.type, s.title, s.description, s.url, s.file_name,
              s.price, s.tags, s.views, s.created_at,
              s.game, s.version, s.discount_percent, s.discount_until,
              u.username, u.avatar_url,
              COALESCE(AVG(r.rating), 0)::float AS avg_rating,
              COUNT(r.id)::int AS ratings,
              (SELECT rr.rating FROM showcase_ratings rr
               WHERE rr.item_id = s.id AND rr.user_id = $1) AS my_rating,
              (s.user_id = $1) AS is_owner,
              EXISTS(
                SELECT 1 FROM showcase_purchases sp
                WHERE sp.item_id = s.id AND sp.buyer_id = $1
              ) AS purchased,
              EXISTS(
                SELECT 1 FROM showcase_favorites f
                WHERE f.item_id = s.id AND f.user_id = $1
              ) AS is_favorite,
              (SELECT COUNT(*)::int FROM showcase_purchases sp WHERE sp.item_id = s.id) AS sales
       FROM showcase_items s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN showcase_ratings r ON r.item_id = s.id
       WHERE s.status = 'approved'
         AND COALESCE(u.banned, 0) = 0
         AND ($2::text IS NULL OR s.type = $2)
         AND (
           $3::text IS NULL
           OR s.title ILIKE $3
           OR COALESCE(s.description, '') ILIKE $3
           OR array_to_string(COALESCE(s.tags, '{}'), ' ') ILIKE $3
         )
         AND ($4::text IS NULL OR $4 = ANY(COALESCE(s.tags, '{}')))
         AND ($5::int IS NULL OR s.price >= $5)
         AND ($6::int IS NULL OR s.price <= $6)
         AND ($7::text IS NULL OR s.game = $7)
         AND (
           $8::boolean IS NOT TRUE
           OR EXISTS(
             SELECT 1 FROM showcase_favorites f2
             WHERE f2.item_id = s.id AND f2.user_id = $1
           )
         )
       GROUP BY s.id, u.username, u.avatar_url
       ORDER BY ${ORDER_BY[sort]}
       LIMIT 60`,
      [userId, type, qLike, tag, minPrice, maxPrice, game, favoritesOnly ? true : null]
    );

    const normalizedItems = (items as Record<string, unknown>[]).map((row) => {
      const price = Number(row.price || 0);
      const percent = Number(row.discount_percent || 0);
      return {
        ...row,
        price,
        discount_percent: percent,
        discount_active: discountActive(percent, row.discount_until),
        final_price: discountedPrice(price, percent, row.discount_until),
        is_favorite: !!row.is_favorite,
      };
    });

    const tagRows = (await queryAll(
      `SELECT DISTINCT unnest(COALESCE(s.tags, '{}')) AS tag
       FROM showcase_items s
       JOIN users u ON u.id = s.user_id
       WHERE s.status = 'approved' AND COALESCE(u.banned, 0) = 0
       ORDER BY tag ASC
       LIMIT 60`
    )) as { tag: string | null }[];

    const gameRows = (await queryAll(
      `SELECT DISTINCT s.game
       FROM showcase_items s
       JOIN users u ON u.id = s.user_id
       WHERE s.status = 'approved'
         AND COALESCE(u.banned, 0) = 0
         AND s.game IS NOT NULL
       ORDER BY s.game ASC`
    )) as { game: string | null }[];

    return NextResponse.json(
      {
        ok: true,
        items: normalizedItems,
        tags: tagRows.map((row) => row.tag).filter((tag): tag is string => !!tag),
        games: gameRows.map((row) => row.game).filter((game): game is string => !!game),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

/** Отправка нового материала на модерацию. */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const limited = await enforceRateLimit(
      req,
      [
        { scope: "showcase:account", identifier: user.id, limit: 3, windowMs: 60 * 60_000 },
        { scope: "showcase:ip", identifier: getClientIp(req), limit: 10, windowMs: 60 * 60_000 },
      ],
      "Слишком много отправок. Попробуйте позже."
    );
    if (limited) return limited;

    const body = await req.json();
    const type = body?.type;
    const title = String(body?.title || "").trim();
    const description = String(body?.description || "").trim();
    const tags = normalizeTags(body?.tags);
    const game = normalizeGame(body?.game);
    const version = normalizeVersion(body?.version);

    if (!isShowcaseType(type)) {
      return NextResponse.json({ error: "Неверный тип материала" }, { status: 400 });
    }
    if (title.length < 3 || title.length > 100) {
      return NextResponse.json(
        { error: "Название должно быть от 3 до 100 символов" },
        { status: 400 }
      );
    }
    if (description.length > 1000) {
      return NextResponse.json(
        { error: "Описание не должно превышать 1000 символов" },
        { status: 400 }
      );
    }

    const pending = (await queryOne(
      "SELECT COUNT(*)::int AS count FROM showcase_items WHERE user_id = $1 AND status = 'pending'",
      [user.id]
    )) as { count?: number } | null;
    if (Number(pending?.count || 0) >= 5) {
      return NextResponse.json(
        { error: "У вас уже 5 материалов на модерации. Дождитесь проверки." },
        { status: 429 }
      );
    }

    let videoUrl: string | null = null;
    let fileName: string | null = null;
    let fileData: string | null = null;
    let price = 0;
    let discountPercent = 0;
    let discountUntil: string | null = null;

    if (type === "video") {
      videoUrl = String(body?.url || "").trim();
      if (!isSafeUrl(videoUrl)) {
        return NextResponse.json(
          { error: "Укажите корректную ссылку на видео (http/https)" },
          { status: 400 }
        );
      }
      if (videoUrl.length > 500) {
        return NextResponse.json({ error: "Слишком длинная ссылка" }, { status: 400 });
      }
    } else {
      const normalized = normalizePrice(body?.price);
      if (normalized === null) {
        return NextResponse.json(
          {
            error: `Цена: 0 (бесплатно) или от ${SHOWCASE_MIN_PAID_PRICE} до ${SHOWCASE_MAX_PRICE} ₽`,
          },
          { status: 400 }
        );
      }
      price = normalized;
      if (price > 0) {
        discountPercent = normalizeDiscount(body?.discount_percent);
        if (discountPercent > 0) {
          discountUntil = normalizeDiscountUntil(body?.discount_until);
        }
      }

      fileName = String(body?.file_name || "").trim();
      const rawData = typeof body?.file_data === "string" ? body.file_data : "";

      if (!fileName || !isAllowedFileName(fileName)) {
        return NextResponse.json(
          { error: "Недопустимый файл. Разрешены cfg, txt, json, ini, toml, yml, zip." },
          { status: 400 }
        );
      }

      const base64 = rawData.includes(",") ? rawData.split(",").pop() || "" : rawData;
      if (!base64 || !/^[A-Za-z0-9+/=\s]+$/.test(base64)) {
        return NextResponse.json({ error: "Файл повреждён или пустой" }, { status: 400 });
      }

      const size = Math.floor((base64.replace(/\s/g, "").length * 3) / 4);
      if (size <= 0 || size > SHOWCASE_MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: "Файл должен быть не больше 1,5 МБ" },
          { status: 400 }
        );
      }
      fileData = base64.replace(/\s/g, "");
    }

    const inserted = await query(
      `INSERT INTO showcase_items
         (user_id, type, title, description, url, file_name, file_data, price, tags,
          game, version, discount_percent, discount_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        user.id,
        type,
        title,
        description || null,
        videoUrl,
        fileName,
        fileData,
        price,
        tags,
        game,
        version,
        discountPercent,
        discountUntil,
      ]
    );

    return NextResponse.json({ ok: true, id: inserted.rows[0]?.id });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
