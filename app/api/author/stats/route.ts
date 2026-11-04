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

type AuthorRefund = {
  id: number;
  item_id: number;
  title: string;
  buyer: string;
  amount: number;
  reason: string;
  status: string;
  admin_note: string | null;
  created_at: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Статистика автора витрины: продажи, заработок, конверсия, источники и возвраты. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const [
      items,
      sales,
      viewSeries,
      saleSeries,
      sources,
      refunds,
      viewTotals,
    ] = await Promise.all([
      queryAll(
        `SELECT s.id, s.type, s.title, s.price, s.status, s.admin_note, s.views, s.created_at,
                (SELECT COUNT(*)::int FROM showcase_purchases sp WHERE sp.item_id = s.id) AS sales,
                (SELECT COALESCE(SUM(sp.price), 0)::int FROM showcase_purchases sp WHERE sp.item_id = s.id) AS earnings,
                (SELECT COUNT(*)::int FROM showcase_ratings r WHERE r.item_id = s.id) AS ratings,
                (SELECT COALESCE(AVG(r.rating), 0)::float FROM showcase_ratings r WHERE r.item_id = s.id) AS avg_rating
         FROM showcase_items s
         WHERE s.user_id = $1
         ORDER BY earnings DESC, s.created_at DESC`,
        [user.id]
      ) as Promise<AuthorItem[]>,
      queryAll(
        `SELECT sp.id, sp.price, sp.created_at, s.id AS item_id, s.title, s.type,
                u.username AS buyer
         FROM showcase_purchases sp
         JOIN showcase_items s ON s.id = sp.item_id
         JOIN users u ON u.id = sp.buyer_id
         WHERE sp.seller_id = $1
         ORDER BY sp.created_at DESC
         LIMIT 50`,
        [user.id]
      ) as Promise<{
        id: number;
        price: number;
        created_at: string;
        item_id: number;
        title: string;
        type: string;
        buyer: string;
      }[]>,
      queryAll(
        `SELECT to_char(sv.created_at, 'YYYY-MM-DD') AS day, COUNT(*)::int AS views
         FROM showcase_views sv
         JOIN showcase_items s ON s.id = sv.item_id
         WHERE s.user_id = $1 AND sv.created_at >= NOW() - INTERVAL '14 days'
         GROUP BY 1`,
        [user.id]
      ) as Promise<{ day: string; views: number }[]>,
      queryAll(
        `SELECT to_char(sp.created_at, 'YYYY-MM-DD') AS day,
                COUNT(*)::int AS sales,
                COALESCE(SUM(sp.price), 0)::int AS earnings
         FROM showcase_purchases sp
         WHERE sp.seller_id = $1 AND sp.created_at >= NOW() - INTERVAL '14 days'
         GROUP BY 1`,
        [user.id]
      ) as Promise<{ day: string; sales: number; earnings: number }[]>,
      queryAll(
        `SELECT COALESCE(NULLIF(sv.source, ''), 'direct') AS source, COUNT(*)::int AS count
         FROM showcase_views sv
         JOIN showcase_items s ON s.id = sv.item_id
         WHERE s.user_id = $1 AND sv.created_at >= NOW() - INTERVAL '30 days'
         GROUP BY 1
         ORDER BY count DESC
         LIMIT 8`,
        [user.id]
      ) as Promise<{ source: string; count: number }[]>,
      queryAll(
        `SELECT sr.id, sr.item_id, sr.amount, sr.reason, sr.status, sr.admin_note,
                sr.created_at, s.title, u.username AS buyer
         FROM showcase_refunds sr
         JOIN showcase_items s ON s.id = sr.item_id
         JOIN users u ON u.id = sr.buyer_id
         WHERE sr.seller_id = $1
         ORDER BY sr.created_at DESC
         LIMIT 50`,
        [user.id]
      ) as Promise<AuthorRefund[]>,
      queryAll(
        `SELECT
           COUNT(*) FILTER (WHERE sv.created_at >= NOW() - INTERVAL '1 day')::int AS today,
           COUNT(*) FILTER (WHERE sv.created_at >= NOW() - INTERVAL '7 days')::int AS week,
           COUNT(*) FILTER (WHERE sv.created_at >= NOW() - INTERVAL '30 days')::int AS month
         FROM showcase_views sv
         JOIN showcase_items s ON s.id = sv.item_id
         WHERE s.user_id = $1`,
        [user.id]
      ) as Promise<{ today: number; week: number; month: number }[]>,
    ]);

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
    const views = viewTotals[0] || { today: 0, week: 0, month: 0 };

    const viewMap = new Map(viewSeries.map((row) => [String(row.day), Number(row.views) || 0]));
    const saleMap = new Map(
      saleSeries.map((row) => [
        String(row.day),
        { sales: Number(row.sales) || 0, earnings: Number(row.earnings) || 0 },
      ])
    );

    const today = new Date();
    const series: { day: string; views: number; sales: number; earnings: number }[] = [];
    for (let i = 13; i >= 0; i -= 1) {
      const date = new Date(today.getTime() - i * DAY_MS);
      const key = dayKey(date);
      const sale = saleMap.get(key);
      series.push({
        day: key,
        views: viewMap.get(key) || 0,
        sales: sale?.sales || 0,
        earnings: sale?.earnings || 0,
      });
    }

    const refundAmount = refunds
      .filter((refund) => refund.status === "approved")
      .reduce((sum, refund) => sum + Number(refund.amount || 0), 0);
    const pendingRefunds = refunds.filter((refund) => refund.status === "pending").length;

    const recentViews = series.reduce((sum, row) => sum + row.views, 0);
    const recentSales = series.reduce((sum, row) => sum + row.sales, 0);

    return NextResponse.json(
      {
        ok: true,
        items: items.map((item) => ({
          ...item,
          conversion:
            Number(item.views || 0) > 0 ? (Number(item.sales || 0) / Number(item.views)) * 100 : 0,
        })),
        sales,
        refunds,
        sources,
        series,
        totals: {
          ...totals,
          conversion,
          items: items.length,
          views_today: Number(views.today) || 0,
          views_week: Number(views.week) || 0,
          views_month: Number(views.month) || 0,
          views_14d: recentViews,
          sales_14d: recentSales,
          conversion_14d: recentViews > 0 ? (recentSales / recentViews) * 100 : 0,
          refunds_amount: refundAmount,
          refunds_pending: pendingRefunds,
          refunds_count: refunds.length,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
