import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { query, queryOne } from "@/lib/db";
import { notifyUser } from "@/lib/notify";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { email, code, password } = await req.json();
    const lower = String(email || "").trim().toLowerCase();

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lower)) {
      return NextResponse.json({ error: "Некорректный email" }, { status: 400 });
    }
    if (!code || !String(code).trim()) {
      return NextResponse.json({ error: "Введите код из письма" }, { status: 400 });
    }
    if (String(password || "").length < 6) {
      return NextResponse.json({ error: "Пароль должен быть не меньше 6 символов" }, { status: 400 });
    }

    const limited = await enforceRateLimit(req, [
      {
        scope: "password-reset-confirm:ip",
        identifier: getClientIp(req),
        limit: 10,
        windowMs: 10 * 60_000,
      },
      {
        scope: "password-reset-confirm:email",
        identifier: lower,
        limit: 8,
        windowMs: 15 * 60_000,
      },
    ]);
    if (limited) return limited;

    const user = (await queryOne(
      "SELECT id, banned FROM users WHERE LOWER(email) = $1",
      [lower]
    )) as { id: number; banned: number | null } | null;

    if (!user) {
      return NextResponse.json({ error: "Неверный код или email" }, { status: 400 });
    }

    const row = (await queryOne(
      `SELECT id, code, attempts, EXTRACT(EPOCH FROM (NOW() - created_at))::int AS age
       FROM email_codes WHERE email = $1 AND purpose = 'reset'
       ORDER BY created_at DESC LIMIT 1`,
      [lower]
    )) as { id: number; code: string; attempts: number; age: number } | null;

    if (!row) {
      return NextResponse.json({ error: "Код не запрашивался. Запросите новый." }, { status: 400 });
    }
    if (row.age > 600) {
      return NextResponse.json({ error: "Код истёк. Запросите новый." }, { status: 400 });
    }
    if (row.attempts >= 5) {
      return NextResponse.json(
        { error: "Слишком много неверных попыток. Запросите новый код." },
        { status: 429 }
      );
    }
    if (String(code).trim() !== row.code) {
      await query("UPDATE email_codes SET attempts = attempts + 1 WHERE id = $1", [row.id]);
      const left = 5 - (row.attempts + 1);
      return NextResponse.json(
        {
          error:
            left > 0
              ? `Неверный код. Осталось попыток: ${left}`
              : "Слишком много неверных попыток. Запросите новый код.",
        },
        { status: 400 }
      );
    }

    const hash = await bcrypt.hash(String(password), 10);
    await query("UPDATE users SET password = $1 WHERE id = $2", [hash, user.id]);
    await query("DELETE FROM email_codes WHERE email = $1 AND purpose = 'reset'", [lower]);
    // Сбрасываем все сессии: если аккаунт увели, доступ пропадёт.
    await query("DELETE FROM sessions WHERE user_id = $1", [user.id]);

    await notifyUser(
      user.id,
      {
        type: "security",
        title: "Пароль изменён",
        body: "Пароль от аккаунта был изменён, все сессии завершены. Если это были не вы — напишите в поддержку.",
        link: "/support",
      },
      { email: true }
    ).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
