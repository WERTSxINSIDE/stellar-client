"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";

import Loader from "@/components/Loader";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Card from "@/components/Card";
import { useI18n } from "@/lib/i18n";

import {
  Eye,
  SlidersHorizontal,
  Gauge,
  ArrowsClockwise,
  DownloadSimple,
} from "@phosphor-icons/react";
import { LAUNCHER_DOWNLOAD_PATH } from "@/lib/launcher";

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
            transition={{ duration: 0.5 }}
            className="relative z-10 text-white"
          >
            <section className="px-5 pb-20 pt-32 sm:px-8 sm:pb-28 sm:pt-40">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: "easeOut" }}
                className="mx-auto max-w-3xl text-center"
              >
                <p className="mb-5 text-[11px] uppercase tracking-[0.25em] text-purple-300/80">
                  {t("home.about")}
                </p>
                <h1 className="text-3xl font-semibold leading-tight sm:text-5xl">
                  Stellar Client
                </h1>

                <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-white/60 sm:text-lg">
                  {t("home.p1")}
                </p>

                <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/45 sm:text-base">
                  {t("home.p2")}
                </p>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <a
                    href={LAUNCHER_DOWNLOAD_PATH}
                    download
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-purple-500"
                  >
                    <DownloadSimple size={18} />
                    {t("home.downloadLauncher")}
                  </a>
                </div>

                <div className="mx-auto mt-12 grid max-w-2xl grid-cols-1 gap-6 border-t border-white/[0.08] pt-8 sm:grid-cols-3">
                  <div>
                    <p className="text-2xl font-semibold sm:text-3xl">
                      {online !== null ? t("home.online", { count: online }) : "50+"}
                    </p>
                    <p className="mt-1 text-sm text-white/45">{t("home.activeUsers")}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold sm:text-3xl">30%+</p>
                    <p className="mt-1 text-sm text-white/45">{t("home.moreFps")}</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold sm:text-3xl">24/7</p>
                    <p className="mt-1 text-sm text-white/45">{t("home.support")}</p>
                  </div>
                </div>
              </motion.div>
            </section>

            <section className="px-5 pb-20 sm:px-8 sm:pb-28">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                viewport={{ once: true, amount: 0.2 }}
                className="mx-auto max-w-6xl"
              >
                <h2 className="mb-8 text-2xl font-semibold sm:text-3xl">
                  {t("home.advantages")}
                </h2>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Card
                    icon={<Eye size={20} />}
                    title={t("home.visualsTitle")}
                    description={t("home.visualsDesc")}
                  />
                  <Card
                    icon={<SlidersHorizontal size={20} />}
                    title={t("home.customTitle")}
                    description={t("home.customDesc")}
                  />
                  <Card
                    icon={<Gauge size={20} />}
                    title={t("home.perfTitle")}
                    description={t("home.perfDesc")}
                  />
                  <Card
                    icon={<ArrowsClockwise size={20} />}
                    title={t("home.updatesTitle")}
                    description={t("home.updatesDesc")}
                  />
                </div>
              </motion.div>
            </section>

            <section className="px-5 pb-20 sm:px-8 sm:pb-28">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                viewport={{ once: true, amount: 0.2 }}
                className="mx-auto max-w-4xl"
              >
                <h2 className="mb-6 text-2xl font-semibold sm:mb-8 sm:text-3xl">
                  {t("home.gameplay")}
                </h2>

                <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-black/40">
                  <iframe
                    className="h-[220px] w-full sm:h-[340px] lg:h-[420px]"
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
              <section className="px-5 pb-20 sm:px-8 sm:pb-28">
                <div className="mx-auto max-w-4xl">
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    viewport={{ once: true }}
                    className="mb-8"
                  >
                    <h2 className="text-2xl font-semibold sm:text-3xl">{t("home.news")}</h2>
                    <p className="mt-2 text-sm text-white/45">{t("home.newsSubtitle")}</p>
                  </motion.div>

                  <div className="flex flex-col gap-4">
                    {news.map((item: any) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 12 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35 }}
                        viewport={{ once: true }}
                        className="rounded-xl border border-white/[0.08] bg-[#111114]/60 p-5"
                      >
                        <div className="mb-3 flex items-center gap-3">
                          <span className="rounded-full border border-purple-500/30 bg-purple-500/15 px-2.5 py-0.5 text-xs text-purple-300">
                            {item.tag}
                          </span>
                          <span className="text-xs text-white/30">{item.created_at?.slice(0, 10)}</span>
                        </div>
                        <h3 className="mb-2 text-lg font-medium text-white">{item.title}</h3>
                        <p className="text-sm leading-relaxed text-white/55">{item.content}</p>
                      </motion.div>
                    ))}
                  </div>
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
