"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarBlank, Megaphone, Sparkle } from "@phosphor-icons/react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CHANGELOG, changelogTypeLabelKey } from "@/lib/changelog";
import { useI18n } from "@/lib/i18n";

function formatDate(value: string, lang: "ru" | "en") {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(lang === "en" ? "en-GB" : "ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const TYPE_STYLES = {
  feature: "bg-purple-500/15 border-purple-400/30 text-purple-200",
  improvement: "bg-cyan-500/15 border-cyan-400/30 text-cyan-200",
  fix: "bg-amber-500/15 border-amber-400/30 text-amber-200",
} as const;

export default function ChangelogList() {
  const { lang } = useI18n();
  const tr = (ru: string, en: string) => (lang === "en" ? en : ru);

  return (
    <>
      <Header />
      <main className="relative min-h-screen text-white overflow-hidden">
        <div className="absolute inset-0 -z-20 opacity-25">
          <Image src="/fluid2.png" alt="" fill className="object-cover" priority />
        </div>

        <section className="relative z-10 pt-32 sm:pt-40 pb-20 px-4 sm:px-6">
          <div className="mx-auto max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-purple-300/80 mb-4">
                <Megaphone size={16} />
                {tr("Обновления", "Changelog")}
              </p>
              <h1 className="text-4xl sm:text-5xl font-extrabold mb-4">
                {tr("Что нового в Stellar Client", "What's new in Stellar Client")}
              </h1>
              <p className="text-white/45 max-w-2xl leading-relaxed">
                {tr(
                  "Публичный журнал изменений: новые функции, улучшения и исправления. Обновляем по мере выхода релизов.",
                  "A public changelog of new features, improvements and fixes. Updated as releases ship."
                )}
              </p>
            </motion.div>

            <div className="mt-12 space-y-6">
              {CHANGELOG.map((entry, index) => (
                <motion.article
                  key={entry.id}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.4, delay: index * 0.03 }}
                  className="relative rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 sm:p-7"
                >
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <span
                      className={`text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full border ${TYPE_STYLES[entry.type]}`}
                    >
                      {changelogTypeLabelKey(entry.type)[lang]}
                    </span>
                    {entry.version && (
                      <span className="text-xs font-mono text-white/40">
                        v{entry.version}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 text-xs text-white/35 ml-auto">
                      <CalendarBlank size={14} />
                      {formatDate(entry.date, lang)}
                    </span>
                  </div>

                  <h2 className="text-xl sm:text-2xl font-bold mb-2">
                    {entry.title[lang]}
                  </h2>
                  <p className="text-white/45 text-sm leading-relaxed mb-4">
                    {entry.summary[lang]}
                  </p>

                  <ul className="space-y-2">
                    {entry.items.map((item, itemIndex) => (
                      <li key={itemIndex} className="flex gap-2.5">
                        <Sparkle
                          size={14}
                          className="shrink-0 text-purple-300/70 mt-1"
                        />
                        <span className="text-white/55 text-sm leading-relaxed">
                          {item[lang]}
                        </span>
                      </li>
                    ))}
                  </ul>
                </motion.article>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href="/guides"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-semibold transition"
              >
                {tr("Гайды по клиенту", "Client guides")}
              </Link>
              <Link
                href="/support"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-semibold transition"
              >
                {tr("Предложить идею", "Suggest an idea")}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
