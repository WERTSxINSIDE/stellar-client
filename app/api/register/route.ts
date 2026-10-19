import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { query, queryOne } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { emailVerificationEnabled } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const { username, email, password, code } = await req.json();

    if (!username || !email || !password) {
      return NextResponse.json({ error: "Заполните все поля" }, { status: 400 });
    }
    if (String(password).length < 6) {
      return NextResponse.json({ error: "Пароль должен быть не меньше 6 символов" }, { status: 400 });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Некорректный email" }, { status: 400 });
    }

    const exists = await queryOne("SELECT id FROM users WHERE username = $1 OR email = $2", [username, email]);
    if (exists) {
      return NextResponse.json({ error: "Пользователь с таким именем или email уже существует" }, { status: 409 });
    }

    const lower = String(email).toLowerCase();

    if (emailVerificationEnabled()) {
      if (!code) {
        return NextResponse.json({ error: "Введите код с почты" }, { status: 400 });
      }

      const row = await queryOne(
        `SELECT id, code, attempts, EXTRACT(EPOCH FROM (NOW() - created_at))::int AS age
         FROM email_codes WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
        [lower]
      ) as any;

      if (!row) {
        return NextResponse.json({ error: "Код не запрашивался. Нажмите «Получить код»." }, { status: 400 });
      }
      if (row.age > 600) {
        return NextResponse.json({ error: "Код истёк. Запросите новый." }, { status: 400 });
      }
      if (row.attempts >= 5) {
        return NextResponse.json({ error: "Слишком много неверных попыток. Запросите новый код." }, { status: 429 });
      }
      if (String(code).trim() !== row.code) {
        await query("UPDATE email_codes SET attempts = attempts + 1 WHERE id = $1", [row.id]);
        const left = 5 - (row.attempts + 1);
        return NextResponse.json(
          { error: left > 0 ? `Неверный код. Осталось попыток: ${left}` : "Слишком много неверных попыток. Запросите новый код." },
          { status: 400 }
        );
      }

      await query("DELETE FROM email_codes WHERE email = $1", [lower]);
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      "INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id",
      [username, email, hash]
    );

    await createSession(result.rows[0].id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
