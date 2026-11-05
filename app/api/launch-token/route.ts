import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { queryOne } from "@/lib/db";
import { signToken, verifyToken } from "@/lib/launch-token";
import { getCurrentUser } from "@/lib/auth";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type TokenUser = {
  id: number;
  username: string;
  password: string;
  banned: number | null;
  ban_reason: string | null;
  subscription_end: string | null;
  is_admin: number | null;
};

/**
 * Выдача и продление игрового токена.
 *
 * Способы авторизации:
 * 1. `Authorization: Bearer <старый токен>` — продление без пароля.
 *    Мод обновляет токен сам раз в 4 минуты.
 * 2. Cookie `stellar_session` — если запрос пришёл из браузера/лаунчера с сессией.
 * 3. Тело `{ username, password }` — первый вход из лаунчера.
 *
 * Токен живёт 5 минут. Выдаётся только пользователю без бана и с активной
 * подпиской (или админу).
 */
export async function POST(req: Request) {
  try {
    const limited = await enforceRateLimit(req, [
      { scope: "launch-token:ip", identifier: getClientIp(req), limit: 40, windowMs: 5 * 60_000 },
    ]);
    if (limited) return limited;

    let userId: number | null = null;

    const header = req.headers.get("authorization") || "";
    const bearer = header.toLowerCase().startsWith("bearer ")
      ? header.slice(7).trim()
      : req.headers.get("x-stellar-token")?.trim() || "";

    if (bearer) {
      const verified = verifyToken(bearer);
      if (verified.valid && verified.userId) userId = verified.userId;
    }

    if (!userId) {
      const sessionUser = await getCurrentUser();
      if (sessionUser) userId = sessionUser.id;
    }

    if (!userId) {
      const body = (await req.json().catch(() => null)) as
        | { username?: string; password?: string }
        | null;

      if (!body?.username || !body?.password) {
        return NextResponse.json(
          { ok: false, error: "Требуется токен, сессия или логин с паролем" },
          { status: 401 }
        );
      }

      const accountLimited = await enforceRateLimit(req, [
        {
          scope: "launch-token:account",
          identifier: String(body.username).trim().toLowerCase(),
          limit: 10,
          windowMs: 10 * 60_000,
        },
      ]);
      if (accountLimited) return accountLimited;

      const byName = (await queryOne(
        "SELECT id, password FROM users WHERE LOWER(username) = LOWER($1)",
        [body.username]
      )) as { id: number; password: string } | null;

      if (!byName || !(await bcrypt.compare(body.password, byName.password))) {
        return NextResponse.json(
          { ok: false, error: "Неверный логин или пароль" },
          { status: 401 }
        );
      }
      userId = byName.id;
    }

    const user = (await queryOne(
      "SELECT id, username, password, banned, ban_reason, subscription_end, is_admin FROM users WHERE id = $1",
      [userId]
    )) as TokenUser | null;

    if (!user) {
      return NextResponse.json({ ok: false, error: "Пользователь не найден" }, { status: 401 });
    }

    if (user.banned) {
      return NextResponse.json(
        { ok: false, error: user.ban_reason || "Аккаунт заблокирован" },
        { status: 403 }
      );
    }

    const subEnd = user.subscription_end ? new Date(user.subscription_end.replace(" ", "T")) : null;
    const hasActiveSub = subEnd !== null && subEnd > new Date();

    if (!hasActiveSub && !user.is_admin) {
      return NextResponse.json(
        { ok: false, error: "Нет активной подписки" },
        { status: 403 }
      );
    }

    const token = signToken(user.id, user.username);
    return NextResponse.json({
      ok: true,
      token,
      user_id: user.id,
      username: user.username,
      expires_in: 300,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
