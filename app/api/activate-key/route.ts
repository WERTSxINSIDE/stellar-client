import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 19);
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { key } = await req.json();
    if (!key || !key.trim()) {
      return NextResponse.json({ error: "Введите ключ" }, { status: 400 });
    }

    const licenseKey = await queryOne("SELECT * FROM keys WHERE key = $1", [key.trim().toUpperCase()]) as any;

    if (!licenseKey) {
      return NextResponse.json({ error: "Ключ не найден" }, { status: 404 });
    }

    if (licenseKey.activated_by) {
      return NextResponse.json({ error: "Ключ уже был использован" }, { status: 409 });
    }

    const now = new Date();
    const userRow = await queryOne("SELECT subscription_end FROM users WHERE id = $1", [user.id]) as { subscription_end: string | null } | undefined;

    let subEnd: Date;
    if (userRow?.subscription_end) {
      const current = new Date(userRow.subscription_end);
      subEnd = current > now ? addDays(current, licenseKey.duration_days) : addDays(now, licenseKey.duration_days);
    } else {
      subEnd = addDays(now, licenseKey.duration_days);
    }

    await query("UPDATE users SET subscription_end = $1, sub_gifted = 0 WHERE id = $2", [formatDate(subEnd), user.id]);
    await query("UPDATE keys SET activated_by = $1, activated_at = $2 WHERE id = $3", [user.id, formatDate(now), licenseKey.id]);

    return NextResponse.json({ ok: true, subscription_end: formatDate(subEnd), duration_days: licenseKey.duration_days });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
