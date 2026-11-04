"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  ArrowLeft,
  ShieldCheck,
  MagnifyingGlass,
  CircleNotch,
  ClockCounterClockwise,
} from "@phosphor-icons/react";

type LogItem = {
  id: number;
  admin_id: number | null;
  admin_username: string | null;
  action: string;
  target_user_id: number | null;
  target_username: string | null;
  details: string | null;
  created_at: string;
};

const ACTION_LABELS: Record<string, string> = {
  "user.set-role": "Смена роли",
  "user.ban": "Блокировка пользователя",
  "user.unban": "Разблокировка пользователя",
  "user.delete": "Удаление пользователя",
  "user.reduce-subscription": "Уменьшение подписки",
  "user.add-subscription": "Продление подписки",
  "user.change-password": "Смена пароля",
  "user.change-username": "Смена ника",
  "user.add-balance": "Изменение баланса",
  "keys.generate": "Генерация ключей",
  "media.approve": "Одобрение видео",
  "media.reject": "Отклонение видео",
  "partner.approve": "Одобрение партнёра",
  "partner.reject": "Отклонение партнёра",
  "news.create": "Создание новости",
  "news.delete": "Удаление новости",
  "support.reply": "Ответ в поддержке",
};

function formatDate(value: string) {
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

export default function AdminLogsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (query: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin-logs${query ? `?q=${encodeURIComponent(query)}` : ""}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось загрузить журнал");
        return;
      }
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) {
          router.replace("/login");
          return;
        }
        if (!d.user.is_admin && d.user.role !== "admin") {
          router.replace("/dashboard");
          return;
        }
        setReady(true);
        load("");
      })
      .catch(() => router.replace("/dashboard"));
  }, [router, load]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    load(search.trim());
  }

  if (!ready) return null;

  return (
    <>
      <Header />
      <main className="relative min-h-screen text-white overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none bg-[radial-gradient(circle_at_20%_0%,rgba(147,51,234,0.16),transparent_55%)]" />

        <div className="w-full max-w-6xl mx-auto px-6 pt-36 pb-24">
          <div className="flex flex-wrap items-center gap-3 mb-8">
            <Link
              href="/dashboard/admin"
              className="inline-flex items-center gap-2 text-white/50 hover:text-white transition text-sm"
            >
              <ArrowLeft size={16} weight="bold" />В админку
            </Link>
          </div>

          <div className="flex items-center gap-3 mb-2">
            <ShieldCheck size={26} className="text-purple-400" />
            <p className="text-white/40 text-xs tracking-widest uppercase">Управление</p>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-3">Журнал действий</h1>
          <p className="text-white/40 mb-8">
            Все изменения, сделанные администраторами. Записей: {total.toLocaleString("ru-RU")}
          </p>

          <form onSubmit={submitSearch} className="flex gap-2 mb-6 max-w-2xl">
            <div className="relative flex-1">
              <MagnifyingGlass
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по админу, действию, пользователю..."
                className="w-full bg-black/40 pl-11 pr-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-sm"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-3 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 transition"
            >
              Найти
            </button>
          </form>

          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 text-red-300 px-4 py-3 text-sm mb-6">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-3 py-24 text-white/40">
              <CircleNotch size={20} className="animate-spin" /> Загрузка журнала...
            </div>
          ) : logs.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center">
              <ClockCounterClockwise size={40} className="text-white/20 mx-auto mb-4" />
              <p className="text-lg font-semibold mb-1">Записей нет</p>
              <p className="text-white/40">
                {search ? "По вашему запросу ничего не найдено." : "Администраторы пока не совершали действий."}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-white/40 border-b border-white/10">
                      <th className="px-4 py-3 whitespace-nowrap">Дата</th>
                      <th className="px-4 py-3 whitespace-nowrap">Админ</th>
                      <th className="px-4 py-3 whitespace-nowrap">Действие</th>
                      <th className="px-4 py-3 whitespace-nowrap">Цель</th>
                      <th className="px-4 py-3">Детали</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                        <td className="px-4 py-3 text-white/40 whitespace-nowrap align-top">
                          {formatDate(log.created_at)}
                        </td>
                        <td className="px-4 py-3 font-semibold whitespace-nowrap align-top">
                          {log.admin_username || `#${log.admin_id ?? "—"}`}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap align-top">
                          <span className="inline-flex px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-400/25 text-purple-200 text-xs font-medium">
                            {ACTION_LABELS[log.action] || log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap align-top">
                          {log.target_username ? (
                            <Link
                              href={`/u/${encodeURIComponent(log.target_username)}`}
                              className="hover:text-purple-300 transition"
                            >
                              {log.target_username}
                            </Link>
                          ) : (
                            <span className="text-white/30">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-white/50 align-top break-words min-w-[12rem]">
                          {log.details || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
