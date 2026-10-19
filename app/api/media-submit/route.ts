import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, queryAll, recomputePartnerRank } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    if (user.role !== "media" && user.role !== "admin") {
      return NextResponse.json({ error: "Только для медиа" }, { status: 403 });
    }

    const { video_url } = await req.json();
    if (!video_url) {
      return NextResponse.json({ error: "Введите ссылку на видео" }, { status: 400 });
    }

    await query("INSERT INTO media_submissions (user_id, video_url) VALUES ($1, $2)", [user.id, video_url]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const submissions = await queryAll(
      "SELECT id, video_url, status, reward, views, admin_note, created_at FROM media_submissions WHERE user_id = $1 ORDER BY created_at DESC",
      [user.id]
    );

    const info = await recomputePartnerRank(user.id);

    return NextResponse.json({ ok: true, submissions, ...info });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}