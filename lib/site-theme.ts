/**
 * Темы оформления всего сайта.
 * Значение косметики site_theme — короткий id, например "aurora".
 * Класс на <html> включает соответствующую CSS-тему из globals.css.
 */
export const SITE_THEME_STORAGE_KEY = "stellar_site_theme";
export const SITE_THEME_CLASS_PREFIX = "site-theme-";

const THEME_ID_RE = /^[a-z0-9_]{1,40}$/;

export function siteThemeClass(value: string | null | undefined): string | null {
  const id = String(value ?? "").trim().toLowerCase();
  return THEME_ID_RE.test(id) ? `${SITE_THEME_CLASS_PREFIX}${id}` : null;
}

/** Применяет тему к <html> и запоминает её для мгновенного показа при следующем заходе. */
export function applySiteTheme(value: string | null | undefined) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  for (const cls of Array.from(root.classList)) {
    if (cls.startsWith(SITE_THEME_CLASS_PREFIX)) root.classList.remove(cls);
  }

  const cls = siteThemeClass(value);
  if (!cls) {
    root.removeAttribute("data-site-theme");
    try {
      localStorage.removeItem(SITE_THEME_STORAGE_KEY);
    } catch {
      // приватный режим — просто игнорируем
    }
    return;
  }

  root.classList.add(cls);
  const id = cls.slice(SITE_THEME_CLASS_PREFIX.length);
  root.setAttribute("data-site-theme", id);
  try {
    localStorage.setItem(SITE_THEME_STORAGE_KEY, id);
  } catch {
    // приватный режим — просто игнорируем
  }
}
