"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Loader from "@/components/Loader";
import GridBackground from "@/components/GridBackground";
import { Trophy, Clock, RocketLaunch } from "@phosphor-icons/react";

export default function Leaderboard() {
  const [ready, setReady] = useState(false);
  const [top, setTop] = useState<any[]>([]);
  const [status, setStatus] = useState<{ online: number; launches_today: number } | null>(null);

  useEffect(() => {
    fetch("/api/player-top")
      .then((r) => r.json())
      .then((d) => d.ok && setTop(d.top))
      .catch(() => {});
    fetch("/api/server-status")
      .then((r) => r.json())
      .then((d) => d.ok && setStatus(d))
      .catch(() => {});
  }, []);

  function formatTime(s: number) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h} ч ${m} мин`;
    return `${m} мин`;
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
            <section className="min-h-screen px-48 py-40 relative">
              <GridBackground className="absolute inset-0" />
              <div className="relative z-[2]">
                <h1 className="text-6xl font-extrabold mb-4">Топ игроков</h1>
                <p className="text-white/50 text-lg mb-10">Рейтинг по времени в клиенте</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12 max-w-2xl">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                    <div className="flex items-center gap-2 text-white/40 text-sm mb-2">
                      <Clock size={18} /> Онлайн сейчас
                    </div>
                    <p className="text-3xl font-bold">{status?.online ?? "—"}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                    <div className="flex items-center gap-2 text-white/40 text-sm mb-2">
                      <RocketLaunch size={18} /> Запусков сегодня
                    </div>
                    <p className="text-3xl font-bold">{status?.launches_today ?? "—"}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden max-w-2xl">
                  {top.length === 0 ? (
                    <p className="p-6 text-white/40">Пока нет данных.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-white/40 border-b border-white/10">
                          <th className="px-5 py-3">#</th>
                          <th className="px-5 py-3">Игрок</th>
                          <th className="px-5 py-3">Время</th>
                          <th className="px-5 py-3">Запуски</th>
                        </tr>
                      </thead>
                      <tbody>
                        {top.map((p, i) => (
                          <tr key={p.username} className="border-b border-white/5">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                {i < 3 && <Trophy size={16} className={i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : "text-amber-600"} />}
                                <span>{i + 1}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3 font-semibold">{p.username}</td>
                            <td className="px-5 py-3 text-white/70">{formatTime(p.seconds)}</td>
                            <td className="px-5 py-3 text-white/40">{p.launches}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
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
