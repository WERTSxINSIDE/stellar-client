import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Лёгкий счётчик непрочитанных для бейджа в шапке. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: true, unread: 0 });

    const isAdmin = !!(user.is_admin || user.role === "admin");
    const row = isAdmin
      ? await queryOne(
          "SELECT COALESCE(SUM(admin_unread), 0)::int AS unread FROM support_tickets"
        )
      : await queryOne(
          "SELECT COALESCE(SUM(user_unread), 0)::int AS unread FROM support_tickets WHERE user_id = $1",
          [user.id]
        );

    return NextResponse.json({ ok: true, unread: Number(row?.unread) || 0, isAdmin });
  } catch {
    return NextResponse.json({ ok: true, unread: 0 });
  }
}
