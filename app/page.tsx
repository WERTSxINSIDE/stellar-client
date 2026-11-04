"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";

import Loader from "@/components/Loader";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Card from "@/components/Card";
import GridBackground from "@/components/GridBackground";
import { useI18n } from "@/lib/i18n";

import {
  Eye,
  SlidersHorizontal,
  Gauge,
  ArrowsClockwise,
} from "@phosphor-icons/react";

export default function Home() {
  const { t } = useI18n();
  const [ready, setReady] = useState(false);
  const [news, setNews] = useState<any[]>([]);
  const [online, setOnline] = useState<number | null>(null);

  const handleLoaderFinish = useCallback(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    fetch("/api/news")
      .then((r) => r.json())
      .then((d) => setNews(d.news || []))
      .catch(() => {});
    fetch("/api/server-status")
      .then((r) => r.json())
      .then((d) => d.ok && setOnline(d.online))
      .catch(() => {});
  }, []);

  return (
    <>
      <Loader onFinished={handleLoaderFinish} />

      {ready && (
        <>
          <Header />

          <motion.main
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7 }}
            className="text-white relative z-10"
          >
            <section className="min-h-screen px-4 sm:px-8 lg:px-16 xl:px-48 py-24 flex items-center relative">
              <GridBackground className="absolute inset-0" />
              <div className="relative z-[2] w-full flex items-center justify-center">
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7 }}
                  viewport={{ once: true }}
                  className="text-center"
                >
                  <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold leading-tight mb-6 sm:mb-8">
                    {t("home.about")}
                  </h1>

                  <p className="text-base sm:text-xl text-white/60 max-w-2xl mx-auto mb-5 sm:mb-6 leading-relaxed">
                    {t("home.p1")}
                  </p>

                  <p className="text-sm sm:text-lg text-white/45 max-w-2xl mx-auto mb-10 sm:mb-12 leading-relaxed">
                    {t("home.p2")}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6 mb-12 sm:mb-14">
                    <div>
                      <p className="text-3xl sm:text-4xl font-bold">{online !== null ? t("home.online", { count: online }) : "50+"}</p>
                      <p className="text-white/50 text-sm sm:text-base">{t("home.activeUsers")}</p>
                    </div>
                    <div>
                      <p className="text-3xl sm:text-4xl font-bold">30%+</p>
                      <p className="text-white/50 text-sm sm:text-base">{t("home.moreFps")}</p>
                    </div>
                    <div>
                      <p className="text-3xl sm:text-4xl font-bold">24/7</p>
                      <p className="text-white/50 text-sm sm:text-base">{t("home.support")}</p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </section>

            <section className="min-h-screen flex items-center px-4 sm:px-8 lg:px-16 xl:px-48 py-24 relative">
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
                viewport={{ once: true }}
                className="w-full"
              >
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold mb-8 sm:mb-10">
                  {t("home.advantages")}
                </h1>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8">
                  <Card
                    icon={<Eye size={26} />}
                    title={t("home.visualsTitle")}
                    description={t("home.visualsDesc")}
                  />
                  <Card
                    icon={<SlidersHorizontal size={26} />}
                    title={t("home.customTitle")}
                    description={t("home.customDesc")}
                  />
                  <Card
                    icon={<Gauge size={26} />}
                    title={t("home.perfTitle")}
                    description={t("home.perfDesc")}
                  />
                  <Card
                    icon={<ArrowsClockwise size={26} />}
                    title={t("home.updatesTitle")}
                    description={t("home.updatesDesc")}
                  />
                </div>
              </motion.div>
            </section>

            <section className="min-h-screen flex items-center justify-center px-4 sm:px-8 lg:px-16 xl:px-48 py-24 relative">
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
                viewport={{ once: true }}
                className="w-full flex flex-col items-center justify-center"
              >
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold mb-8 sm:mb-12 text-center">
                  {t("home.gameplay")}
                </h1>

                <div className="w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl shadow-black/50">
                  <iframe
                    className="rounded-2xl w-full h-[220px] sm:h-[340px] lg:h-[450px]"
                    src="https://www.youtube.com/embed/dQw4w9WgXcQ"
                    title="Gameplay Video"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                </div>
              </motion.div>
            </section>

            {news.length > 0 && (
              <section className="py-16 sm:py-24 px-4 sm:px-8 lg:px-16 xl:px-48 relative">
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7 }}
                  viewport={{ once: true }}
                  className="text-center mb-10 sm:mb-16"
                >
                  <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold mb-4">{t("home.news")}</h1>
                  <p className="text-white/50 text-base sm:text-lg">{t("home.newsSubtitle")}</p>
                </motion.div>

                <div className="max-w-4xl mx-auto flex flex-col gap-6">
                  {news.map((item: any) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                      viewport={{ once: true }}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-xs px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300">
                          {item.tag}
                        </span>
                        <span className="text-white/30 text-xs">{item.created_at?.slice(0, 10)}</span>
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                      <p className="text-white/60 leading-relaxed">{item.content}</p>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            <Footer />
          </motion.main>
        </>
      )}
    </>
  );
}
