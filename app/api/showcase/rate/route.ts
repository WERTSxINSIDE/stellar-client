import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { getItemRating } from "@/lib/showcase";

export const dynamic = "force-dynamic";

/** Поставить или обновить оценку и текстовый отзыв (1–5). */
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const limited = await enforceRateLimit(
      req,
      [
        { scope: "showcase-rate:account", identifier: user.id, limit: 60, windowMs: 60 * 60_000 },
        { scope: "showcase-rate:ip", identifier: getClientIp(req), limit: 120, windowMs: 60 * 60_000 },
      ],
      "Слишком много оценок. Попробуйте позже."
    );
    if (limited) return limited;

    const body = await req.json();
    const itemId = Number(body?.id);
    const value = Number(body?.rating);
    const hasComment = Object.prototype.hasOwnProperty.call(body, "comment");
    const comment = hasComment ? String(body?.comment || "").trim() : undefined;

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ error: "Неверный материал" }, { status: 400 });
    }
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      return NextResponse.json({ error: "Оценка должна быть от 1 до 5" }, { status: 400 });
    }
    if (comment && comment.length > 1000) {
      return NextResponse.json({ error: "Отзыв не должен превышать 1000 символов" }, { status: 400 });
    }

    const item = (await queryOne(
      "SELECT id, user_id, type, price FROM showcase_items WHERE id = $1 AND status = 'approved'",
      [itemId]
    )) as { id: number; user_id: number; type: string; price: number | null } | null;
    if (!item) {
      return NextResponse.json({ error: "Материал не найден" }, { status: 404 });
    }
    if (item.user_id === user.id) {
      return NextResponse.json({ error: "Нельзя оценивать собственный материал" }, { status: 400 });
    }

    const price = Number(item.price || 0);
    if (item.type === "config" && price > 0) {
      const purchase = await queryOne(
        "SELECT id FROM showcase_purchases WHERE item_id = $1 AND buyer_id = $2",
        [itemId, user.id]
      );
      if (!purchase) {
        return NextResponse.json(
          { error: "Отзыв доступен только после покупки конфига" },
          { status: 403 }
        );
      }
    }

    await query(
      `INSERT INTO showcase_ratings (item_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (item_id, user_id)
       DO UPDATE SET
         rating = EXCLUDED.rating,
         comment = CASE WHEN $5::boolean THEN EXCLUDED.comment ELSE showcase_ratings.comment END,
         updated_at = NOW()`,
      [itemId, user.id, value, comment ?? null, hasComment]
    );

    const result = await getItemRating(itemId);
    const own = (await queryOne(
      "SELECT comment FROM showcase_ratings WHERE item_id = $1 AND user_id = $2",
      [itemId, user.id]
    )) as { comment: string | null } | null;

    return NextResponse.json({
      ok: true,
      ...result,
      my_rating: value,
      my_comment: own?.comment ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
