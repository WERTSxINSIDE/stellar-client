import { NextResponse } from "next/server";
import { LAUNCHER_DOWNLOAD_PATH } from "@/lib/launcher";

export const dynamic = "force-dynamic";

/**
 * Стабильная ссылка на скачивание: редиректит на файл в /public.
 * Домен берём из запроса, чтобы ссылка работала и на превью-деплоях.
 */
export async function GET(req: Request) {
  return NextResponse.redirect(new URL(LAUNCHER_DOWNLOAD_PATH, req.url), 307);
}
