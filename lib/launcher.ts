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
  "75cdc1c3a8531e72c657db2782e32432532be2e00a907a4af8f5e692d657f0fa";
