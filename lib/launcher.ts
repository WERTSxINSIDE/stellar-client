/** Единая точка правды о версии лаунчера и ссылке на скачивание. */
export const LAUNCHER_VERSION = "1.0.3";

/**
 * Раздаём один самодостаточный exe: web/, client/mods и DLL уже внутри него.
 * При первом запуске он распаковывает их рядом с собой, отдельный zip с сайта
 * больше не нужен.
 */
export const LAUNCHER_DOWNLOAD_PATH = "/downloads/StellarLauncher.exe";

/** Ссылка для кнопки в кабинете: отдаёт файл только персоналу. */
export const LAUNCHER_DOWNLOAD_API_PATH = "/api/launcher-download";

export const LAUNCHER_DOWNLOAD_URL = `https://stellar-client.vercel.app${LAUNCHER_DOWNLOAD_PATH}`;

export const LAUNCHER_SIZE = 24_697_856;

export const LAUNCHER_SHA256 =
  "0c37e5eff8da445842d51a16238a878a5024d5514c1e0e30e336c8998ad4b96e";

/**
 * Технические работы: пока true, обычные пользователи видят плашку вместо
 * скачивания. Персонал (admin/support) скачивает как обычно.
 */
export const LAUNCHER_MAINTENANCE = true;

export const LAUNCHER_MAINTENANCE_MESSAGE =
  "Технические работы на стороне клиента, подождите пожалуйста новостей в телеграмм канале клиента:";

export const LAUNCHER_TELEGRAM_URL = "https://t.me/Stellar1dlc";
