import { NextResponse } from "next/server";
import { LAUNCHER_DOWNLOAD_URL } from "@/lib/launcher";

export async function GET() {
  return NextResponse.redirect(LAUNCHER_DOWNLOAD_URL);
}
