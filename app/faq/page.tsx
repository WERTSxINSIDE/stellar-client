"use client";

import Image from "next/image";
import { motion } from "framer-motion";

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
        </section>
      </main>

      <Footer />
    </>
  );
}
