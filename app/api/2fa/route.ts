import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { issueVerificationCode, verifyEmailCode } from "@/lib/email-codes";
import bcrypt from "bcrypt";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  const row = await queryOne("SELECT twofa_enabled FROM users WHERE id = $1", [user.id]);
  return NextResponse.json({ ok: true, enabled: !!row?.twofa_enabled });
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    const { action, code, password } = await req.json();
    if (action === "request") {
      const res = await issueVerificationCode(user.email);
      if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status || 400 });
      return NextResponse.json({ ok: true });
    }
    if (action === "enable") {
      const check = await verifyEmailCode(user.email, code);
      if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status || 400 });
      await query("UPDATE users SET twofa_enabled = 1 WHERE id = $1", [user.id]);
      return NextResponse.json({ ok: true, enabled: true });
    }
    if (action === "disable") {
      const row = await queryOne("SELECT password FROM users WHERE id = $1", [user.id]);
      const ok = row ? await bcrypt.compare(String(password || ""), row.password) : false;
      if (!ok) return NextResponse.json({ error: "Неверный пароль" }, { status: 400 });
      await query("UPDATE users SET twofa_enabled = 0 WHERE id = $1", [user.id]);
      return NextResponse.json({ ok: true, enabled: false });
    }
    return NextResponse.json({ error: "Неверное действие" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
