import { NextResponse } from "next/server";
import { queryOne, User } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { verifyEmailCode } from "@/lib/email-codes";

export async function POST(req: Request) {
  try {
    const { login, code, remember } = await req.json();
    if (!login || !code) return NextResponse.json({ error: "Введите код из письма" }, { status: 400 });
    const user = (await queryOne("SELECT * FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)", [login])) as User | undefined;
    if (!user || !user.twofa_enabled) return NextResponse.json({ error: "Запросите код заново" }, { status: 400 });
    if (user.banned) return NextResponse.json({ error: user.ban_reason || "Ваш аккаунт заблокирован" }, { status: 403 });
    const check = await verifyEmailCode(user.email, code);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status || 400 });
    await createSession(user.id, remember !== false);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
