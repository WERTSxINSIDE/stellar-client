import { NextResponse } from "next/server";
import { query, queryAll, addBalanceHistory } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { admin_token, action, submission_id, reward, admin_note } = await req.json();

    if (admin_token !== "euphoria-admin-2024") {
      return NextResponse.json({ error: "Неверный токен" }, { status: 403 });
    }

    if (action === "list") {
      const submissions = await queryAll(
        `SELECT ms.id, ms.video_url, ms.status, ms.reward, ms.admin_note, ms.created_at, u.username, u.id as user_id
         FROM media_submissions ms
         JOIN users u ON ms.user_id = u.id
         ORDER BY ms.created_at DESC`
      );
      return NextResponse.json({ ok: true, submissions });
    }

    if (action === "approve") {
      if (!submission_id) return NextResponse.json({ error: "Укажите submission_id" }, { status: 400 });
      const r = reward || 0;

      const sub = await queryAll("SELECT user_id FROM media_submissions WHERE id = $1", [submission_id]);
      if (!sub.length) return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });

      await query("UPDATE media_submissions SET status = 'approved', reward = $1, admin_note = $2 WHERE id = $3", [r, admin_note || null, submission_id]);
      await query("UPDATE users SET balance = balance + $1 WHERE id = $2", [r, sub[0].user_id]);
      if (r > 0) await addBalanceHistory(sub[0].user_id, r, "media", "Награда за видео");

      return NextResponse.json({ ok: true });
    }

    if (action === "reject") {
      if (!submission_id) return NextResponse.json({ error: "Укажите submission_id" }, { status: 400 });
      await query("UPDATE media_submissions SET status = 'rejected', admin_note = $1 WHERE id = $2", [admin_note || null, submission_id]);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}