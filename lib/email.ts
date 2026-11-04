import nodemailer from "nodemailer";
import { renderEmail } from "./email-template";

export function emailVerificationEnabled(): boolean {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) return true;
  return !!process.env.RESEND_API_KEY;
}

const CODE_SUBJECT = "Код подтверждения — Stellar Client";

function codeText(code: string): string {
  return [
    `Ваш код подтверждения: ${code}`,
    "",
    "Код действителен 10 минут. Не сообщайте его никому — сотрудники Stellar Client никогда не просят код.",
  ].join("\n");
}

async function sendViaSmtp(to: string, subject: string, text: string, html?: string): Promise<boolean> {
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
    subject,
    text,
    html,
  });
  return true;
}

async function sendViaResend(to: string, subject: string, text: string, html?: string): Promise<boolean> {
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
      subject,
      text,
      ...(html ? { html } : {}),
    }),
  });

  if (!res.ok) {
    console.error("Resend error:", res.status, await res.text());
    return false;
  }
  return true;
}

export async function sendMail(
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<{ ok: boolean; detail: string }> {
  try {
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      await sendViaSmtp(to, subject, text, html);
      return { ok: true, detail: "smtp" };
    }
    const r = await sendViaResend(to, subject, text, html);
    return { ok: r, detail: r ? "resend" : "resend failed" };
  } catch (e: any) {
    console.error("Email send error:", e);
    return { ok: false, detail: String(e?.message || e).slice(0, 300) };
  }
}

export async function sendVerificationCode(
  to: string,
  code: string
): Promise<{ ok: boolean; detail: string }> {
  const text = codeText(code);
  const html = renderEmail({
    title: "Ваш код подтверждения",
    bodyHtml: `
      <p style="margin:0 0 16px;">Введите этот код, чтобы подтвердить действие:</p>
      <p style="margin:0;padding:18px 24px;border-radius:16px;background:#18181b;border:1px solid #3f3f46;color:#ffffff;font-size:32px;font-weight:800;letter-spacing:10px;text-align:center;">${code}</p>
      <p style="margin:16px 0 0;color:#a1a1aa;font-size:13px;">Код действует 10 минут. Если вы ничего не запрашивали — просто проигнорируйте письмо.</p>
    `,
    footnote: "Никому не сообщайте этот код.",
  });
  return sendMail(to, CODE_SUBJECT, text, html);
}
