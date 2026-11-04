import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Добавить/убрать материал из избранного. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Войдите, чтобы добавить в избранное" }, { status: 401 });
    }

    const limited = await enforceRateLimit(req, [
      { scope: "showcase-favorite:account", identifier: user.id, limit: 120, windowMs: 60 * 60_000 },
      { scope: "showcase-favorite:ip", identifier: getClientIp(req), limit: 240, windowMs: 60 * 60_000 },
    ]);
    if (limited) return limited;

    const { id } = await params;
    const itemId = Number(id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ error: "Неверный материал" }, { status: 400 });
    }

    const item = (await queryOne(
      "SELECT id FROM showcase_items WHERE id = $1 AND status = 'approved'",
      [itemId]
    )) as { id: number } | null;
    if (!item) {
      return NextResponse.json({ error: "Материал не найден" }, { status: 404 });
    }

    const existing = (await queryOne(
      "SELECT 1 AS found FROM showcase_favorites WHERE item_id = $1 AND user_id = $2",
      [itemId, user.id]
    )) as { found?: number } | null;

    if (existing) {
      await queryOne(
        "DELETE FROM showcase_favorites WHERE item_id = $1 AND user_id = $2 RETURNING item_id",
        [itemId, user.id]
      );
      return NextResponse.json({ ok: true, is_favorite: false });
    }

    await queryOne(
      `INSERT INTO showcase_favorites (item_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (item_id, user_id) DO NOTHING
       RETURNING item_id`,
      [itemId, user.id]
    );

    return NextResponse.json({ ok: true, is_favorite: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
