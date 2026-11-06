import crypto from "crypto";

/**
 * Секрет подписи launch-токена. Токен живёт 5 минут и содержит userId.
 *
 * В проде лучше задать отдельную переменную окружения `LAUNCH_TOKEN_SECRET`
 * (Vercel → Project → Environment Variables). Если её нет, ключ выводится из
 * `DATABASE_URL`: публичной константы в репозитории больше нет, а менять
 * конфигурацию для деплоя не требуется.
 */
const SECRET = (() => {
  const fromEnv = process.env.LAUNCH_TOKEN_SECRET?.trim();
  if (fromEnv) return fromEnv;
  return crypto
    .createHash("sha256")
    .update(`stellar-launch|${process.env.DATABASE_URL ?? "local"}`)
    .digest("hex");
})();

export function signToken(userId: number, username: string): string {
  const payload = `${userId}:${username}:${Date.now()}`;
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex").slice(0, 16);
  return Buffer.from(`${payload}:${sig}`).toString("base64");
}

export function verifyToken(token: string): { valid: boolean; userId?: number } {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length !== 4) return { valid: false };

    const [userId, username, timestamp, sig] = parts;
    const payload = `${userId}:${username}:${timestamp}`;
    const expectedSig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex").slice(0, 16);

    if (sig !== expectedSig) return { valid: false };

    const age = Date.now() - Number(timestamp);
    if (age > 5 * 60 * 1000) return { valid: false };

    return { valid: true, userId: Number(userId) };
  } catch {
    return { valid: false };
  }
}
