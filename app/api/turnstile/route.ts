import { NextResponse } from "next/server";
import { turnstileConfigured, turnstileSiteKey } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

/** Публичная конфигурация капчи для клиентских форм. */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      enabled: turnstileConfigured(),
      site_key: turnstileSiteKey(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
