export function emailVerificationEnabled(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendVerificationCode(to: string, code: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;

  const from = process.env.RESEND_FROM || "Stellar Client <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "Код подтверждения — Stellar Client",
        text: [
          `Ваш код подтверждения: ${code}`,
          "",
          "Код действителен 10 минут. Не сообщайте его никому — сотрудники Stellar Client никогда не просят код.",
        ].join("\n"),
      }),
    });

    if (!res.ok) {
      console.error("Resend error:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("Resend exception:", e);
    return false;
  }
}
