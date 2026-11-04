import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Ответ автора на отзыв покупателя. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const limited = await enforceRateLimit(
      req,
      [
        { scope: "showcase-reply:account", identifier: user.id, limit: 60, windowMs: 60 * 60_000 },
        { scope: "showcase-reply:ip", identifier: getClientIp(req), limit: 120, windowMs: 60 * 60_000 },
      ],
      "Слишком много ответов. Попробуйте позже."
    );
    if (limited) return limited;

    const { id } = await params;
    const itemId = Number(id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ error: "Неверный материал" }, { status: 400 });
    }

    const body = await req.json();
    const reviewId = Number(body?.review_id);
    const reply = String(body?.reply || "").trim();

    if (!Number.isInteger(reviewId) || reviewId <= 0) {
      return NextResponse.json({ error: "Неверный отзыв" }, { status: 400 });
    }
    if (!reply || reply.length > 800) {
      return NextResponse.json(
        { error: "Ответ должен быть от 1 до 800 символов" },
        { status: 400 }
      );
    }

    const item = (await queryOne(
      "SELECT id, user_id FROM showcase_items WHERE id = $1",
      [itemId]
    )) as { id: number; user_id: number } | null;
    if (!item) {
      return NextResponse.json({ error: "Материал не найден" }, { status: 404 });
    }
    if (item.user_id !== user.id) {
      return NextResponse.json({ error: "Отвечать на отзывы может только автор" }, { status: 403 });
    }

    const updated = await query(
      `UPDATE showcase_ratings
       SET author_reply = $1, reply_at = NOW()
       WHERE id = $2 AND item_id = $3
       RETURNING id, author_reply, reply_at`,
      [reply, reviewId, itemId]
    );
    if (!updated.rows.length) {
      return NextResponse.json({ error: "Отзыв не найден" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, review: updated.rows[0] });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
