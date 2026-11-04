import { describeUserAgent, getRequestMeta, isNewLoginDevice } from "./auth";
import { notifyUser } from "./notify";

/**
 * Проверяет, новый ли это браузер/устройство, и возвращает описание входа.
 * Вызывать до createSession: текущая сессия ещё не должна попасть в проверку.
 */
export async function checkLoginDevice(userId: number) {
  const meta = await getRequestMeta();
  const isNew = await isNewLoginDevice(userId, meta);
  return { meta, isNew };
}

/** Уведомление в колокольчик + письмо о входе с нового устройства. */
export async function alertNewLogin(userId: number, meta: { userAgent: string | null; ip: string | null }) {
  const device = describeUserAgent(meta.userAgent);
  const ip = meta.ip || "неизвестен";

  await notifyUser(
    userId,
    {
      type: "security",
      title: "Вход с нового устройства",
      body: `${device}. IP: ${ip}. Если это были не вы — смените пароль и завершите сессии в разделе «Безопасность».`,
      link: "/dashboard",
    },
    { email: true }
  );
}
