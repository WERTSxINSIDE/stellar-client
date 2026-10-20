import { query, queryOne } from "./db";
import { emailVerificationEnabled, sendVerificationCode } from "./email";

const COOLDOWN_SECONDS = 60;
const MAX_PER_HOUR = 5;

export const CODE_TTL_SECONDS = 600;

export async function issueVerificationCode(email: string): Promise<{ ok: boolean; error?: string; status?: number }> {
  if (!emailVerificationEnabled()) return { ok: true };
  const lower = email.toLowerCase();
  const recent = (await queryOne(
    `SELECT COALESCE(EXTRACT(EPOCH FROM (NOW() - MAX(created_at))), 9999)::int AS since_last, COUNT(*)::int AS hourly
     FROM email_codes WHERE email = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
    [lower]
  )) as any;
  if ((recent?.since_last ?? 9999) < COOLDOWN_SECONDS) return { ok: false, status: 429, error: `Код можно запросить повторно через ${COOLDOWN_SECONDS - (recent?.since_last ?? 0)} сек.` };
  if ((recent?.hourly ?? 0) >= MAX_PER_HOUR) return { ok: false, status: 429, error: "Слишком много запросов. Попробуйте позже." };
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await query("DELETE FROM email_codes WHERE created_at < NOW() - INTERVAL '1 day'");
  await query("INSERT INTO email_codes (email, code) VALUES ($1, $2)", [lower, code]);
  const sent = await sendVerificationCode(lower, code);
  if (!sent.ok) return { ok: false, status: 502, error: "Не удалось отправить письмо. Попробуйте позже." };
  return { ok: true };
}

export async function verifyEmailCode(email: string, code: string): Promise<{ ok: boolean; error?: string; status?: number }> {
  const lower = email.toLowerCase();
  const row = (await queryOne(
    `SELECT id, code, attempts, EXTRACT(EPOCH FROM (NOW() - created_at))::int AS age
     FROM email_codes WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
    [lower]
  )) as any;
  if (!row) return { ok: false, status: 400, error: "Код не запрашивался. Запросите новый." };
  if (row.age > CODE_TTL_SECONDS) return { ok: false, status: 400, error: "Код истёк. Запросите новый." };
  if (row.attempts >= 5) return { ok: false, status: 429, error: "Слишком много неверных попыток. Запросите новый код." };
  if (String(code || "").trim() !== row.code) {
    await query("UPDATE email_codes SET attempts = attempts + 1 WHERE id = $1", [row.id]);
    const left = 5 - (row.attempts + 1);
    return { ok: false, status: 400, error: left > 0 ? `Неверный код. Осталось попыток: ${left}` : "Слишком много неверных попыток. Запросите новый код." };
  }
  await query("DELETE FROM email_codes WHERE email = $1", [lower]);
  return { ok: true };
}
