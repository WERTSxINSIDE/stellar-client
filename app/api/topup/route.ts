import { NextResponse } from "next/server";
import { getTopupLinks, TOPUP_AMOUNTS } from "@/lib/payments";

export const dynamic = "force-dynamic";

/** Публичные ссылки на пополнение баланса. */
export async function GET() {
  try {
    const links = await getTopupLinks();
    return NextResponse.json(
      { ok: true, amounts: TOPUP_AMOUNTS, links },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ ok: true, amounts: TOPUP_AMOUNTS, links: {} });
  }
}
