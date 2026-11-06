import { NextResponse } from "next/server";
import { getCurrentUser, isSupportStaff } from "@/lib/auth";
import {
  LAUNCHER_DOWNLOAD_PATH,
  LAUNCHER_MAINTENANCE,
  LAUNCHER_MAINTENANCE_MESSAGE,
} from "@/lib/launcher";

export const dynamic = "force-dynamic";

/**
 * Отдаёт exe только персоналу. Во время технических работ обычные
 * пользователи получают сообщение вместо файла.
 */
export async function GET(req: Request) {
  if (LAUNCHER_MAINTENANCE) {
    const user = await getCurrentUser();
    if (!isSupportStaff(user)) {
      return NextResponse.json(
        { ok: false, error: LAUNCHER_MAINTENANCE_MESSAGE },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }
  }

  return NextResponse.redirect(new URL(LAUNCHER_DOWNLOAD_PATH, req.url), 307);
}
