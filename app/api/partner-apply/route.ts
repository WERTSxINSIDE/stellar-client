import { NextResponse } from "next/server";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { query, queryAll, withTransaction } from "@/lib/db";
import { logAdminAction, findUserForLog } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { platform, channel_link, telegram, views, experience, reason } = await req.json();

    if (!["youtube", "tiktok"].includes(platform)) {
      return NextResponse.json({ error: "Неверная площадка" }, { status: 400 });
    }
    if (!channel_link || !telegram || !views || !reason) {
      return NextResponse.json({ error: "Заполните обязательные поля" }, { status: 400 });
    }

    await query(
      `INSERT INTO partner_applications (user_id, platform, channel_link, telegram, views, experience, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [user.id, platform, channel_link, telegram, views, experience || null, reason]
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const applications = await queryAll(
      `SELECT pa.id, pa.platform, pa.channel_link, pa.telegram, pa.views, pa.experience, pa.reason, pa.status, pa.admin_note, pa.created_at, u.username, u.id as user_id
       FROM partner_applications pa
       JOIN users u ON pa.user_id = u.id
       ORDER BY pa.created_at DESC`
    );

    return NextResponse.json({ ok: true, applications });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { action, application_id, admin_note } = await req.json();
    if (!application_id) {
      return NextResponse.json({ error: "Укажите application_id" }, { status: 400 });
    }

    const rows = await queryAll("SELECT user_id FROM partner_applications WHERE id = $1", [application_id]);
    if (!rows.length) {
      return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
    }

    if (action === "approve") {
      const result = await withTransaction(async (client) => {
        const app = await client.query(
          "SELECT user_id FROM partner_applications WHERE id = $1 FOR UPDATE",
          [application_id]
        );
        if (!app.rows.length) {
          return { error: "Заявка не найдена", status: 404 } as const;
        }

        await client.query(
          "UPDATE partner_applications SET status = 'approved' WHERE id = $1",
          [application_id]
        );
        await client.query(
          "UPDATE users SET role = 'media', partner_rank = 'Младший партнёр' WHERE id = $1",
          [app.rows[0].user_id]
        );

        return { ok: true, userId: Number(app.rows[0].user_id) } as const;
      });

      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }

      const target = await findUserForLog(result.userId);
      await logAdminAction(admin, "partner.approve", target, `Заявка #${application_id}`);
      await notifyUser(
        result.userId,
        {
          type: "partner",
          title: "Заявка партнёра одобрена",
          body: "Вам открыт медиа-раздел. Загружайте видео и получайте награды.",
          link: "/dashboard",
        },
        { email: true }
      ).catch(() => {});

      return NextResponse.json({ ok: true });
    }

    if (action === "reject") {
      await query("UPDATE partner_applications SET status = 'rejected', admin_note = $2 WHERE id = $1", [application_id, admin_note || null]);

      const userId = Number(rows[0].user_id);
      const target = await findUserForLog(userId);
      await logAdminAction(
        admin,
        "partner.reject",
        target,
        admin_note ? `Заявка #${application_id}: ${admin_note}` : `Заявка #${application_id}`
      );
      await notifyUser(
        userId,
        {
          type: "partner",
          title: "Заявка партнёра отклонена",
          body: admin_note || "Вы можете подать заявку снова позже.",
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
