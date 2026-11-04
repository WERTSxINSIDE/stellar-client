"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CalendarBlank,
  Clock,
  Headset,
  Info,
  ListChecks,
} from "@phosphor-icons/react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { GUIDES, getGuide } from "@/lib/guides";
import { useI18n } from "@/lib/i18n";

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

export default function GuideArticle({ slug }: { slug: string }) {
  const { lang } = useI18n();
  const tr = (ru: string, en: string) => (lang === "en" ? en : ru);
  const guide = getGuide(slug);

  if (!guide) {
    return (
      <>
        <Header />
        <main className="min-h-screen pt-40 px-6 text-center">
          <h1 className="text-3xl font-bold mb-4">{tr("Гайд не найден", "Guide not found")}</h1>
          <Link href="/guides" className="text-purple-300 hover:text-purple-200">
            {tr("Все гайды", "All guides")}
          </Link>
        </main>
        <Footer />
      </>
    );
  }

  const others = GUIDES.filter((item) => item.slug !== guide.slug);

  return (
    <>
      <Header />
      <main className="relative min-h-screen text-white overflow-hidden">
        <div className="absolute inset-0 -z-20 opacity-25">
          <Image src="/fluid1.png" alt="" fill className="object-cover" priority />
        </div>

        <article className="relative z-10 pt-32 sm:pt-40 pb-20 px-4 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <Link
              href="/guides"
              className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition mb-8"
            >
              <ArrowLeft size={17} />
              {tr("Все гайды", "All guides")}
            </Link>

            <div className="lg:flex lg:gap-12 lg:items-start">
              <div className="min-w-0 flex-1">
                <motion.header
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45 }}
                  className="mb-10"
                >
                  <span className="inline-block text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full border border-purple-400/25 bg-purple-500/10 text-purple-200 mb-4">
                    {guide.category[lang]}
                  </span>
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight mb-4">
                    {guide.title[lang]}
                  </h1>
                  <p className="text-white/45 text-base sm:text-lg leading-relaxed max-w-3xl">
                    {guide.description[lang]}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-white/35 mt-5">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock size={14} />
                      {guide.readingMinutes} {tr("мин чтения", "min read")}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarBlank size={14} />
                      {tr("Обновлено", "Updated")} {formatDate(guide.updated)}
                    </span>
                  </div>
                </motion.header>

                <div className="space-y-10">
                  {guide.sections.map((section, index) => (
                    <motion.section
                      key={`${guide.slug}-${index}`}
                      id={`section-${index + 1}`}
                      initial={{ opacity: 0, y: 14 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.15 }}
                      transition={{ duration: 0.35 }}
                      className="scroll-mt-32"
                    >
                      <h2 className="text-2xl font-bold mb-4 flex items-start gap-3">
                        {section.steps && (
                          <span className="shrink-0 mt-1 w-7 h-7 rounded-lg bg-purple-600/20 border border-purple-400/25 text-purple-200 flex items-center justify-center text-xs font-bold">
                            {index + 1}
                          </span>
                        )}
                        {section.heading[lang]}
                      </h2>

                      {section.paragraphs?.map((paragraph, pIndex) => (
                        <p
                          key={`p-${pIndex}`}
                          className="text-white/55 leading-relaxed mb-3"
                        >
                          {paragraph[lang]}
                        </p>
                      ))}

                      {section.steps && (
                        <ol className="space-y-3 my-4">
                          {section.steps.map((step, sIndex) => (
                            <li key={`s-${sIndex}`} className="flex gap-3">
                              <span className="shrink-0 w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                                {sIndex + 1}
                              </span>
                              <span className="text-white/60 leading-relaxed">
                                {step[lang]}
                              </span>
                            </li>
                          ))}
                        </ol>
                      )}

                      {section.bullets && (
                        <ul className="space-y-2.5 my-4">
                          {section.bullets.map((bullet, bIndex) => (
                            <li key={`b-${bIndex}`} className="flex gap-3">
                              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-purple-400 mt-2.5" />
                              <span className="text-white/60 leading-relaxed">
                                {bullet[lang]}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {section.note && (
                        <div className="flex gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.07] p-4 mt-4">
                          <Info size={20} className="shrink-0 text-amber-300 mt-0.5" />
                          <p className="text-amber-100/80 text-sm leading-relaxed">
                            {section.note[lang]}
                          </p>
                        </div>
                      )}
                    </motion.section>
                  ))}
                </div>

                <div className="mt-12 rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-7">
                  <div className="flex items-start gap-3 mb-4">
                    <Headset size={24} className="text-purple-300 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-lg">
                        {tr("Остались вопросы?", "Still have questions?")}
                      </p>
                      <p className="text-white/40 text-sm mt-1 leading-relaxed">
                        {tr(
                          "Опишите проблему в тикете и приложите скриншот ошибки — так поддержка ответит быстрее.",
                          "Describe the issue in a ticket and attach an error screenshot so support can reply faster."
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link
                      href="/support"
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-sm font-semibold transition"
                    >
                      {tr("Написать в поддержку", "Contact support")}
                      <ArrowRight size={16} />
                    </Link>
                    <Link
                      href="/pricing"
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-semibold transition"
                    >
                      {tr("Тарифы и пополнение", "Pricing and top-up")}
                    </Link>
                  </div>
                </div>
              </div>

              <aside className="hidden lg:block w-64 shrink-0 sticky top-32 mt-2">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/40 mb-4">
                    <ListChecks size={15} />
                    {tr("Содержание", "Contents")}
                  </p>
                  <nav className="space-y-2">
                    {guide.sections.map((section, index) => (
                      <a
                        key={`toc-${index}`}
                        href={`#section-${index + 1}`}
                        className="block text-sm text-white/45 hover:text-white leading-snug transition"
                      >
                        {section.heading[lang]}
                      </a>
                    ))}
                  </nav>
                </div>
              </aside>
            </div>

            {others.length > 0 && (
              <section className="mt-16">
                <h2 className="text-2xl font-bold mb-5">
                  {tr("Другие гайды", "Other guides")}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {others.map((item) => (
                    <Link
                      key={item.slug}
                      href={`/guides/${item.slug}`}
                      className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:bg-white/[0.06] transition"
                    >
                      <span className="text-[10px] uppercase tracking-wider text-purple-300/80">
                        {item.category[lang]}
                      </span>
                      <p className="font-semibold mt-1.5 leading-snug">{item.title[lang]}</p>
                      <span className="inline-flex items-center gap-1.5 text-xs text-white/35 mt-3 group-hover:text-purple-300 transition">
                        {tr("Читать", "Read")}
                        <ArrowRight size={14} />
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
