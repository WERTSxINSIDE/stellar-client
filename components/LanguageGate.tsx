"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check } from "@phosphor-icons/react";
import { useEffect } from "react";
import { useI18n } from "@/lib/i18n";

/**
 * Первый визит: предлагаем выбрать язык до начала работы с сайтом.
 * Показывается один раз, выбор сохраняется в localStorage и cookie.
 */
export default function LanguageGate() {
  const { showGate, chooseLang, t } = useI18n();

  useEffect(() => {
    if (!showGate) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [showGate]);

  return (
    <AnimatePresence>
      {showGate && (
        <motion.div
          key="language-gate"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xl px-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="language-gate-title"
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#141018]/95 p-8 md:p-10 shadow-2xl shadow-black/70"
          >
            <p className="text-white/35 text-[11px] tracking-[0.3em] uppercase text-center mb-3">
              Stellar Client
            </p>
            <h2
              id="language-gate-title"
              className="text-3xl md:text-4xl font-extrabold text-center text-white mb-3"
            >
              {t("gate.title")}
            </h2>
            <p className="text-center text-white/50 text-sm md:text-base mb-8 leading-relaxed">
              {t("gate.subtitle")}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => chooseLang("ru")}
                className="group relative rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-purple-500/10 hover:border-purple-400/40 px-5 py-6 text-left transition"
              >
                <span className="block text-2xl font-bold text-white mb-1">RU</span>
                <span className="block text-base font-semibold text-white/85">
                  {t("gate.ru")}
                </span>
                <span className="block text-xs text-white/40 mt-1">
                  {t("gate.ruHint")}
                </span>
                <Check
                  size={16}
                  className="absolute right-4 top-4 text-purple-300 opacity-0 group-hover:opacity-100 transition"
                />
              </button>

              <button
                type="button"
                onClick={() => chooseLang("en")}
                className="group relative rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-purple-500/10 hover:border-purple-400/40 px-5 py-6 text-left transition"
              >
                <span className="block text-2xl font-bold text-white mb-1">EN</span>
                <span className="block text-base font-semibold text-white/85">
                  {t("gate.en")}
                </span>
                <span className="block text-xs text-white/40 mt-1">
                  {t("gate.enHint")}
                </span>
                <Check
                  size={16}
                  className="absolute right-4 top-4 text-purple-300 opacity-0 group-hover:opacity-100 transition"
                />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
