"use client";

import { useEffect } from "react";
import { applySiteTheme, SITE_THEME_STORAGE_KEY } from "@/lib/site-theme";

/**
 * Подтягивает купленную тему сайта и навешивает её класс на <html>.
 * Сначала используем кэш из localStorage, чтобы не было вспышки стандартного фона.
 */
export default function SiteTheme() {
  useEffect(() => {
    let cached: string | null = null;
    try {
      cached = localStorage.getItem(SITE_THEME_STORAGE_KEY);
    } catch {
      cached = null;
    }
    if (cached) applySiteTheme(cached);

    let cancelled = false;
    fetch("/api/me", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const theme = data?.user?.site_theme ?? null;
        applySiteTheme(theme);
      })
      .catch(() => {
        // сеть недоступна — остаёмся на кэшированной теме
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
