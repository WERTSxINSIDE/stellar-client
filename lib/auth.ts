import { cookies, headers } from "next/headers";
import crypto from "crypto";
import { query, queryAll, queryOne, User } from "./db";

const COOKIE_NAME = "stellar_session";

export type RequestMeta = {
  userAgent: string | null;
  ip: string | null;
};

/** IP и user-agent текущего запроса (за прокси Vercel берём первый x-forwarded-for). */
export async function getRequestMeta(): Promise<RequestMeta> {
  try {
    const h = await headers();
    const userAgent = (h.get("user-agent") || "").slice(0, 300) || null;
    const ip =
      (
        (h.get("x-forwarded-for") || "").split(",")[0].trim() ||
        h.get("x-real-ip") ||
        h.get("cf-connecting-ip") ||
        ""
      ).slice(0, 64) || null;
    return { userAgent, ip };
  } catch {
    return { userAgent: null, ip: null };
  }
}

/** Короткое человекочитаемое описание браузера/ОС для писем и уведомлений. */
export function describeUserAgent(userAgent: string | null): string {
  if (!userAgent) return "Неизвестное устройство";
  const ua = userAgent.toLowerCase();
  const os = ua.includes("windows")
    ? "Windows"
    : ua.includes("android")
    ? "Android"
    : ua.includes("iphone") || ua.includes("ipad")
    ? "iOS"
    : ua.includes("mac os")
    ? "macOS"
    : ua.includes("linux")
    ? "Linux"
    : "";
  const browser = ua.includes("edg/")
    ? "Edge"
    : ua.includes("chrome") && !ua.includes("chromium")
    ? "Chrome"
    : ua.includes("firefox")
    ? "Firefox"
    : ua.includes("safari") && !ua.includes("chrome")
    ? "Safari"
    : "";
  const label = [os, browser].filter(Boolean).join(" · ");
  return label || userAgent.slice(0, 80);
}

export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}

export async function createSession(userId: number, remember: boolean = true) {
  const token = crypto.randomBytes(32).toString("hex");
  const { userAgent, ip } = await getRequestMeta();

  await query(
    "INSERT INTO sessions (token, user_id, user_agent, ip) VALUES ($1, $2, $3, $4)",
    [token, userId, userAgent, ip]
  );

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: remember ? 60 * 60 * 24 * 30 : undefined,
  });
}

/**
 * Считается ли вход новым устройством.
 * Первый вход в аккаунт не считаем подозрительным, чтобы не пугать письмом.
 */
export async function isNewLoginDevice(userId: number, meta: RequestMeta): Promise<boolean> {
  const rows = (await queryAll(
    "SELECT user_agent, ip FROM sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200",
    [userId]
  )) as { user_agent: string | null; ip: string | null }[];

  if (!rows.length) return false;

  if (meta.userAgent) {
    if (rows.some((r) => r.user_agent === meta.userAgent)) return false;
    // Старые сессии без user-agent: ориентируемся по IP.
    if (meta.ip && rows.some((r) => !r.user_agent && r.ip === meta.ip)) return false;
    return true;
  }

  if (meta.ip && rows.some((r) => r.ip === meta.ip)) return false;
  return true;
}

export async function getCurrentUser(): Promise<Omit<User, "password"> | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const row = await queryOne(
    `SELECT u.id, u.username, u.email, u.created_at, u.subscription_end, u.hwid, u.is_admin, u.role, u.banned, u.ban_reason, u.balance, u.partner_rank, u.sub_gifted,
            u.sc_coins, u.nickname_color, u.profile_theme, u.equipped_frame, u.equipped_badge, u.partner_code
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = $1`,
    [token]
  );

  return row ?? null;
}

export async function requireAdmin(): Promise<Omit<User, "password"> | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.banned) return null;
  if (user.role !== "admin" && !user.is_admin) return null;
  return user;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await query("DELETE FROM sessions WHERE token = $1", [token]);
    cookieStore.delete(COOKIE_NAME);
  }
}

export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return user.is_admin === 1 || user.role === "admin";
}
