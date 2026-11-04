import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import {
  applyCodeDiscount,
  discountCodeError,
  normalizeCode,
  type DiscountCodeRow,
} from "@/lib/discounts";
import { enforceRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Проверка кода перед покупкой. Клики считает отдельный эндпоинт /track. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = normalizeCode(url.searchParams.get("code"));
    if (!code) {
      return NextResponse.json({ error: "Введите код" }, { status: 400 });
    }

    const limited = await enforceRateLimit(
      req,
      [{ scope: "discount-validate:ip", identifier: req.headers.get("x-forwarded-for") || "local", limit: 120, windowMs: 60 * 60_000 }],
      "Слишком много проверок кода"
    );
    if (limited) return limited;

    const row = (await queryOne(
      `SELECT id, owner_id, kind, code, discount_percent, max_uses, used_count,
              clicks, signups, sales_count, sales_amount, active, expires_at
       FROM discount_codes WHERE code = $1`,
      [code]
    )) as DiscountCodeRow | null;

    const user = await getCurrentUser();
    const buyerId = user?.id ?? 0;

    const itemId = Number(url.searchParams.get("item") || 0);
    const bundleId = Number(url.searchParams.get("bundle") || 0);

    let sellerId: number | null = null;
    if (Number.isInteger(itemId) && itemId > 0) {
      const item = await queryOne("SELECT user_id FROM showcase_items WHERE id = $1", [itemId]);
      sellerId = item ? Number(item.user_id) : null;
    } else if (Number.isInteger(bundleId) && bundleId > 0) {
      const bundle = await queryOne("SELECT user_id FROM showcase_bundles WHERE id = $1", [bundleId]);
      sellerId = bundle ? Number(bundle.user_id) : null;
    }

    const error = discountCodeError(row, buyerId, sellerId);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const safe = row as DiscountCodeRow;
    const amount = Math.max(0, Math.floor(Number(url.searchParams.get("amount") || 0)));
    const finalPrice = amount > 0 ? applyCodeDiscount(amount, safe.discount_percent) : null;

    return NextResponse.json({
      ok: true,
      code: {
        code: safe.code,
        kind: safe.kind,
        discount_percent: Number(safe.discount_percent),
        expires_at: safe.expires_at,
      },
      final_price: finalPrice,
      discount: amount > 0 ? amount - (finalPrice ?? amount) : 0,
      message:
        safe.kind === "partner"
          ? "Партнёрский код применён"
          : `Купон автора: −${safe.discount_percent}%`,
    });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
