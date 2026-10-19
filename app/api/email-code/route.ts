import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { emailVerificationEnabled, sendVerificationCode } from "@/lib/email";

export const dynamic = "force-dynamic";

const CODE_TTL_MINUTES = 10;
const COOLDOWN_SECONDS = 60;
const MAX_PER_HOUR = 5;

export async function GET() {
  return NextResponse.json({ ok: true, enabled: emailVerificationEnabled() });
}

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Некорректный email" }, { status: 400 });
    }

    if (!emailVerificationEnabled()) {
      return NextResponse.json({ ok: true, disabled: true });
    }

    const lower = email.toLowerCase();

    const recent = await queryOne(
      `SELECT COALESCE(EXTRACT(EPOCH FROM (NOW() - MAX(created_at))), 9999)::int AS since_last,
              COUNT(*)::int AS hourly
       FROM email_codes WHERE email = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [lower]
    ) as any;

    if ((recent?.since_last ?? 9999) < COOLDOWN_SECONDS) {
      return NextResponse.json(
        { error: `Код можно запросить повторно через ${COOLDOWN_SECONDS - (recent?.since_last ?? 0)} сек.` },
        { status: 429 }
      );
    }
    if ((recent?.hourly ?? 0) >= MAX_PER_HOUR) {
      return NextResponse.json({ error: "Слишком много запросов. Попробуйте позже." }, { status: 429 });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));

    await query("DELETE FROM email_codes WHERE created_at < NOW() - INTERVAL '1 day'");
    await query("INSERT INTO email_codes (email, code) VALUES ($1, $2)", [lower, code]);

    const sent = await sendVerificationCode(lower, code);
    if (!sent) {
      return NextResponse.json({ error: "Не удалось отправить письмо. Попробуйте позже." }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
