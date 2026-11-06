/** Единая точка правды о версии лаунчера и ссылке на скачивание. */
export const LAUNCHER_VERSION = "1.0.0";

/**
 * Раздаём один exe. При первом запуске он сам скачивает client/mods, web и
 * DLL с /downloads/launcher-bundle.zip и распаковывает их рядом с собой.
 * Пользователю не нужен zip.
 */
export const LAUNCHER_DOWNLOAD_PATH = "/downloads/StellarLauncher.exe";

/** Ссылка для кнопки в кабинете: отдаёт файл только персоналу. */
export const LAUNCHER_DOWNLOAD_API_PATH = "/api/launcher-download";

export const LAUNCHER_DOWNLOAD_URL = `https://stellar-client.vercel.app${LAUNCHER_DOWNLOAD_PATH}`;

export const LAUNCHER_SIZE = 2_308_608;

export const LAUNCHER_SHA256 =
  "0855b0349f0bc1e101da341f06f912fe2d75de77aad280d82f1ce8e9cb9f0775";

/**
 * Технические работы: пока true, обычные пользователи видят плашку вместо
 * скачивания. Персонал (admin/support) скачивает как обычно.
 */
export const LAUNCHER_MAINTENANCE = true;

export const LAUNCHER_MAINTENANCE_MESSAGE =
  "Технические работы на стороне клиента, подождите пожалуйста новостей в телеграмм канале клиента:";

export const LAUNCHER_TELEGRAM_URL = "https://t.me/Stellar1dlc";
