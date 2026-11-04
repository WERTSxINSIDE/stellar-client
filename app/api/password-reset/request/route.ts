import { NextResponse } from "next/server";
import crypto from "crypto";
import { query, queryOne } from "@/lib/db";
import { sendMail } from "@/lib/email";
import { renderEmail } from "@/lib/email-template";
import { enforceRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    const lower = String(email || "").trim().toLowerCase();

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lower)) {
      return NextResponse.json({ error: "Некорректный email" }, { status: 400 });
    }

    // Ограничиваем и IP, и конкретный email: нельзя засыпать чужой ящик письмами.
    const limited = await enforceRateLimit(req, [
      {
        scope: "password-reset-request:ip",
        identifier: getClientIp(req),
        limit: 5,
        windowMs: 10 * 60_000,
      },
      {
        scope: "password-reset-request:email",
        identifier: lower,
        limit: 3,
        windowMs: 60 * 60_000,
      },
    ]);
    if (limited) return limited;

    // Ответ всегда одинаковый, чтобы нельзя было проверить наличие аккаунта.
    const okResponse = NextResponse.json({
      ok: true,
      message: "Если аккаунт с таким email существует, код отправлен.",
    });

    const user = (await queryOne("SELECT id FROM users WHERE LOWER(email) = $1", [lower])) as
      | { id: number }
      | null;
    if (!user) return okResponse;

    const last = (await queryOne(
      `SELECT EXTRACT(EPOCH FROM (NOW() - created_at))::int AS age
       FROM email_codes WHERE email = $1 AND purpose = 'reset'
       ORDER BY created_at DESC LIMIT 1`,
      [lower]
    )) as { age: number } | null;

    if (last && last.age < 60) return okResponse;

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");

    await query("DELETE FROM email_codes WHERE email = $1 AND purpose = 'reset'", [lower]);
    await query("INSERT INTO email_codes (email, code, purpose) VALUES ($1, $2, 'reset')", [
      lower,
      code,
    ]);

    await sendMail(
      lower,
      "Сброс пароля — Stellar Client",
      [
        `Код для сброса пароля: ${code}`,
        "",
        "Код действителен 10 минут. Если вы не запрашивали сброс — просто проигнорируйте письмо.",
        "Сотрудники Stellar Client никогда не просят код.",
      ].join("\n"),
      renderEmail({
        title: "Сброс пароля",
        bodyHtml: `
          <p style="margin:0 0 16px;">Вы запросили смену пароля. Введите этот код на странице восстановления:</p>
          <p style="margin:0;padding:18px 24px;border-radius:16px;background:#18181b;border:1px solid #3f3f46;color:#ffffff;font-size:32px;font-weight:800;letter-spacing:10px;text-align:center;">${code}</p>
          <p style="margin:16px 0 0;color:#a1a1aa;font-size:13px;">Код действует 10 минут. Если вы не запрашивали сброс — просто проигнорируйте письмо.</p>
        `,
        footnote: "Никому не сообщайте этот код.",
      })
    );

    return okResponse;
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
