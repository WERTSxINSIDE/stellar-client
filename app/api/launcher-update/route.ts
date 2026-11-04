import { NextResponse } from "next/server";
import { LAUNCHER_DOWNLOAD_URL, LAUNCHER_VERSION } from "@/lib/launcher";

export async function GET() {
  return NextResponse.json({
    version: LAUNCHER_VERSION,
    url: LAUNCHER_DOWNLOAD_URL,
    size: 0,
  });
}
