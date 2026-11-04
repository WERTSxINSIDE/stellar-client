import { NextResponse } from "next/server";
import {
  addBalanceHistory,
  queryAll,
  recomputePartnerRank,
  withTransaction,
} from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { logAdminAction, findUserForLog } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";

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
      const r = Number(reward) || 0;
      const v = Number(views) || 0;

      const result = await withTransaction(async (client) => {
        const sub = await client.query(
          "SELECT user_id, status, reward FROM media_submissions WHERE id = $1 FOR UPDATE",
          [submission_id]
        );
        if (!sub.rows.length) {
          return { error: "Заявка не найдена", status: 404 } as const;
        }

        const userId = sub.rows[0].user_id as number;
        // Если заявку уже одобряли, награду можно только увеличить:
        // повторное нажатие с пустым полем не спишет и не оплатит её дважды.
        const alreadyApproved = sub.rows[0].status === "approved";
        const previousReward = alreadyApproved ? Number(sub.rows[0].reward) || 0 : 0;
        const finalReward = alreadyApproved ? Math.max(previousReward, r) : r;
        const delta = finalReward - previousReward;

        await client.query(
          "UPDATE media_submissions SET status = 'approved', reward = $1, admin_note = $2, views = $3 WHERE id = $4",
          [finalReward, admin_note || null, v, submission_id]
        );

        if (delta > 0) {
          await client.query(
            "UPDATE users SET balance = COALESCE(balance, 0) + $1 WHERE id = $2",
            [delta, userId]
          );
          await addBalanceHistory(
            userId,
            delta,
            "media",
            "Награда за видео",
            client
          );
        }

        await recomputePartnerRank(userId, client);

        return { ok: true, userId, reward: finalReward, views: v } as const;
      });

      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }

      const target = await findUserForLog(result.userId);
      await logAdminAction(
        admin,
        "media.approve",
        target,
        `Видео #${submission_id}, награда ${result.reward} ₽, просмотры ${result.views}`
      );
      await notifyUser(
        result.userId,
        {
          type: "media",
          title: "Видео одобрено",
          body:
            result.reward > 0
              ? `Награда ${result.reward} ₽ зачислена на баланс.`
              : "Ваше видео прошло проверку.",
          link: "/dashboard",
        },
        { email: true }
      ).catch(() => {});

      return NextResponse.json({ ok: true });
    }

    if (action === "reject") {
      if (!submission_id) return NextResponse.json({ error: "Укажите submission_id" }, { status: 400 });

      const result = await withTransaction(async (client) => {
        const sub = await client.query(
          "SELECT user_id FROM media_submissions WHERE id = $1 FOR UPDATE",
          [submission_id]
        );
        if (!sub.rows.length) {
          return { error: "Заявка не найдена", status: 404 } as const;
        }

        await client.query(
          "UPDATE media_submissions SET status = 'rejected', admin_note = $1 WHERE id = $2",
          [admin_note || null, submission_id]
        );
        await recomputePartnerRank(sub.rows[0].user_id as number, client);

        return { ok: true, userId: Number(sub.rows[0].user_id) } as const;
      });

      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }

      const target = await findUserForLog(result.userId);
      await logAdminAction(
        admin,
        "media.reject",
        target,
        admin_note ? `Видео #${submission_id}: ${admin_note}` : `Видео #${submission_id}`
      );
      await notifyUser(
        result.userId,
        {
          type: "media",
          title: "Видео отклонено",
          body: admin_note || "Заявка не прошла проверку. Можно отправить новое видео.",
          link: "/dashboard",
        },
        { email: true }
      ).catch(() => {});

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
