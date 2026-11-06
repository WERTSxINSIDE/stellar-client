/** Единая точка правды о версии лаунчера и ссылке на скачивание. */
export const LAUNCHER_VERSION = "1.0.0";

/**
 * Раздаём один exe. При первом запуске он сам скачивает client/mods, web и
 * DLL с /downloads/launcher-bundle.zip и распаковывает их рядом с собой.
 * Пользователю не нужен zip.
 */
export const LAUNCHER_DOWNLOAD_PATH = "/downloads/StellarLauncher.exe";

export const LAUNCHER_DOWNLOAD_URL = `https://stellar-client.vercel.app${LAUNCHER_DOWNLOAD_PATH}`;

export const LAUNCHER_SIZE = 2_307_584;

export const LAUNCHER_SHA256 =
  "fc0154063e745186cbba5e35d1690dc8a16936e4f4434bd896b82be31c0d995e";
