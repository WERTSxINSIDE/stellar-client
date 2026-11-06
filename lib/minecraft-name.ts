/**
 * Ник аккаунта сайта одновременно является ником в Minecraft: лаунчер
 * передаёт его в игру как имя игрока. Поэтому он должен подчиняться
 * правилам Minecraft (3–16 символов, латиница, цифры и `_`), иначе сервер
 * ответит `Invalid session` или не пустит в игру.
 */
export const MINECRAFT_NAME_MIN = 3;
export const MINECRAFT_NAME_MAX = 16;
export const MINECRAFT_NAME_PATTERN = /^[A-Za-z0-9_]+$/;

/** Обрезает пробелы; не строку превращает в пустую строку. */
export function normalizeMinecraftName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Текст ошибки для ника или null, если ник подходит для Minecraft. */
export function minecraftNameError(value: unknown): string | null {
  const name = normalizeMinecraftName(value);
  if (!name) {
    return "Укажите ник для Minecraft";
  }
  if (name.length < MINECRAFT_NAME_MIN || name.length > MINECRAFT_NAME_MAX) {
    return `Ник для Minecraft должен быть от ${MINECRAFT_NAME_MIN} до ${MINECRAFT_NAME_MAX} символов`;
  }
  if (!MINECRAFT_NAME_PATTERN.test(name)) {
    return "В нике для Minecraft можно использовать только латиницу, цифры и _";
  }
  return null;
}

/** Подходит ли ник для Minecraft. */
export function isMinecraftName(value: unknown): boolean {
  return minecraftNameError(value) === null;
}
