import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryAll, queryOne, withTransaction } from "@/lib/db";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  discountedPrice,
  normalizeDiscount,
} from "@/lib/showcase";

export const dynamic = "force-dynamic";

const MIN_BUNDLE_ITEMS = 2;
const MAX_BUNDLE_ITEMS = 20;

type BundleRow = {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  discount_percent: number;
  status: string;
  created_at: string;
  username: string;
  avatar_url: string | null;
};

type BundleItemRow = {
  bundle_id: number;
  id: number;
  title: string;
  type: string;
  price: number | null;
  discount_percent: number | null;
  discount_until: string | null;
  file_name: string | null;
};

/** Наборы конфигов автора: публичный список или свои (mine=1). */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const mine = url.searchParams.get("mine") === "1";
    const user = await getCurrentUser();

    if (mine && !user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const bundles = (await queryAll(
      `SELECT b.id, b.user_id, b.title, b.description, b.discount_percent,
              b.status, b.created_at, u.username, u.avatar_url
       FROM showcase_bundles b
       JOIN users u ON u.id = b.user_id
       WHERE ${mine ? "b.user_id = $1" : "b.status = 'approved' AND COALESCE(u.banned, 0) = 0"}
       ORDER BY b.created_at DESC
       LIMIT 60`,
      mine ? [user!.id] : []
    )) as BundleRow[];

    const bundleIds = bundles.map((bundle) => bundle.id);
    const itemRows = bundleIds.length
      ? ((await queryAll(
          `SELECT bi.bundle_id, s.id, s.title, s.type, s.price,
                  s.discount_percent, s.discount_until, s.file_name
           FROM showcase_bundle_items bi
           JOIN showcase_items s ON s.id = bi.item_id
           WHERE bi.bundle_id = ANY($1::int[])
           ORDER BY s.price DESC, s.id ASC`,
          [bundleIds]
        )) as BundleItemRow[])
      : [];

    const itemIds = itemRows.map((item) => item.id);

    const ownedRows =
      user && itemIds.length
        ? ((await queryAll(
            `SELECT item_id FROM showcase_purchases
             WHERE buyer_id = $1 AND item_id = ANY($2::int[])`,
            [user.id, itemIds]
          )) as { item_id: number }[])
        : [];
    const owned = new Set(ownedRows.map((row) => row.item_id));

    const purchasedRows = user
      ? ((await queryAll(
          "SELECT bundle_id FROM showcase_bundle_purchases WHERE buyer_id = $1",
          [user.id]
        )) as { bundle_id: number }[])
      : [];
    const purchasedBundles = new Set(purchasedRows.map((row) => row.bundle_id));

    const itemsByBundle = new Map<number, (BundleItemRow & { final_price: number; owned: boolean })[]>();
    for (const row of itemRows) {
      const price = Number(row.price || 0);
      const entry = {
        ...row,
        price,
        final_price: discountedPrice(price, row.discount_percent, row.discount_until),
        owned: owned.has(row.id),
      };
      const list = itemsByBundle.get(row.bundle_id) || [];
      list.push(entry);
      itemsByBundle.set(row.bundle_id, list);
    }

    const result = bundles.map((bundle) => {
      const items = itemsByBundle.get(bundle.id) || [];
      const unowned = items.filter((item) => !item.owned);
      const basePrice = unowned.reduce((sum, item) => sum + item.final_price, 0);
      const percent = Number(bundle.discount_percent || 0);
      const finalPrice = Math.round((basePrice * (100 - percent)) / 100);

      return {
        ...bundle,
        discount_percent: percent,
        items,
        items_count: items.length,
        base_price: basePrice,
        final_price: finalPrice,
        purchased:
          purchasedBundles.has(bundle.id) ||
          (items.length > 0 && unowned.length === 0),
        is_owner: bundle.user_id === user?.id,
      };
    });

    return NextResponse.json(
      { ok: true, bundles: result },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

/** Создание набора из собственных одобренных конфигов. */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const limited = await enforceRateLimit(
      req,
      [
        { scope: "showcase-bundle:account", identifier: user.id, limit: 10, windowMs: 60 * 60_000 },
        { scope: "showcase-bundle:ip", identifier: getClientIp(req), limit: 20, windowMs: 60 * 60_000 },
      ],
      "Слишком много запросов. Попробуйте позже."
    );
    if (limited) return limited;

    const body = await req.json();
    const title = String(body?.title || "").trim();
    const description = String(body?.description || "").trim();
    const discountPercent = normalizeDiscount(body?.discount_percent);
    const rawIds = Array.isArray(body?.item_ids) ? body.item_ids : [];

    if (title.length < 3 || title.length > 80) {
      return NextResponse.json(
        { error: "Название набора должно быть от 3 до 80 символов" },
        { status: 400 }
      );
    }
    if (description.length > 500) {
      return NextResponse.json(
        { error: "Описание не должно превышать 500 символов" },
        { status: 400 }
      );
    }
    if (discountPercent <= 0) {
      return NextResponse.json({ error: "Укажите скидку от 1 до 90%" }, { status: 400 });
    }

    const itemIds = Array.from(
      new Set(
        rawIds
          .map((value: unknown) => Number(value))
          .filter((value: number) => Number.isInteger(value) && value > 0)
      )
    );
    if (itemIds.length < MIN_BUNDLE_ITEMS || itemIds.length > MAX_BUNDLE_ITEMS) {
      return NextResponse.json(
        {
          error: `В наборе должно быть от ${MIN_BUNDLE_ITEMS} до ${MAX_BUNDLE_ITEMS} конфигов`,
        },
        { status: 400 }
      );
    }

    const items = (await queryAll(
      `SELECT id, user_id, type, status FROM showcase_items
       WHERE id = ANY($1::int[])`,
      [itemIds]
    )) as { id: number; user_id: number; type: string; status: string }[];

    if (items.length !== itemIds.length) {
      return NextResponse.json({ error: "Некоторые конфиги не найдены" }, { status: 400 });
    }
    if (items.some((item) => item.user_id !== user.id)) {
      return NextResponse.json(
        { error: "В набор можно добавлять только свои конфиги" },
        { status: 403 }
      );
    }
    if (items.some((item) => item.type !== "config" || item.status !== "approved")) {
      return NextResponse.json(
        { error: "В набор можно добавлять только одобренные конфиги" },
        { status: 400 }
      );
    }

    const bundleId = await withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO showcase_bundles (user_id, title, description, discount_percent, status)
         VALUES ($1, $2, $3, $4, 'approved')
         RETURNING id`,
        [user.id, title, description || null, discountPercent]
      );
      const id = Number(inserted.rows[0]?.id);

      for (const itemId of itemIds) {
        await client.query(
          `INSERT INTO showcase_bundle_items (bundle_id, item_id)
           VALUES ($1, $2)
           ON CONFLICT (bundle_id, item_id) DO NOTHING`,
          [id, itemId]
        );
      }

      return id;
    });

    return NextResponse.json({ ok: true, id: bundleId });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

/** Удаление своего набора. */
export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const url = new URL(req.url);
    const bundleId = Number(url.searchParams.get("id"));
    if (!Number.isInteger(bundleId) || bundleId <= 0) {
      return NextResponse.json({ error: "Неверный набор" }, { status: 400 });
    }

    const bundle = (await queryOne(
      "SELECT id, user_id FROM showcase_bundles WHERE id = $1",
      [bundleId]
    )) as { id: number; user_id: number } | null;
    if (!bundle) {
      return NextResponse.json({ error: "Набор не найден" }, { status: 404 });
    }
    if (bundle.user_id !== user.id) {
      return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
    }

    await queryOne("DELETE FROM showcase_bundles WHERE id = $1 RETURNING id", [bundleId]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
