import crypto from "crypto";
import { getTelegramLink } from "./telegram-links";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://stellar-client.vercel.app";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "";

const ADMIN_CHATS = (process.env.TELEGRAM_ADMIN_CHAT_ID || "")
  .split(/[,\s]+/)
  .map((value) => value.trim())
  .filter(Boolean);

const LINK_TOKEN_TTL_MS = 30 * 60 * 1000;

/** Р‘РѕС‚ РЅР°СЃС‚СЂРѕРµРЅ, РјРѕР¶РЅРѕ РѕС‚РїСЂР°РІР»СЏС‚СЊ СЃРѕРѕР±С‰РµРЅРёСЏ. */
export function telegramEnabled(): boolean {
  return Boolean(BOT_TOKEN);
}

/** РќР°СЃС‚СЂРѕРµРЅ webhook: РїСЂРёС‘Рј РєРѕРјР°РЅРґ /start Рё /stop. */
export function telegramWebhookEnabled(): boolean {
  return Boolean(BOT_TOKEN && WEBHOOK_SECRET);
}

/** РђРґРјРёРЅ РїРѕР»СѓС‡Р°РµС‚ СЃР»СѓР¶РµР±РЅС‹Рµ СѓРІРµРґРѕРјР»РµРЅРёСЏ. */
export function telegramAdminEnabled(): boolean {
  return Boolean(BOT_TOKEN && ADMIN_CHATS.length);
}

export function escapeTelegramHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

let cachedUsername: string | null = null;

/** Username Р±РѕС‚Р° РґР»СЏ deep-link. РЎРЅР°С‡Р°Р»Р° env, Р·Р°С‚РµРј getMe. */
export async function getBotUsername(): Promise<string> {
  const fromEnv = String(process.env.TELEGRAM_BOT_USERNAME || "").replace(/^@/, "").trim();
  if (fromEnv) return fromEnv;
  if (!BOT_TOKEN) return "";
  if (cachedUsername) return cachedUsername;

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      result?: { username?: string };
    };
    if (data.ok && data.result?.username) {
      cachedUsername = String(data.result.username);
      return cachedUsername;
    }
  } catch {
    // СЃРµС‚СЊ РЅРµРґРѕСЃС‚СѓРїРЅР° вЂ” РІРµСЂРЅС‘Рј РїСѓСЃС‚СѓСЋ СЃС‚СЂРѕРєСѓ
  }

  return "";
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string
): Promise<boolean> {
  if (!BOT_TOKEN) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** РЎРѕРѕР±С‰РµРЅРёРµ РІРѕ РІСЃРµ Р°РґРјРёРЅСЃРєРёРµ С‡Р°С‚С‹. РњРѕР»С‡Р° РІС‹РєР»СЋС‡Р°РµС‚СЃСЏ Р±РµР· env. */
export async function notifyAdmins(text: string): Promise<void> {
  if (!ADMIN_CHATS.length || !BOT_TOKEN) return;
  await Promise.allSettled(
    ADMIN_CHATS.map((chatId) => sendTelegramMessage(chatId, text))
  );
}

/** Р”СѓР±Р»РёСЂСѓРµС‚ СѓРІРµРґРѕРјР»РµРЅРёРµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЋ РІ Telegram, РµСЃР»Рё С‡Р°С‚ РїСЂРёРІСЏР·Р°РЅ. */
export async function sendTelegramToUser(
  userId: number,
  input: { title: string; body?: string; link?: string }
): Promise<boolean> {
  if (!BOT_TOKEN) return false;

  try {
    const link = await getTelegramLink(userId);
    if (!link) return false;

    const url = input.link
      ? `${SITE_URL}${input.link.startsWith("/") ? "" : "/"}${input.link}`
      : SITE_URL;

    const parts = [`<b>${escapeTelegramHtml(input.title)}</b>`];
    if (input.body) parts.push(escapeTelegramHtml(input.body));
    parts.push(`<a href="${url}">РћС‚РєСЂС‹С‚СЊ РЅР° СЃР°Р№С‚Рµ</a>`);

    return await sendTelegramMessage(link.chat_id, parts.join("\n\n"));
  } catch {
    return false;
  }
}

function signingKey(): string {
  return WEBHOOK_SECRET || BOT_TOKEN;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

/** РћРґРЅРѕСЂР°Р·РѕРІС‹Р№ С‚РѕРєРµРЅ РґР»СЏ deep-link t.me/<bot>?start=<token>. */
export function createTelegramLinkToken(userId: number): string {
  const expires = Date.now() + LINK_TOKEN_TTL_MS;
  const payload = `${userId}.${expires}`;
  return `${payload}.${sign(payload)}`;
}

/** РџСЂРѕРІРµСЂСЏРµС‚ С‚РѕРєРµРЅ Рё РІРѕР·РІСЂР°С‰Р°РµС‚ id РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ. */
export function verifyTelegramLinkToken(token: string): number | null {
  if (!signingKey()) return null;

  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;

  const [rawUserId, rawExpires, signature] = parts;
  const expected = sign(`${rawUserId}.${rawExpires}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const expires = Number(rawExpires);
  if (!Number.isFinite(expires) || expires < Date.now()) return null;

  const userId = Number(rawUserId);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

/** РЎРІРµСЂСЏРµС‚ СЃРµРєСЂРµС‚ РёР· Р·Р°РіРѕР»РѕРІРєР° Telegram СЃ env. */
export function isValidWebhookSecret(value: string | null): boolean {
  if (!WEBHOOK_SECRET || !value) return false;
  const a = Buffer.from(value);
  const b = Buffer.from(WEBHOOK_SECRET);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
