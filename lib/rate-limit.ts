import crypto from "crypto";
import { NextResponse } from "next/server";
import { query } from "./db";

/**
 * Лимиты хранятся в PostgreSQL, а не в памяти процесса:
 * на Vercel каждый запрос может попасть в новый инстанс, поэтому
 * локальные счётчики не защищают от перебора.
 */
export type RateLimitRule = {
  /** Название правила, например "login:ip" или "login:account". */
  scope: string;
  /** IP, id пользователя, email, логин — что угодно, что нужно ограничить. */
  identifier: string | number | null | undefined;
  /** Сколько запросов разрешено за окно. */
  limit: number;
  /** Длина окна в миллисекундах. */
  windowMs: number;
};

export type RateLimitResult = {
  ok: boolean;
  scope: string;
  limit: number;
  remaining: number;
  /** Через сколько секунд окно сбросится. */
  retryAfter: number;
};

/** IP из заголовков Vercel/Cloudflare. */
export function getClientIp(req?: Request): string {
  if (!req) return "unknown";
  const h = req.headers;
  const ip =
    (h.get("x-forwarded-for") || "").split(",")[0].trim() ||
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    "";
  return ip.slice(0, 64) || "unknown";
}

function hashIdentifier(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function secondsUntil(ms: number): number {
  return Math.max(1, Math.ceil(ms / 1000));
}

function humanRetry(seconds: number): string {
  if (seconds >= 120) return `${Math.ceil(seconds / 60)} мин`;
  return `${seconds} сек`;
}

/**
 * Атомарно увеличивает счётчики и проверяет все правила.
 * Если хотя бы одно правило превышено — возвращает ok: false.
 *
 * При ошибке БД лимит пропускает запрос (fail-open), чтобы временный
 * сбой базы не ломал вход и оплату. Ошибка пишется в лог.
 */
export async function checkRateLimit(
  rules: RateLimitRule | RateLimitRule[]
): Promise<RateLimitResult> {
  const list = Array.isArray(rules) ? rules : [rules];
  const now = Date.now();

  for (const rule of list) {
    const limit = Math.max(1, Math.floor(rule.limit));
    const windowMs = Math.max(1000, Math.floor(rule.windowMs));
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const resetAt = windowStart + windowMs;
    const retryAfter = secondsUntil(resetAt - now);

    const rawId = String(rule.identifier ?? "").trim().toLowerCase() || "anonymous";
    const key = `${rule.scope}:${hashIdentifier(rawId)}:${windowStart}`;

    try {
      const result = await query(
        `INSERT INTO rate_limits (key, count, expires_at)
         VALUES ($1, 1, $2)
         ON CONFLICT (key) DO UPDATE SET count = rate_limits.count + 1
         RETURNING count`,
        [key, new Date(resetAt + 60_000)]
      );

      const count = Number(result.rows[0]?.count ?? 1);

      if (count > limit) {
        return { ok: false, scope: rule.scope, limit, remaining: 0, retryAfter };
      }

      // Иногда чистим просроченные окна, чтобы таблица не росла бесконечно.
      if (Math.random() < 0.03) {
        query("DELETE FROM rate_limits WHERE expires_at < NOW()").catch(() => {});
      }

      // Последнее правило в списке — самое специфичное; remaining полезен для UI.
      if (rule === list[list.length - 1]) {
        return {
          ok: true,
          scope: rule.scope,
          limit,
          remaining: Math.max(0, limit - count),
          retryAfter,
        };
      }
    } catch (e: any) {
      console.error("rate limit error:", e?.message || e);
      // fail-open: не блокируем запрос из-за сбоя БД
    }
  }

  const last = list[list.length - 1];
  return {
    ok: true,
    scope: last?.scope ?? "rate-limit",
    limit: last?.limit ?? 0,
    remaining: 0,
    retryAfter: 0,
  };
}

/** Возвращает 429-ответ либо null, если лимит не превышен. */
export async function enforceRateLimit(
  req: Request,
  rules: RateLimitRule[],
  message?: string
): Promise<NextResponse | null> {
  const result = await checkRateLimit(rules);
  if (result.ok) return null;

  const error =
    message ||
    `Слишком много попыток. Повторите через ${humanRetry(result.retryAfter)}.`;

  return NextResponse.json(
    { error, retryAfter: result.retryAfter },
    { status: 429, headers: { "Retry-After": String(result.retryAfter) } }
  );
}
