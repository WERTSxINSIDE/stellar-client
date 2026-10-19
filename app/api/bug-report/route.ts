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
    if (user.role !== "tester" && user.role !== "admin" && !user.is_admin) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { server_ip, function_name, frequency, description } = await req.json();

    if (!server_ip || !function_name || !frequency || !description) {
      return NextResponse.json({ error: "Заполните все поля" }, { status: 400 });
    }
    if (!["редко", "часто"].includes(frequency)) {
      return NextResponse.json({ error: "Неверная частота" }, { status: 400 });
    }

    await query(
      `INSERT INTO bug_reports (user_id, server_ip, function_name, frequency, description)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, server_ip, function_name, frequency, description]
    );

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

    const isAdmin = user.role === "admin" || user.is_admin;

    const reports = isAdmin
      ? await queryAll(
          `SELECT br.id, br.server_ip, br.function_name, br.frequency, br.description, br.status, br.created_at, u.username
           FROM bug_reports br
           JOIN users u ON br.user_id = u.id
           ORDER BY br.created_at DESC`
        )
      : await queryAll(
          `SELECT id, server_ip, function_name, frequency, description, status, created_at
           FROM bug_reports WHERE user_id = $1
           ORDER BY created_at DESC`,
          [user.id]
        );

    return NextResponse.json({ ok: true, reports, isAdmin });
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

    const { report_id, status } = await req.json();
    if (!report_id || !["new", "in_progress", "fixed"].includes(status)) {
      return NextResponse.json({ error: "Неверные данные" }, { status: 400 });
    }

    await query("UPDATE bug_reports SET status = $1 WHERE id = $2", [status, report_id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
