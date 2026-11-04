import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import {
  addBalanceHistory,
  query,
  queryAll,
  queryOne,
  withTransaction,
} from "@/lib/db";
import { logAdminAction } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { logActivity } from "@/lib/activity";
import { SHOWCASE_DEFAULT_REWARD, isShowcaseType } from "@/lib/showcase";

export const dynamic = "force-dynamic";

type ShowcaseRow = {
  id: number;
  user_id: number;
  type: string;
  title: string;
  description: string | null;
  url: string | null;
  file_name: string | null;
  price: number | null;
  status: string;
  reward: number | null;
  admin_note: string | null;
  views: number | null;
  sales: number;
  created_at: string | null;
  approved_at: string | null;
  username: string;
  email: string;
  avatar_url: string | null;
  avg_rating: number;
  ratings: number;
};

/** Список материалов для админки + счётчики по статусам. */
export async function GET(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const url = new URL(req.url);
    const statusParam = (url.searchParams.get("status") || "pending").toLowerCase();
    const status = ["pending", "approved", "rejected", "hidden", "all"].includes(statusParam)
      ? statusParam
      : "pending";

    const [items, counts] = await Promise.all([
      queryAll(
        `SELECT s.id, s.user_id, s.type, s.title, s.description, s.url, s.file_name,
                s.price, s.status, s.reward, s.admin_note, s.views, s.created_at, s.approved_at,
                u.username, u.email, u.avatar_url,
                COALESCE(AVG(r.rating), 0)::float AS avg_rating,
                COUNT(r.id)::int AS ratings,
                (SELECT COUNT(*)::int FROM showcase_purchases sp WHERE sp.item_id = s.id) AS sales
         FROM showcase_items s
         JOIN users u ON u.id = s.user_id
         LEFT JOIN showcase_ratings r ON r.item_id = s.id
         WHERE ($1::text = 'all' OR s.status = $1)
         GROUP BY s.id, u.username, u.email, u.avatar_url
         ORDER BY s.created_at DESC
         LIMIT 200`,
        [status]
      ) as Promise<ShowcaseRow[]>,
      queryOne(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
           COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
           COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
           COUNT(*) FILTER (WHERE status = 'hidden')::int AS hidden,
           COUNT(*)::int AS total
         FROM showcase_items`
      ),
    ]);

    return NextResponse.json({ ok: true, items, counts, status });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

/** Модерация: одобрить с наградой, отклонить, скрыть или вернуть. */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const body = await req.json();
    const action = String(body?.action || "");
    const itemId = Number(body?.id);
    const adminNote = String(body?.admin_note || "").trim().slice(0, 500) || null;

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ error: "Неверный материал" }, { status: 400 });
    }
    if (!["approve", "reject", "hide", "restore"].includes(action)) {
      return NextResponse.json({ error: "Неверное действие" }, { status: 400 });
    }

    const item = (await queryOne(
      `SELECT s.id, s.user_id, s.type, s.title, s.status, s.reward,
              u.username
       FROM showcase_items s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1`,
      [itemId]
    )) as
      | {
          id: number;
          user_id: number;
          type: string;
          title: string;
          status: string;
          reward: number | null;
          username: string;
        }
      | null;

    if (!item) {
      return NextResponse.json({ error: "Материал не найден" }, { status: 404 });
    }

    if (action === "approve") {
      if (item.status === "approved") {
        return NextResponse.json({ error: "Материал уже одобрен" }, { status: 400 });
      }

      const rawReward = Number(body?.reward);
      const fallback = isShowcaseType(item.type) ? SHOWCASE_DEFAULT_REWARD[item.type] : 50;
      const reward = Number.isFinite(rawReward)
        ? Math.max(0, Math.min(5000, Math.floor(rawReward)))
        : fallback;

      await withTransaction(async (client) => {
        await client.query(
          `UPDATE showcase_items
           SET status = 'approved', reward = $2, admin_note = $3, approved_at = NOW()
           WHERE id = $1`,
          [itemId, reward, adminNote]
        );

        if (reward > 0) {
          await client.query(
            "UPDATE users SET balance = COALESCE(balance, 0) + $2 WHERE id = $1",
            [item.user_id, reward]
          );
          await addBalanceHistory(
            item.user_id,
            reward,
            "showcase",
            `Награда за материал: ${item.title}`,
            client
          );
        }
      });

      await notifyUser(item.user_id, {
        type: "showcase",
        title: "Материал принят",
        body:
          reward > 0
            ? `«${item.title}» опубликован в витрине. На баланс начислено ${reward} ₽.`
            : `«${item.title}» опубликован в витрине.`,
        link: "/community",
      }).catch(() => {});

      await logActivity(
        item.user_id,
        "showcase",
        `Материал: ${item.title}`,
        item.type === "config" ? "Конфиг" : "Видео-отзыв"
      );

      await logAdminAction(
        admin,
        "showcase_approve",
        { id: item.user_id, username: item.username },
        `Материал #${itemId} «${item.title}», награда ${reward} ₽`
      );

      return NextResponse.json({ ok: true, reward });
    }

    if (action === "reject") {
      await query(
        `UPDATE showcase_items SET status = 'rejected', admin_note = $2 WHERE id = $1`,
        [itemId, adminNote]
      );

      await notifyUser(item.user_id, {
        type: "showcase",
        title: "Материал отклонён",
        body: adminNote
          ? `«${item.title}» не принят. Причина: ${adminNote}`
          : `«${item.title}» не принят модератором.`,
        link: "/community",
      }).catch(() => {});

      await logAdminAction(
        admin,
        "showcase_reject",
        { id: item.user_id, username: item.username },
        `Материал #${itemId} «${item.title}»${adminNote ? `, причина: ${adminNote}` : ""}`
      );

      return NextResponse.json({ ok: true });
    }

    if (action === "hide") {
      await query(
        `UPDATE showcase_items SET status = 'hidden', admin_note = $2 WHERE id = $1`,
        [itemId, adminNote]
      );

      await logAdminAction(
        admin,
        "showcase_hide",
        { id: item.user_id, username: item.username },
        `Материал #${itemId} «${item.title}»`
      );

      return NextResponse.json({ ok: true });
    }

    // restore — возвращаем скрытый материал в витрину без повторной награды
    await query(
      `UPDATE showcase_items
       SET status = 'approved', admin_note = $2, approved_at = COALESCE(approved_at, NOW())
       WHERE id = $1`,
      [itemId, adminNote]
    );

    await logAdminAction(
      admin,
      "showcase_restore",
      { id: item.user_id, username: item.username },
      `Материал #${itemId} «${item.title}»`
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("admin showcase error:", e?.message || e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
