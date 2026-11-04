import { NextResponse } from "next/server";
import { queryOne, User } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { verifyEmailCode } from "@/lib/email-codes";
import { alertNewLogin, checkLoginDevice } from "@/lib/login-alerts";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { safeRefreshUserRisk } from "@/lib/risk";

export async function POST(req: Request) {
  try {
    const { login, code, remember } = await req.json();
    if (!login || !code) return NextResponse.json({ error: "Введите код из письма" }, { status: 400 });

    const limited = await enforceRateLimit(req, [
      { scope: "login-2fa:ip", identifier: getClientIp(req), limit: 20, windowMs: 10 * 60_000 },
      {
        scope: "login-2fa:account",
        identifier: String(login).trim().toLowerCase(),
        limit: 10,
        windowMs: 10 * 60_000,
      },
    ]);
    if (limited) return limited;

    const user = (await queryOne("SELECT * FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)", [login])) as User | undefined;
    if (!user || !user.twofa_enabled) return NextResponse.json({ error: "Запросите код заново" }, { status: 400 });
    if (user.banned) return NextResponse.json({ error: user.ban_reason || "Ваш аккаунт заблокирован" }, { status: 403 });
    const check = await verifyEmailCode(user.email, code, "login");
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status || 400 });
    await safeRefreshUserRisk(user.id, getClientIp(req));
    const { meta, isNew } = await checkLoginDevice(user.id);
    await createSession(user.id, remember !== false);
    if (isNew) {
      await alertNewLogin(user.id, meta).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
