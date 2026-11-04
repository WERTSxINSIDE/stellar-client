import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { query, queryOne, User } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }

    const { password } = await req.json();
    if (!password || String(password).length < 6) {
      return NextResponse.json({ error: "Пароль должен быть не меньше 6 символов" }, { status: 400 });
    }

    const limited = await enforceRateLimit(req, [
      { scope: "change-password:account", identifier: me.id, limit: 5, windowMs: 10 * 60_000 },
      { scope: "change-password:ip", identifier: getClientIp(req), limit: 15, windowMs: 10 * 60_000 },
    ]);
    if (limited) return limited;

    const user = await queryOne("SELECT * FROM users WHERE id = $1", [me.id]) as User | undefined;
    if (!user) {
      return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    }

    const hash = await bcrypt.hash(password, 10);
    await query("UPDATE users SET password = $1 WHERE id = $2", [hash, me.id]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
