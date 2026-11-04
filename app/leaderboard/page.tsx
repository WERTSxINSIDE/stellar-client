"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Loader from "@/components/Loader";
import GridBackground from "@/components/GridBackground";
import { useI18n } from "@/lib/i18n";
import { Trophy, Clock, RocketLaunch, Medal } from "@phosphor-icons/react";

type TimeRow = { username: string; seconds: number; launches: number };
type AchievementRow = {
  username: string;
  achievements: number;
  total: number;
  seconds: number;
};

export default function Leaderboard() {
  const { t } = useI18n();
  const [ready, setReady] = useState(false);
  const [top, setTop] = useState<TimeRow[]>([]);
  const [achievements, setAchievements] = useState<AchievementRow[]>([]);
  const [status, setStatus] = useState<{ online: number; launches_today: number } | null>(null);

  useEffect(() => {
    fetch("/api/player-top")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) return;
        setTop(d.top || []);
        setAchievements(d.achievements || []);
      })
      .catch(() => {});
    fetch("/api/server-status")
      .then((r) => r.json())
      .then((d) => d.ok && setStatus(d))
      .catch(() => {});
  }, []);

  function formatTime(s: number) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return t("top.hoursShort", { h, m });
    return t("top.minutesShort", { m });
  }

  function medal(index: number) {
    if (index >= 3) return null;
    return (
      <Trophy
        size={16}
        className={index === 0 ? "text-yellow-400" : index === 1 ? "text-gray-300" : "text-amber-600"}
      />
    );
  }

  return (
    <>
      <Loader onFinished={() => setReady(true)} />
      {ready && (
        <>
          <Header />
          <motion.main
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7 }}
            className="text-white relative z-10"
          >
            <section className="min-h-screen px-6 md:px-12 py-36 md:py-40 relative">
              <GridBackground className="absolute inset-0" />
              <div className="relative z-[2] max-w-5xl mx-auto">
                <h1 className="text-4xl md:text-6xl font-extrabold mb-4">{t("top.title")}</h1>
                <p className="text-white/50 text-lg mb-10">
                  {t("top.subtitle")}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10 max-w-2xl">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                    <div className="flex items-center gap-2 text-white/40 text-sm mb-2">
                      <Clock size={18} /> {t("top.onlineNow")}
                    </div>
                    <p className="text-3xl font-bold">{status?.online ?? "—"}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                    <div className="flex items-center gap-2 text-white/40 text-sm mb-2">
                      <RocketLaunch size={18} /> {t("top.launchesToday")}
                    </div>
                    <p className="text-3xl font-bold">{status?.launches_today ?? "—"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Clock size={20} className="text-purple-300" />
                      <h2 className="text-xl font-bold">{t("top.byTime")}</h2>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                      {top.length === 0 ? (
                        <p className="p-6 text-white/40">{t("top.noData")}</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-white/40 border-b border-white/10">
                              <th className="px-4 py-3">#</th>
                              <th className="px-4 py-3">{t("top.player")}</th>
                              <th className="px-4 py-3">{t("top.time")}</th>
                              <th className="px-4 py-3">{t("top.launches")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {top.map((p, i) => (
                              <tr key={p.username} className="border-b border-white/5 last:border-0">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    {medal(i)}
                                    <span>{i + 1}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-semibold">
                                  <Link
                                    href={`/u/${encodeURIComponent(p.username)}`}
                                    className="hover:text-purple-300 transition"
                                  >
                                    {p.username}
                                  </Link>
                                </td>
                                <td className="px-4 py-3 text-white/70">{formatTime(p.seconds)}</td>
                                <td className="px-4 py-3 text-white/40">{p.launches}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Medal size={20} className="text-amber-300" />
                      <h2 className="text-xl font-bold">{t("top.byAchievements")}</h2>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                      {achievements.length === 0 ? (
                        <p className="p-6 text-white/40">{t("top.noData")}</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-white/40 border-b border-white/10">
                              <th className="px-4 py-3">#</th>
                              <th className="px-4 py-3">{t("top.player")}</th>
                              <th className="px-4 py-3">{t("top.achievements")}</th>
                              <th className="px-4 py-3">{t("top.time")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {achievements.map((p, i) => (
                              <tr key={p.username} className="border-b border-white/5 last:border-0">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    {medal(i)}
                                    <span>{i + 1}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-semibold">
                                  <Link
                                    href={`/u/${encodeURIComponent(p.username)}`}
                                    className="hover:text-purple-300 transition"
                                  >
                                    {p.username}
                                  </Link>
                                </td>
                                <td className="px-4 py-3 text-white/70">
                                  {p.achievements}
                                  <span className="text-white/30"> / {p.total}</span>
                                </td>
                                <td className="px-4 py-3 text-white/40">{formatTime(p.seconds)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </motion.main>
          <Footer />
        </>
      )}
    </>
  );
}
