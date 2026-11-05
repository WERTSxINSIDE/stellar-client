import crypto from "crypto";

/**
 * Realtime-канал пати для Supabase Broadcast.
 *
 * Позиции не пишутся в БД: клиенты отправляют их напрямую в WebSocket-канал
 * Supabase. Канал публичный, но его имя содержит случайный ключ пати,
 * поэтому подобрать его снаружи нельзя. Ключ меняется при выходе/исключении
 * участника, чтобы бывший участник не мог слушать канал дальше.
 */
export type RealtimeConfig = {
  url: string;
  ws_url: string;
  anon_key: string;
  channel: string;
  position_hz: number;
};

export function newRealtimeKey(): string {
  return crypto.randomBytes(24).toString("hex");
}

export function realtimeChannel(partyId: number, key: string): string {
  return `party_${partyId}_${key}`;
}

function projectUrl(): string {
  const explicit = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const databaseUrl = process.env.DATABASE_URL || "";
  try {
    const parsed = new URL(databaseUrl);
    const match = decodeURIComponent(parsed.username).match(/^postgres\.([a-z0-9]+)$/i);
    if (match) return `https://${match[1]}.supabase.co`;
  } catch {
    // некорректный DATABASE_URL — просто нет Realtime-конфига
  }
  return "";
}

/**
 * Конфиг отдаётся только участникам пати. Anon key — публичный ключ Supabase,
 * он и так используется в клиентских приложениях.
 */
export function getRealtimeConfig(partyId: number, key: string | null | undefined): RealtimeConfig | null {
  if (!key) return null;

  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  const url = projectUrl();
  if (!anonKey || !url) return null;

  const channel = realtimeChannel(partyId, key);
  const wsUrl = `${url.replace(/^http/i, "ws")}/realtime/v1/websocket?apikey=${encodeURIComponent(anonKey)}&vsn=1.0.0`;

  return {
    url,
    ws_url: wsUrl,
    anon_key: anonKey,
    channel,
    position_hz: 8,
  };
}
