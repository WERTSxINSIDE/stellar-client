"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import {
  ArrowLeft,
  CheckCircle,
  Plus,
  Pulse,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";

type Incident = {
  id: number;
  title: string;
  body: string | null;
  severity: string;
  status: string;
  started_at: string;
  resolved_at: string | null;
};

const SEVERITIES = [
  { value: "minor", label: "Незначительный" },
  { value: "major", label: "Серьёзный" },
  { value: "critical", label: "Критический" },
  { value: "maintenance", label: "Тех. работы" },
];

const STATUSES = [
  { value: "investigating", label: "Расследуем" },
  { value: "identified", label: "Причина найдена" },
  { value: "monitoring", label: "Наблюдаем" },
  { value: "resolved", label: "Решено" },
];

function fmt(value: string | null) {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminStatusPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [msg, setMsg] = useState("");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState("minor");
  const [status, setStatus] = useState("investigating");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/status", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Не удалось загрузить инциденты");
        return;
      }
      setIncidents(Array.isArray(data.incidents) ? data.incidents : []);
    } catch {
      setMsg("Ошибка сервера");
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
        if (!(d.user.is_admin || d.user.role === "admin")) {
          router.replace("/dashboard");
          return;
        }
        setAllowed(true);
        load();
      })
      .catch(() => setMsg("Ошибка сервера"));
  }, [router, load]);

  async function create() {
    if (title.trim().length < 3) {
      setMsg("Укажите заголовок (минимум 3 символа)");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, severity, status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Не удалось создать инцидент");
        return;
      }
      setTitle("");
      setBody("");
      setSeverity("minor");
      setStatus("investigating");
      setMsg("Инцидент создан ✓");
      await load();
    } catch {
      setMsg("Ошибка сервера");
    } finally {
      setSaving(false);
    }
  }

  async function update(incident: Incident, patch: Partial<Incident>) {
    try {
      const res = await fetch("/api/admin/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: incident.id, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Не удалось обновить");
        return;
      }
      await load();
    } catch {
      setMsg("Ошибка сервера");
    }
  }

  async function remove(incident: Incident) {
    if (!confirm(`Удалить инцидент «${incident.title}»?`)) return;
    try {
      const res = await fetch("/api/admin/status", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: incident.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Не удалось удалить");
        return;
      }
      await load();
    } catch {
      setMsg("Ошибка сервера");
    }
  }

  if (loading) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-[#0a0710] text-white pt-36 px-6">
          <p className="text-white/35 text-center">Загрузка...</p>
        </main>
      </>
    );
  }

  if (!allowed) return null;

  return (
    <>
      <Header />
      <main className="relative min-h-screen bg-[#0a0710] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-28 sm:pt-36 pb-24">
          <Link
            href="/dashboard/admin"
            className="inline-flex items-center gap-2 text-white/50 hover:text-white transition text-sm mb-8"
          >
            <ArrowLeft size={16} weight="bold" /> В админ панель
          </Link>

          <div className="flex items-center gap-3 mb-2">
            <Pulse size={26} weight="fill" className="text-emerald-400" />
            <p className="text-white/40 text-xs tracking-widest uppercase">Статус</p>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">Инциденты</h1>
          <p className="text-white/45 text-sm mb-8">
            Записи показываются на публичной странице <Link href="/status" className="text-purple-300">/status</Link>.
            Пока инцидент не помечен как «Решено», сервис отображается как деградировавший.
          </p>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-6 mb-8">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Plus size={18} weight="bold" /> Новый инцидент
            </h2>
            <div className="flex flex-col gap-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Заголовок, например: Плановые работы"
                maxLength={120}
                className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-sm"
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Что произошло и что делаем"
                rows={3}
                maxLength={2000}
                className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-sm resize-none"
              />
              <div className="grid sm:grid-cols-2 gap-3">
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-sm"
                >
                  {SEVERITIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-sm"
                >
                  {STATUSES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              {msg && (
                <p className={`text-sm ${msg.includes("✓") ? "text-emerald-300" : "text-red-300"}`}>
                  {msg}
                </p>
              )}
              <button
                type="button"
                onClick={create}
                disabled={saving}
                className="self-start inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-60 px-5 py-2.5 text-sm font-semibold transition"
              >
                <Plus size={16} weight="bold" /> {saving ? "Создание..." : "Создать"}
              </button>
            </div>
          </div>

          <h2 className="font-semibold mb-4">История ({incidents.length})</h2>

          {incidents.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center text-white/40 text-sm">
              Инцидентов пока нет.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {incidents.map((incident) => {
                const active = !incident.resolved_at;
                return (
                  <div
                    key={incident.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {active ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200">
                          <WarningCircle size={11} /> Активен
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200">
                          <CheckCircle size={11} /> Решён
                        </span>
                      )}
                      <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/50">
                        {incident.severity}
                      </span>
                      <span className="text-[11px] text-white/30">{fmt(incident.started_at)}</span>
                    </div>
                    <p className="font-semibold">{incident.title}</p>
                    {incident.body && (
                      <p className="text-sm text-white/50 mt-1 whitespace-pre-line">{incident.body}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <select
                        value={incident.status}
                        onChange={(e) => update(incident, { status: e.target.value })}
                        className="bg-black/40 px-3 py-2 rounded-lg border border-white/10 text-xs outline-none"
                      >
                        {STATUSES.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={incident.severity}
                        onChange={(e) => update(incident, { severity: e.target.value })}
                        className="bg-black/40 px-3 py-2 rounded-lg border border-white/10 text-xs outline-none"
                      >
                        {SEVERITIES.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => remove(incident)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20 transition"
                      >
                        <Trash size={14} /> Удалить
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
