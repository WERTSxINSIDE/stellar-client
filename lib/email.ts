import nodemailer from "nodemailer";

export function emailVerificationEnabled(): boolean {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) return true;
  return !!process.env.RESEND_API_KEY;
}

const SUBJECT = "Код подтверждения — Stellar Client";

function codeText(code: string): string {
  return [
    `Ваш код подтверждения: ${code}`,
    "",
    "Код действителен 10 минут. Не сообщайте его никому — сотрудники Stellar Client никогда не просят код.",
  ].join("\n");
}

async function sendViaSmtp(to: string, code: string): Promise<boolean> {
  const port = Number(process.env.SMTP_PORT || 465);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.yandex.ru",
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER as string,
      pass: process.env.SMTP_PASS as string,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: SUBJECT,
    text: codeText(code),
  });
  return true;
}

async function sendViaResend(to: string, code: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;

  const from = process.env.RESEND_FROM || "Stellar Client <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: SUBJECT,
      text: codeText(code),
    }),
  });

  if (!res.ok) {
    console.error("Resend error:", res.status, await res.text());
    return false;
  }
  return true;
}

export async function sendVerificationCode(to: string, code: string): Promise<{ ok: boolean; detail: string }> {
  try {
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      await sendViaSmtp(to, code);
      return { ok: true, detail: "smtp" };
    }
    const r = await sendViaResend(to, code);
    return { ok: r, detail: r ? "resend" : "resend failed" };
  } catch (e: any) {
    console.error("Email send error:", e);
    return { ok: false, detail: String(e?.message || e).slice(0, 300) };
  }
}
