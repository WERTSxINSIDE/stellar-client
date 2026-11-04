import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryAll, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

type PurchaseRow = {
  id: number;
  title: string;
  description: string | null;
  type: string;
  status: string;
  price: number;
  paid_price: number;
  purchased_at: string;
  author_id: number;
  author_username: string;
  latest_version: string | null;
  latest_changelog: string | null;
  latest_version_at: string | null;
  has_file: boolean;
  url: string | null;
};

type BundleRow = {
  id: number;
  bundle_id: number;
  title: string;
  description: string | null;
  price: number;
  purchased_at: string;
};

/** Купленные конфиги, наборы и история пополнений/промокодов. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

    const purchases = (await queryAll(
      `SELECT s.id, s.title, s.description, s.type, s.status,
              COALESCE(s.price, 0)::int AS price,
              p.price::int AS paid_price,
              p.created_at AS purchased_at,
              u.id AS author_id, u.username AS author_username,
              v.version AS latest_version,
              v.changelog AS latest_changelog,
              v.created_at AS latest_version_at,
              ((s.file_data IS NOT NULL) OR (v.file_name IS NOT NULL)) AS has_file,
              s.url
         FROM showcase_purchases p
         JOIN showcase_items s ON s.id = p.item_id
         JOIN users u ON u.id = s.user_id
         LEFT JOIN LATERAL (
           SELECT version, changelog, file_name, created_at
             FROM showcase_versions
            WHERE item_id = s.id
            ORDER BY created_at DESC
            LIMIT 1
         ) v ON TRUE
        WHERE p.buyer_id = $1
        ORDER BY p.created_at DESC`,
      [user.id]
    )) as PurchaseRow[];

    const bundles = (await queryAll(
      `SELECT bp.id, bp.bundle_id, b.title, b.description,
              bp.price::int AS price, bp.created_at AS purchased_at
         FROM showcase_bundle_purchases bp
         JOIN showcase_bundles b ON b.id = bp.bundle_id
        WHERE bp.buyer_id = $1
        ORDER BY bp.created_at DESC`,
      [user.id]
    )) as BundleRow[];

    let bundleItems: {
      bundle_id: number;
      id: number;
      title: string;
      price: number;
    }[] = [];

    if (bundles.length) {
      bundleItems = (await queryAll(
        `SELECT bi.bundle_id, s.id, s.title, COALESCE(s.price, 0)::int AS price
           FROM showcase_bundle_items bi
           JOIN showcase_items s ON s.id = bi.item_id
          WHERE bi.bundle_id = ANY($1::int[])
          ORDER BY s.title ASC`,
        [bundles.map((bundle) => bundle.bundle_id)]
      )) as typeof bundleItems;
    }

    const promos = (await queryAll(
      `SELECT pu.amount::int AS amount, pc.code, pu.created_at
         FROM promo_uses pu
         JOIN promo_codes pc ON pc.id = pu.promo_id
        WHERE pu.user_id = $1
        ORDER BY pu.created_at DESC
        LIMIT 200`,
      [user.id]
    )) as { amount: number; code: string; created_at: string }[];

    const totals = (await queryOne(
      `SELECT
         (SELECT COUNT(*)::int FROM showcase_purchases WHERE buyer_id = $1) AS purchases,
         (SELECT COALESCE(SUM(price), 0)::int FROM showcase_purchases WHERE buyer_id = $1) AS spent,
         (SELECT COALESCE(SUM(amount), 0)::int FROM promo_uses WHERE user_id = $1) AS topped_up`,
      [user.id]
    )) as { purchases: number; spent: number; topped_up: number } | null;

    return NextResponse.json(
      {
        ok: true,
        purchases,
        bundles: bundles.map((bundle) => ({
          ...bundle,
          items: bundleItems.filter((item) => item.bundle_id === bundle.bundle_id),
        })),
        promos,
        totals: {
          purchases: Number(totals?.purchases || 0),
          spent: Number(totals?.spent || 0),
          topped_up: Number(totals?.topped_up || 0),
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
