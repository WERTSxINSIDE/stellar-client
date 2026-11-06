/** Единая точка правды о версии лаунчера и ссылке на скачивание. */
export const LAUNCHER_VERSION = "1.0.0";

/**
 * Лаунчер отдаётся напрямую с сайта (public/downloads), без Google Drive и
 * сторонних файлообменников. Файл маленький, поэтому спокойно живёт в
 * статике Vercel.
 *
 * Раздаём zip, а не один exe: рядом с ним обязаны лежать client/mods, web и
 * DLL — без них лаунчер не запустится.
 */
export const LAUNCHER_DOWNLOAD_PATH = "/downloads/StellarLauncher.zip";

export const LAUNCHER_DOWNLOAD_URL = `https://stellar-client.vercel.app${LAUNCHER_DOWNLOAD_PATH}`;

export const LAUNCHER_SIZE = 23_398_541;

export const LAUNCHER_SHA256 =
  "d17f89f109740e13bbe439986727ce7fa9deceda243dc1f7b1c59cb14fc843ec";
