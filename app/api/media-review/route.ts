import { NextResponse } from "next/server";
import { query, queryAll, addBalanceHistory, recomputePartnerRank } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { action, submission_id, reward, admin_note, views } = await req.json();

    if (action === "list") {
      const submissions = await queryAll(
        `SELECT ms.id, ms.video_url, ms.status, ms.reward, ms.views, ms.admin_note, ms.created_at, u.username, u.id as user_id,
                (SELECT pa.platform FROM partner_applications pa
                 WHERE pa.user_id = u.id AND pa.status = 'approved'
                 ORDER BY pa.created_at DESC LIMIT 1) AS platform
         FROM media_submissions ms
         JOIN users u ON ms.user_id = u.id
         ORDER BY ms.created_at DESC`
      );
      return NextResponse.json({ ok: true, submissions });
    }

    if (action === "approve") {
      if (!submission_id) return NextResponse.json({ error: "Укажите submission_id" }, { status: 400 });
      const r = reward || 0;
      const v = views || 0;

      const sub = await queryAll("SELECT user_id FROM media_submissions WHERE id = $1", [submission_id]);
      if (!sub.length) return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });

      await query("UPDATE media_submissions SET status = 'approved', reward = $1, admin_note = $2, views = $3 WHERE id = $4", [r, admin_note || null, v, submission_id]);
      await query("UPDATE users SET balance = balance + $1 WHERE id = $2", [r, sub[0].user_id]);
      if (r > 0) await addBalanceHistory(sub[0].user_id, r, "media", "Награда за видео");
      await recomputePartnerRank(sub[0].user_id);

      return NextResponse.json({ ok: true });
    }

    if (action === "reject") {
      if (!submission_id) return NextResponse.json({ error: "Укажите submission_id" }, { status: 400 });
      const sub = await queryAll("SELECT user_id FROM media_submissions WHERE id = $1", [submission_id]);
      if (!sub.length) return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
      await query("UPDATE media_submissions SET status = 'rejected', admin_note = $1 WHERE id = $2", [admin_note || null, submission_id]);
      await recomputePartnerRank(sub[0].user_id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}