import { NextResponse } from "next/server";
import { CLIENT_VERSION } from "@/lib/client-version";

export const dynamic = "force-dynamic";

/**
 * Public, cache-free version probe used by the mod.
 *
 * The client compares this value with its own Fabric mod version. When the
 * site is newer, the mod shows a small "restart the client" notice in the
 * corner of the HUD. No auth is required: the response contains no user data.
 */
export async function GET() {
  return NextResponse.json(
    { ok: true, version: CLIENT_VERSION },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
