import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Учитывает открытие карточки материала. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const itemId = Number(id);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ error: "Неверный материал" }, { status: 400 });
    }

    const limited = await enforceRateLimit(
      req,
      [{ scope: "showcase-view:ip", identifier: getClientIp(req), limit: 240, windowMs: 60 * 60_000 }],
      "Слишком много запросов"
    );
    if (limited) return limited;

    await query(
      "UPDATE showcase_items SET views = COALESCE(views, 0) + 1 WHERE id = $1 AND status = 'approved'",
      [itemId]
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
