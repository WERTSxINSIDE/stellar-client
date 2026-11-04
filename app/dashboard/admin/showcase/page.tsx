"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowCounterClockwise,
  ArrowLeft,
  CheckCircle,
  Coins,
  DownloadSimple,
  EyeSlash,
  StackSimple,
  VideoCamera,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import GridBackground from "@/components/GridBackground";

type ShowcaseItem = {
  id: number;
  user_id: number;
  type: "config" | "video";
  title: string;
  description: string | null;
  url: string | null;
  file_name: string | null;
  price: number | null;
  status: string;
  reward: number | null;
  admin_note: string | null;
  views: number | null;
  sales: number;
  created_at: string | null;
  approved_at: string | null;
  username: string;
  email: string;
  avatar_url: string | null;
  avg_rating: number;
  ratings: number;
};

type Counts = {
  pending?: number;
  approved?: number;
  rejected?: number;
  hidden?: number;
  total?: number;
};

const STATUS_TABS = [
  { id: "pending", label: "На модерации" },
  { id: "approved", label: "Одобренные" },
  { id: "rejected", label: "Отклонённые" },
  { id: "hidden", label: "Скрытые" },
  { id: "all", label: "Все" },
];

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminShowcasePage() {
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [counts, setCounts] = useState<Counts>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [rewards, setRewards] = useState<Record<number, string>>({});

  const load = useCallback(async (nextStatus: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin-showcase?status=${nextStatus}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось загрузить материалы");
        return;
      }
      setItems(Array.isArray(data.items) ? data.items : []);
      setCounts(data.counts || {});
    } catch {
      setError("Не удалось подключиться к серверу");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(status);
  }, [status, load]);

  async function act(item: ShowcaseItem, action: "approve" | "reject" | "hide" | "restore") {
    setBusy(item.id);
    setError("");
    try {
      const rawReward = rewards[item.id];
      const reward = rawReward === undefined ? undefined : Number(rawReward);
      const res = await fetch("/api/admin-showcase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          id: item.id,
          reward,
          admin_note: notes[item.id] || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось выполнить действие");
        return;
      }
      await load(status);
    } catch {
      setError("Не удалось подключиться к серверу");
    } finally {
      setBusy(null);
    }
  }

  function rewardFor(item: ShowcaseItem) {
    if (rewards[item.id] !== undefined) return rewards[item.id];
    return String(item.type === "video" ? 150 : 75);
  }

  return (
    <div className="relative min-h-screen bg-[#0a0710] text-white">
      <GridBackground />
      <Header />
      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-36 pb-24">
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-white/50 hover:text-white transition text-sm"
          >
            <ArrowLeft size={16} weight="bold" />В кабинет
          </Link>
          <Link
            href="/dashboard/admin"
            className="inline-flex items-center gap-2 text-white/50 hover:text-white transition text-sm"
          >
            <ArrowLeft size={16} weight="bold" />Админка
          </Link>
          <Link
            href="/dashboard/admin/risk"
            className="inline-flex items-center gap-2 text-red-300 hover:text-red-200 transition text-sm px-4 py-2 rounded-xl bg-red-500/10 border border-red-400/20"
          >
            <WarningCircle size={16} /> Риск-скор
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-extrabold mb-2">Витрина сообщества</h1>
          <p className="text-white/50">
            Модерация конфигов и видео-отзывов. Награда начисляется на баланс при одобрении.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { label: "На модерации", value: counts.pending || 0, color: "text-amber-300 border-amber-400/20 bg-amber-500/[0.06]" },
            { label: "Одобрено", value: counts.approved || 0, color: "text-emerald-300 border-emerald-400/20 bg-emerald-500/[0.06]" },
            { label: "Отклонено", value: counts.rejected || 0, color: "text-red-300 border-red-400/20 bg-red-500/[0.06]" },
            { label: "Скрыто", value: counts.hidden || 0, color: "text-sky-300 border-sky-400/20 bg-sky-500/[0.06]" },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-2xl border p-4 ${stat.color}`}>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs opacity-70 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatus(tab.id)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold border transition ${
                status === tab.id
                  ? "bg-purple-600 border-purple-500 text-white"
                  : "bg-white/5 border-white/10 text-white/55 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <p className="mb-5 text-sm text-red-300 flex items-center gap-2">
            <WarningCircle size={16} /> {error}
          </p>
        )}

        {loading ? (
          <p className="text-white/35 text-center py-16">Загрузка...</p>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center text-white/40">
            Материалов в этом разделе нет.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="shrink-0 rounded-xl bg-purple-500/15 border border-purple-400/20 p-2 text-purple-300">
                      {item.type === "config" ? (
                        <StackSimple size={20} weight="fill" />
                      ) : (
                        <VideoCamera size={20} weight="fill" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <h2 className="font-bold text-lg break-words">{item.title}</h2>
                      <p className="text-xs text-white/40">
                        {item.username} · {item.email} · {formatDate(item.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-white/55">
                      {item.type === "config" ? "Конфиг" : "Видео-отзыв"}
                    </span>
                    {item.type === "config" && (
                      <span className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-white/55">
                        {Number(item.price || 0) > 0 ? `${item.price} ₽` : "Бесплатно"}
                      </span>
                    )}
                    <span className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-1 text-white/55">
                      #{item.id}
                    </span>
                    {item.status === "approved" && (
                      <span className="rounded-lg bg-emerald-500/10 border border-emerald-400/20 px-2.5 py-1 text-emerald-300">
                        Опубликован
                      </span>
                    )}
                    {(item.ratings || 0) > 0 && (
                      <span className="rounded-lg bg-yellow-500/10 border border-yellow-400/20 px-2.5 py-1 text-yellow-300">
                        ★ {Number(item.avg_rating).toFixed(1)} · {item.ratings}
                      </span>
                    )}
                  </div>
                </div>

                {item.description && (
                  <p className="text-sm text-white/60 leading-relaxed whitespace-pre-line mb-3">
                    {item.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 text-xs text-white/40 mb-4">
                  {item.type === "video" && item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-purple-300 hover:text-purple-200"
                    >
                      Открыть видео
                    </a>
                  )}
                  {item.type === "config" && item.file_name && (
                    <a
                      href={`/api/showcase/${item.id}/download`}
                      className="inline-flex items-center gap-1.5 text-purple-300 hover:text-purple-200"
                    >
                      <DownloadSimple size={14} /> {item.file_name}
                    </a>
                  )}
                  <span>Просмотров: {item.views || 0}</span>
                  {item.type === "config" && <span>Продаж: {item.sales || 0}</span>}
                  {item.reward ? (
                    <span className="inline-flex items-center gap-1 text-emerald-300/80">
                      <Coins size={14} /> Награда: {item.reward} ₽
                    </span>
                  ) : null}
                  {item.admin_note && <span>Заметка: {item.admin_note}</span>}
                </div>

                <div className="grid md:grid-cols-[1fr_auto_auto] gap-2 items-center">
                  <input
                    value={notes[item.id] || ""}
                    onChange={(e) =>
                      setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    placeholder="Комментарий для автора (необязательно)"
                    maxLength={500}
                    className="bg-black/40 px-3 py-2 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-sm"
                  />

                  {item.status !== "approved" ? (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-white/40 whitespace-nowrap">Награда, ₽</label>
                      <input
                        type="number"
                        min={0}
                        max={5000}
                        value={rewardFor(item)}
                        onChange={(e) =>
                          setRewards((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        className="w-24 bg-black/40 px-3 py-2 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-sm"
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-white/30">Награда уже начислена</span>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {item.status === "pending" && (
                      <>
                        <button
                          type="button"
                          disabled={busy === item.id}
                          onClick={() => act(item, "approve")}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-3 py-2 text-sm font-semibold transition"
                        >
                          <CheckCircle size={16} /> Одобрить
                        </button>
                        <button
                          type="button"
                          disabled={busy === item.id}
                          onClick={() => act(item, "reject")}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-red-600/80 hover:bg-red-600 disabled:opacity-50 px-3 py-2 text-sm font-semibold transition"
                        >
                          <XCircle size={16} /> Отклонить
                        </button>
                      </>
                    )}

                    {item.status === "approved" && (
                      <button
                        type="button"
                        disabled={busy === item.id}
                        onClick={() => act(item, "hide")}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-50 px-3 py-2 text-sm font-semibold transition"
                      >
                        <EyeSlash size={16} /> Скрыть
                      </button>
                    )}

                    {(item.status === "hidden" || item.status === "rejected") && (
                      <button
                        type="button"
                        disabled={busy === item.id}
                        onClick={() => act(item, "restore")}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 px-3 py-2 text-sm font-semibold transition"
                      >
                        <ArrowCounterClockwise size={16} /> Вернуть в витрину
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
