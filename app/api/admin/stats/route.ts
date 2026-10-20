import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !user.is_admin) return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });

    const total = (await queryOne("SELECT COUNT(*)::int as c FROM users")) as any;
    const regs7d = (await queryOne("SELECT COUNT(*)::int as c FROM users WHERE created_at > NOW() - INTERVAL '7 days'")) as any;
    const regs30d = (await queryOne("SELECT COUNT(*)::int as c FROM users WHERE created_at > NOW() - INTERVAL '30 days'")) as any;
    const activeSubs = (await queryOne("SELECT COUNT(*)::int as c FROM users WHERE subscription_end IS NOT NULL AND subscription_end::timestamptz > NOW()")) as any;
    const keysTotal = (await queryOne("SELECT COUNT(*)::int as c FROM keys")) as any;
    const keysUsed = (await queryOne("SELECT COUNT(*)::int as c FROM keys WHERE activated_by IS NOT NULL")) as any;
    const byDay = await query("SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, COUNT(*)::int as c FROM users WHERE created_at > NOW() - INTERVAL '30 days' GROUP BY day ORDER BY day ASC");

    return NextResponse.json({
      ok: true,
      totalUsers: total?.c || 0,
      regs7d: regs7d?.c || 0,
      regs30d: regs30d?.c || 0,
      activeSubs: activeSubs?.c || 0,
      keysTotal: keysTotal?.c || 0,
      keysUsed: keysUsed?.c || 0,
      purchases: activeSubs?.c || 0,
      daysBought: keysUsed?.c || 0,
      byDay,
    });
  } catch (e) {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
