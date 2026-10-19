import { NextResponse } from "next/server";
import { query, queryOne, queryAll } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
    }

    const { action, key_id } = await req.json();

    if (action === "list") {
      const keys = await queryAll("SELECT * FROM keys ORDER BY created_at DESC");
      return NextResponse.json({ ok: true, keys });
    }

    if (action === "delete" && key_id) {
      await query("DELETE FROM keys WHERE id = $1 AND activated_by IS NULL", [key_id]);
      return NextResponse.json({ ok: true });
    }

    if (action === "delete-used" && key_id) {
      await query("DELETE FROM keys WHERE id = $1", [key_id]);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
