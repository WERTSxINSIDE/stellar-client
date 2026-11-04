"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Robot } from "@phosphor-icons/react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FAQCard from "@/components/FAQCard";
import { useI18n } from "@/lib/i18n";

export default function FAQPage() {
  const { t } = useI18n();
  return (
    <>
      <Header />

      <main className="relative min-h-screen text-white overflow-hidden">
        <div className="absolute inset-0 -z-20 opacity-40">
          <Image
            src="/fluid1.png"
            alt="Background Shape"
            fill
            className="object-cover"
            priority
          />
        </div>

        <div className="absolute inset-0 -z-30 opacity-30">
          <Image
            src="/fluid2.png"
            alt="Background Shape 2"
            fill
            className="object-cover"
          />
        </div>

        <section className="relative z-10 pt-40 pb-32 flex flex-col items-center px-6">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-6xl font-extrabold mb-16 text-center"
          >
            FAQ
          </motion.h1>

          <FAQCard
            question={t("faq.q1")}
            answer={t("faq.a1")}
          />

          <FAQCard
            question={t("faq.q2")}
            answer={t("faq.a2")}
          />

          <FAQCard
            question={t("faq.q3")}
            answer={t("faq.a3")}
          />

          <FAQCard
            question={t("faq.q4")}
            answer={t("faq.a4")}
          />

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="mt-6 w-full max-w-3xl rounded-3xl border border-purple-400/20 bg-purple-500/[0.07] p-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 shrink-0 rounded-xl bg-purple-500/20 border border-purple-400/30 grid place-items-center text-purple-200">
                <Robot size={22} weight="fill" />
              </span>
              <div>
                <p className="font-semibold">{t("assistant.faqTitle")}</p>
                <p className="text-white/40 text-sm mt-1">{t("assistant.faqHint")}</p>
              </div>
            </div>
            <Link
              href="/assistant"
              className="shrink-0 inline-flex items-center justify-center rounded-xl bg-purple-600 hover:bg-purple-500 px-5 py-3 text-sm font-semibold transition"
            >
              {t("assistant.open")}
            </Link>
          </motion.div>
        </section>
      </main>

      <Footer />
    </>
  );
}
