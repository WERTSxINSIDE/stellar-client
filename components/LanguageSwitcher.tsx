"use client";

import { useI18n } from "@/lib/i18n";

/** Компактный переключатель языка для шапки сайта. */
export default function LanguageSwitcher() {
  const { lang, setLang } = useI18n();

  return (
    <div
      className="flex items-center rounded-xl bg-white/5 border border-white/10 p-0.5 text-xs font-semibold"
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => setLang("ru")}
        aria-pressed={lang === "ru"}
        className={`px-2.5 py-1.5 rounded-lg transition ${
          lang === "ru"
            ? "bg-purple-600 text-white"
            : "text-white/45 hover:text-white/80"
        }`}
      >
        RU
      </button>
      <button
        type="button"
        onClick={() => setLang("en")}
        aria-pressed={lang === "en"}
        className={`px-2.5 py-1.5 rounded-lg transition ${
          lang === "en"
            ? "bg-purple-600 text-white"
            : "text-white/45 hover:text-white/80"
        }`}
      >
        EN
      </button>
    </div>
  );
}
