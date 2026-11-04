import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { query, queryOne, User } from "@/lib/db";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { safeRefreshUserRisk } from "@/lib/risk";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { username, password, hwid } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ success: false, error: "Введите логин и пароль" }, { status: 400 });
    }

    const limited = await enforceRateLimit(req, [
      { scope: "launcher-auth:ip", identifier: getClientIp(req), limit: 30, windowMs: 5 * 60_000 },
      {
        scope: "launcher-auth:account",
        identifier: String(username).trim().toLowerCase(),
        limit: 10,
        windowMs: 10 * 60_000,
      },
    ]);
    if (limited) return limited;

    const user = await queryOne("SELECT * FROM users WHERE LOWER(username) = LOWER($1)", [username]) as User | undefined;

    if (!user) {
      return NextResponse.json({ success: false, error: "Неверный логин или пароль" }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return NextResponse.json({ success: false, error: "Неверный логин или пароль" }, { status: 401 });
    }

    if (user.banned) {
      return NextResponse.json({ success: false, error: user.ban_reason || "Ваш аккаунт заблокирован" }, { status: 403 });
    }

    await safeRefreshUserRisk(user.id, getClientIp(req));

    const subEnd = user.subscription_end ? new Date(user.subscription_end.replace(" ", "T")) : null;
    const hasActiveSub = subEnd && subEnd > new Date();

    if (!hasActiveSub && !user.is_admin) {
      return NextResponse.json({ success: false, error: "Нет активной подписки. Купите подписку на сайте." }, { status: 403 });
    }

    if (hwid) {
      if (user.hwid && user.hwid !== hwid) {
        return NextResponse.json({ success: false, error: "HWID не совпадает. Используй ключ сброса HWID." }, { status: 403 });
      }
      if (!user.hwid) {
        await query("UPDATE users SET hwid = $1 WHERE id = $2", [hwid, user.id]);
      }
    }

    return NextResponse.json({
      success: true,
      uid: user.id,
      username: user.username,
      email: user.email,
      role: user.role || "user",
      subscription_end: user.subscription_end || null,
      beta_access: !!user.is_admin,
    });
  } catch {
    return NextResponse.json({ success: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
