"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BookOpenText, Clock, Robot } from "@phosphor-icons/react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { GUIDES } from "@/lib/guides";
import { useI18n } from "@/lib/i18n";

export default function GuidesList() {
  const { lang } = useI18n();
  const tr = (ru: string, en: string) => (lang === "en" ? en : ru);

  return (
    <>
      <Header />
      <main className="relative min-h-screen text-white overflow-hidden">
        <div className="absolute inset-0 -z-20 opacity-30">
          <Image src="/fluid1.png" alt="" fill className="object-cover" priority />
        </div>

        <section className="relative z-10 pt-32 sm:pt-40 pb-20 px-4 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-purple-300/80 mb-4">
                <BookOpenText size={16} />
                {tr("Гайды", "Guides")}
              </p>
              <h1 className="text-4xl sm:text-5xl font-extrabold mb-4">
                {tr("Инструкции по Stellar Client", "Stellar Client guides")}
              </h1>
              <p className="text-white/45 max-w-2xl leading-relaxed">
                {tr(
                  "Короткие практические статьи: как установить лаунчер, выбрать конфиг и решить вопросы с HWID. Без воды и лишних шагов.",
                  "Short practical articles: install the launcher, choose a config and sort out HWID issues. No fluff, no extra steps."
                )}
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-12">
              {GUIDES.map((guide, index) => (
                <motion.div
                  key={guide.slug}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                >
                  <Link
                    href={`/guides/${guide.slug}`}
                    className="group flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 hover:bg-white/[0.07] hover:border-purple-400/25 transition"
                  >
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <span className="text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full border border-purple-400/25 bg-purple-500/10 text-purple-200">
                        {guide.category[lang]}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs text-white/35">
                        <Clock size={14} />
                        {guide.readingMinutes} {tr("мин", "min")}
                      </span>
                    </div>

                    <h2 className="text-xl font-bold leading-snug mb-3">
                      {guide.title[lang]}
                    </h2>
                    <p className="text-white/40 text-sm leading-relaxed mb-6">
                      {guide.description[lang]}
                    </p>

                    <span className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-purple-300 group-hover:text-purple-200 transition">
                      {tr("Читать", "Read")}
                      <ArrowRight
                        size={16}
                        className="transition group-hover:translate-x-0.5"
                      />
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>

            <div className="mt-12 rounded-3xl border border-white/10 bg-white/[0.03] p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="font-semibold">
                  {tr("Не нашли ответ?", "Didn't find an answer?")}
                </p>
                <p className="text-white/40 text-sm mt-1">
                  {tr(
                    "Поддержка отвечает в тикетах и помогает с оплатой, HWID и запуском.",
                    "Support replies in tickets and helps with payments, HWID and startup."
                  )}
                </p>
              </div>
              <Link
                href="/assistant"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-purple-400/30 bg-purple-500/10 hover:bg-purple-500/20 text-sm font-semibold text-purple-100 transition"
              >
                <Robot size={16} weight="fill" />
                {tr("Спросить помощника", "Ask the assistant")}
              </Link>
              <Link
                href="/support"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-sm font-semibold transition"
              >
                {tr("Написать в поддержку", "Contact support")}
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
