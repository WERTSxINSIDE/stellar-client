import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { queryOne, User } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { issueVerificationCode } from "@/lib/email-codes";

export async function POST(req: Request) {
  try {
    const { login, password, remember } = await req.json();

    if (!login || !password) {
      return NextResponse.json({ error: "Введите логин и пароль" }, { status: 400 });
    }

    const user = await queryOne(
      "SELECT * FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)",
      [login]
    ) as User | undefined;

    if (!user) {
      return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return NextResponse.json({ error: "Неверный логин или пароль" }, { status: 401 });
    }

    if (user.banned) {
      return NextResponse.json({ error: user.ban_reason || "Ваш аккаунт заблокирован" }, { status: 403 });
    }

    if (user.twofa_enabled) {
      const res = await issueVerificationCode(user.email);
      if (!res.ok) return NextResponse.json({ error: res.error || "Не удалось отправить код" }, { status: res.status || 502 });
      return NextResponse.json({ ok: true, twofa: true });
    }

    await createSession(user.id, remember !== false);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
