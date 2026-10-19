import { NextResponse } from "next/server";
import { getCurrentUser, requireAdmin } from "@/lib/auth";
import { query, queryAll } from "@/lib/db";

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
      await query("UPDATE partner_applications SET status = 'approved' WHERE id = $1", [application_id]);
      await query("UPDATE users SET role = 'media', partner_rank = 'Младший партнёр' WHERE id = $1", [rows[0].user_id]);
      return NextResponse.json({ ok: true });
    }

    if (action === "reject") {
      await query("UPDATE partner_applications SET status = 'rejected', admin_note = $2 WHERE id = $1", [application_id, admin_note || null]);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
