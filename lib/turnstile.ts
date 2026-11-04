/**
 * Cloudflare Turnstile (капча).
 *
 * Если ключи не заданы, проверка полностью отключается — сайт
 * продолжает работать как раньше. Включается двумя переменными:
 *   TURNSTILE_SECRET_KEY        — серверный ключ
 *   TURNSTILE_SITE_KEY          — публичный ключ (можно NEXT_PUBLIC_*)
 *
 * Проверка fail-closed: при включённой капче без валидного токена
 * запрос отклоняется. Это осознанно — иначе защита обходится
 * простым удалением токена из запроса.
 */
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileSiteKey(): string | null {
  const key =
    process.env.TURNSTILE_SITE_KEY ||
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
    "";
  return key.trim() || null;
}

/** Капча включена только когда заданы оба ключа. */
export function turnstileConfigured(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY?.trim() && !!turnstileSiteKey();
}

export type TurnstileResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
  codes?: string[];
};

type SiteVerifyResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

/** Серверная проверка токена Turnstile. */
export async function verifyTurnstile(
  token: unknown,
  ip?: string | null
): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return { ok: true, skipped: true };

  const value = typeof token === "string" ? token.trim() : "";
  if (!value) {
    return { ok: false, error: "Подтвердите, что вы не робот" };
  }

  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", value);
    if (ip) body.set("remoteip", ip);

    const res = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      cache: "no-store",
    });
    const data = (await res.json()) as SiteVerifyResponse;

    if (data.success) return { ok: true };

    console.warn("turnstile verification failed:", data["error-codes"]);
    return {
      ok: false,
      error: "Проверка капчи не пройдена. Обновите страницу и попробуйте снова.",
      codes: data["error-codes"],
    };
  } catch (error) {
    console.error("turnstile verify error:", error);
    return { ok: false, error: "Не удалось проверить капчу. Попробуйте позже." };
  }
}
