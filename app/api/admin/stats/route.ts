import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !user.is_admin) return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });

    const [total] = await Promise.all([
      queryOne("SELECT COUNT(*)::int as c FROM users"),
    ]);
    const regs7d = (await queryOne("SELECT COUNT(*)::int as c FROM users WHERE created_at > NOW() - INTERVAL '7 days'")) as any;
    const purchases = (await queryOne("SELECT COUNT(*)::int as c FROM purchases")) as any;
    const daysBought = (await queryOne("SELECT COALESCE(SUM(days),0)::int as s FROM purchases")) as any;
    const byDay = await query("SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, COUNT(*)::int as c FROM users WHERE created_at > NOW() - INTERVAL '30 days' GROUP BY day ORDER BY day ASC");

    return NextResponse.json({ ok: true, totalUsers: total?.c || 0, regs7d: regs7d?.c || 0, purchases: purchases?.c || 0, daysBought: daysBought?.s || 0, byDay });
  } catch (e) {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
