import { NextResponse } from "next/server";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { query, queryAll, queryOne } from "@/lib/db";
import { grantCoins } from "@/lib/coins";

export const dynamic = "force-dynamic";

/** Сколько SC-монет получает автор за одобренный отзыв. */
const REVIEW_COINS = 25;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const all = url.searchParams.get("all") === "1";

    if (all) {
      const admin = await requireAdmin();
      if (!admin) return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
      const rows = await queryAll(
        `SELECT r.id, r.rating, r.body, r.status, r.created_at, u.username,
                (SELECT COUNT(*)::int FROM review_votes rv WHERE rv.review_id = r.id) AS helpful
         FROM reviews r JOIN users u ON u.id = r.user_id
         ORDER BY r.created_at DESC LIMIT 300`
      );
      return NextResponse.json({ ok: true, reviews: rows });
    }

    const user = await getCurrentUser();
    const viewerId = user?.id ?? null;

    const rows = await queryAll(
      `SELECT r.id, r.rating, r.body, r.created_at, u.username, u.nickname_color,
              (SELECT COUNT(*)::int FROM review_votes rv WHERE rv.review_id = r.id) AS helpful,
              EXISTS(
                SELECT 1 FROM review_votes rv
                WHERE rv.review_id = r.id AND rv.user_id = $1
              ) AS viewer_helpful,
              EXISTS(
                SELECT 1 FROM balance_history bh
                WHERE bh.user_id = r.user_id AND bh.amount < 0
                  AND bh.type IN ('subscription', 'hwid', 'showcase_purchase', 'showcase_bundle_purchase')
              ) AS verified
       FROM reviews r JOIN users u ON u.id = r.user_id
       WHERE r.status = 'approved'
       ORDER BY r.created_at DESC LIMIT 100`,
      [viewerId]
    );

    const distributionRows = (await queryAll(
      `SELECT rating, COUNT(*)::int AS count
       FROM reviews WHERE status = 'approved'
       GROUP BY rating`
    )) as { rating: number; count: number }[];
    const distribution: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
    let total = 0;
    for (const row of distributionRows) {
      const key = String(Number(row.rating));
      if (key in distribution) distribution[key] = Number(row.count) || 0;
      total += Number(row.count) || 0;
    }

    let mine: any[] = [];
    if (user) {
      mine = await queryAll(
        `SELECT id, rating, body, status, created_at FROM reviews WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
        [user.id]
      );
    }
    return NextResponse.json({ ok: true, reviews: rows, mine, distribution, total });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Войдите в аккаунт" }, { status: 401 });

    const { rating, body } = await req.json();
    const r = Number(rating);
    if (!r || r < 1 || r > 5) return NextResponse.json({ error: "Поставьте оценку от 1 до 5" }, { status: 400 });

    const text = String(body || "").trim();
    if (text.length < 10) return NextResponse.json({ error: "Отзыв слишком короткий (минимум 10 символов)" }, { status: 400 });
    if (text.length > 1000) return NextResponse.json({ error: "Отзыв слишком длинный (максимум 1000 символов)" }, { status: 400 });

    const recent = await queryOne(
      `SELECT id FROM reviews WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 day'`,
      [user.id]
    );
    if (recent) return NextResponse.json({ error: "Вы уже отправляли отзыв за последние 24 часа" }, { status: 429 });

    await query("INSERT INTO reviews (user_id, rating, body) VALUES ($1, $2, $3)", [user.id, r, text]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Нет доступа" }, { status: 403 });

    const { action, id } = await req.json();
    if (!id || (action !== "approve" && action !== "reject")) return NextResponse.json({ error: "Неверные данные" }, { status: 400 });

    if (action === "approve") {
      const updated = await query(
        `UPDATE reviews SET status = 'approved'
         WHERE id = $1 AND status <> 'approved'
         RETURNING user_id, rating`,
        [id]
      );
      const row = updated.rows[0];
      if (row) {
        await logActivity(
          Number(row.user_id),
          "review",
          "Новый отзыв на сайте",
          String(row.rating)
        );
        await grantCoins(
          Number(row.user_id),
          REVIEW_COINS,
          "review",
          "Одобренный отзыв о клиенте"
        );
      }
    } else {
      await query("UPDATE reviews SET status = 'rejected' WHERE id = $1", [id]);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Нет доступа" }, { status: 403 });

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Неверные данные" }, { status: 400 });

    await query("DELETE FROM reviews WHERE id = $1", [id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
