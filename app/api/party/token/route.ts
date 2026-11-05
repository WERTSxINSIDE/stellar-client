import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { query, queryOne } from "@/lib/db";
import { signToken } from "@/lib/launch-token";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";
import { safeRefreshUserRisk } from "@/lib/risk";

export const dynamic = "force-dynamic";

type ModUser = {
  id: number;
  username: string;
  password: string;
  banned: number | null;
  ban_reason: string | null;
  subscription_end: string | null;
  is_admin: number | null;
  hwid: string | null;
};

/**
 * Вход для мода без лаунчера.
 *
 * Мод присылает ник, пароль и (по возможности) HWID, а взамен получает
 * launch-токен на 5 минут. Токен подходит для /api/party и /api/party/positions
 * через заголовок `Authorization: Bearer <token>`.
 *
 * В отличие от /api/launch-token этот endpoint проверяет пароль, бан,
 * подписку и HWID, поэтому его можно вызывать из игры напрямую.
 */
export async function POST(req: Request) {
  try {
    const { username, password, hwid } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { ok: false, error: "Введите логин и пароль" },
        { status: 400 }
      );
    }

    const limited = await enforceRateLimit(req, [
      { scope: "party-token:ip", identifier: getClientIp(req), limit: 30, windowMs: 5 * 60_000 },
      {
        scope: "party-token:account",
        identifier: String(username).trim().toLowerCase(),
        limit: 10,
        windowMs: 10 * 60_000,
      },
    ]);
    if (limited) return limited;

    const user = (await queryOne(
      "SELECT id, username, password, banned, ban_reason, subscription_end, is_admin, hwid FROM users WHERE LOWER(username) = LOWER($1)",
      [username]
    )) as ModUser | undefined;

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Неверный логин или пароль" },
        { status: 401 }
      );
    }

    const passwordOk = await bcrypt.compare(password, user.password);
    if (!passwordOk) {
      return NextResponse.json(
        { ok: false, error: "Неверный логин или пароль" },
        { status: 401 }
      );
    }

    if (user.banned) {
      return NextResponse.json(
        { ok: false, error: user.ban_reason || "Аккаунт заблокирован" },
        { status: 403 }
      );
    }

    await safeRefreshUserRisk(user.id, getClientIp(req));

    const subEnd = user.subscription_end ? new Date(user.subscription_end.replace(" ", "T")) : null;
    const hasActiveSub = subEnd !== null && subEnd > new Date();

    if (!hasActiveSub && !user.is_admin) {
      return NextResponse.json(
        { ok: false, error: "Нет активной подписки" },
        { status: 403 }
      );
    }

    if (hwid) {
      if (user.hwid && user.hwid !== hwid) {
        return NextResponse.json(
          { ok: false, error: "HWID не совпадает. Используй ключ сброса HWID." },
          { status: 403 }
        );
      }
      if (!user.hwid) {
        await query("UPDATE users SET hwid = $1 WHERE id = $2", [hwid, user.id]);
      }
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
