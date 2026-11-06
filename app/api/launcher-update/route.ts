import { NextResponse } from "next/server";
import {
  LAUNCHER_DOWNLOAD_PATH,
  LAUNCHER_SHA256,
  LAUNCHER_SIZE,
  LAUNCHER_VERSION,
} from "@/lib/launcher";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return NextResponse.json(
    {
      version: LAUNCHER_VERSION,
      url: new URL(LAUNCHER_DOWNLOAD_PATH, req.url).toString(),
      size: LAUNCHER_SIZE,
      sha256: LAUNCHER_SHA256,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
