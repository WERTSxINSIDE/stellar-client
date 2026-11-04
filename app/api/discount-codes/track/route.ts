import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { normalizeCode } from "@/lib/discounts";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Учитывает переход по партнёрской ссылке `/?ref=CODE`. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { code?: unknown } | null;
    const code = normalizeCode(body?.code);
    if (!code) {
      return NextResponse.json({ ok: false, error: "Код не указан" }, { status: 400 });
    }

    const limited = await enforceRateLimit(
      req,
      [
        {
          scope: "discount-track:ip",
          identifier: getClientIp(req),
          limit: 60,
          windowMs: 10 * 60_000,
        },
      ],
      "Слишком много переходов"
    );
    if (limited) return limited;

    const row = await queryOne(
      "SELECT id, owner_id FROM discount_codes WHERE code = $1 AND active = 1",
      [code]
    );
    if (!row) {
      return NextResponse.json({ ok: false, counted: false }, { status: 404 });
    }

    // Переходы самого владельца кода не считаем, чтобы не накручивать статистику.
    const user = await getCurrentUser();
    if (user && Number(row.owner_id) === user.id) {
      return NextResponse.json({ ok: true, counted: false });
    }

    await query("UPDATE discount_codes SET clicks = COALESCE(clicks, 0) + 1 WHERE id = $1", [
      row.id,
    ]);

    return NextResponse.json({ ok: true, counted: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
