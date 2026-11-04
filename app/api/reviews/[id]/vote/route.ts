import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Переключает отметку «полезно» у одобренного отзыва. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Войдите, чтобы оценить отзыв" }, { status: 401 });
    }

    const limited = await enforceRateLimit(
      req,
      [{ scope: "review-vote:account", identifier: user.id, limit: 60, windowMs: 60 * 60_000 }],
      "Слишком много отметок. Попробуйте позже."
    );
    if (limited) return limited;

    const { id } = await params;
    const reviewId = Number(id);
    if (!Number.isInteger(reviewId) || reviewId <= 0) {
      return NextResponse.json({ error: "Неверный отзыв" }, { status: 400 });
    }

    const review = (await queryOne(
      "SELECT id, user_id FROM reviews WHERE id = $1 AND status = 'approved'",
      [reviewId]
    )) as { id: number; user_id: number } | null;
    if (!review) {
      return NextResponse.json({ error: "Отзыв не найден" }, { status: 404 });
    }
    if (review.user_id === user.id) {
      return NextResponse.json({ error: "Нельзя оценивать собственный отзыв" }, { status: 400 });
    }

    const existing = await queryOne(
      "SELECT 1 AS found FROM review_votes WHERE review_id = $1 AND user_id = $2",
      [reviewId, user.id]
    );

    let voted: boolean;
    if (existing) {
      await query("DELETE FROM review_votes WHERE review_id = $1 AND user_id = $2", [
        reviewId,
        user.id,
      ]);
      voted = false;
    } else {
      await query(
        `INSERT INTO review_votes (review_id, user_id) VALUES ($1, $2)
         ON CONFLICT (review_id, user_id) DO NOTHING`,
        [reviewId, user.id]
      );
      voted = true;
    }

    const row = (await queryOne(
      "SELECT COUNT(*)::int AS count FROM review_votes WHERE review_id = $1",
      [reviewId]
    )) as { count?: number } | null;

    return NextResponse.json({ ok: true, voted, helpful: Number(row?.count) || 0 });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
