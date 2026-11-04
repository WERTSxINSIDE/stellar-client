import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryAll } from "@/lib/db";

export const dynamic = "force-dynamic";

type AuthorItem = {
  id: number;
  type: string;
  title: string;
  price: number | null;
  status: string;
  admin_note: string | null;
  views: number | null;
  created_at: string;
  sales: number;
  earnings: number;
  ratings: number;
  avg_rating: number;
};

/** Статистика автора витрины: продажи, заработок, конверсия и модерация. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const items = (await queryAll(
      `SELECT s.id, s.type, s.title, s.price, s.status, s.admin_note, s.views, s.created_at,
              (SELECT COUNT(*)::int FROM showcase_purchases sp WHERE sp.item_id = s.id) AS sales,
              (SELECT COALESCE(SUM(sp.price), 0)::int FROM showcase_purchases sp WHERE sp.item_id = s.id) AS earnings,
              (SELECT COUNT(*)::int FROM showcase_ratings r WHERE r.item_id = s.id) AS ratings,
              (SELECT COALESCE(AVG(r.rating), 0)::float FROM showcase_ratings r WHERE r.item_id = s.id) AS avg_rating
       FROM showcase_items s
       WHERE s.user_id = $1
       ORDER BY earnings DESC, s.created_at DESC`,
      [user.id]
    )) as AuthorItem[];

    const sales = (await queryAll(
      `SELECT sp.id, sp.price, sp.created_at, s.id AS item_id, s.title, s.type,
              u.username AS buyer
       FROM showcase_purchases sp
       JOIN showcase_items s ON s.id = sp.item_id
       JOIN users u ON u.id = sp.buyer_id
       WHERE sp.seller_id = $1
       ORDER BY sp.created_at DESC
       LIMIT 50`,
      [user.id]
    )) as {
      id: number;
      price: number;
      created_at: string;
      item_id: number;
      title: string;
      type: string;
      buyer: string;
    }[];

    const totals = items.reduce(
      (acc, item) => {
        acc.views += Number(item.views || 0);
        acc.sales += Number(item.sales || 0);
        acc.earnings += Number(item.earnings || 0);
        if (item.status === "approved") acc.approved += 1;
        if (item.status === "pending") acc.pending += 1;
        if (item.status === "rejected") acc.rejected += 1;
        return acc;
      },
      { views: 0, sales: 0, earnings: 0, approved: 0, pending: 0, rejected: 0 }
    );

    const conversion = totals.views > 0 ? (totals.sales / totals.views) * 100 : 0;

    return NextResponse.json(
      {
        ok: true,
        items: items.map((item) => ({
          ...item,
          conversion:
            Number(item.views || 0) > 0 ? (Number(item.sales || 0) / Number(item.views)) * 100 : 0,
        })),
        sales,
        totals: { ...totals, conversion, items: items.length },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
