import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { queryAll, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });

    const url = new URL(req.url);
    const search = (url.searchParams.get("q") || "").trim();
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 100));

    const params: unknown[] = [];
    let where = "";

    if (search) {
      params.push(`%${search}%`);
      where = `WHERE a.action ILIKE $1 OR a.admin_username ILIKE $1 OR a.target_username ILIKE $1 OR a.details ILIKE $1`;
    }

    params.push(limit);
    const logs = await queryAll(
      `SELECT a.id, a.admin_id, a.admin_username, a.action, a.target_user_id,
              a.target_username, a.details, a.created_at
       FROM admin_actions a
       ${where}
       ORDER BY a.created_at DESC
       LIMIT $${params.length}`,
      params
    );

    const count = (await queryOne("SELECT COUNT(*)::int AS total FROM admin_actions")) as
      | { total: number }
      | null;

    return NextResponse.json({ ok: true, logs, total: count?.total ?? logs.length });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
