"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  ArrowLeft,
  ShieldWarning,
  ArrowsClockwise,
  CheckCircle,
  Prohibit,
  Trash,
  Fingerprint,
  UsersThree,
  WarningCircle,
  Globe,
  Clock,
} from "@phosphor-icons/react";

type RiskFlag = {
  code: string;
  severity: number;
  label: string;
  details: string;
};

type LinkedAccount = {
  id: number;
  username: string;
  reason: "hwid" | "ip";
  detail: string;
};

type RiskUser = {
  id: number;
  username: string;
  email: string;
  risk_score: number;
  flags: RiskFlag[];
  linked: LinkedAccount[];
  hwid: string | null;
  last_ip: string | null;
  last_seen_at: string | null;
  created_at: string | null;
  banned: number | null;
  subscription_end: string | null;
};

type Stats = {
  totalUsers: number;
  flaggedUsers: number;
  highRisk: number;
  openEvents: number;
};

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

function scoreColor(score: number) {
  if (score >= 60) return "text-red-300 border-red-400/30 bg-red-500/10";
  if (score >= 30) return "text-amber-300 border-amber-400/30 bg-amber-500/10";
  return "text-sky-300 border-sky-400/30 bg-sky-500/10";
}

function RiskGraph({ user }: { user: RiskUser }) {
  const linked = user.linked.slice(0, 8);
  const width = 360;
  const height = 190;
  const cx = width / 2;
  const cy = height / 2;
  const radius = 68;

  if (!linked.length) {
    return (
      <div className="h-[150px] grid place-items-center rounded-2xl border border-white/10 bg-black/30 text-sm text-white/35">
        Связей по HWID/IP не найдено
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Граф связей аккаунта">
        {linked.map((node, index) => {
          const angle = (Math.PI * 2 * index) / linked.length - Math.PI / 2;
          const x = cx + Math.cos(angle) * radius;
          const y = cy + Math.sin(angle) * radius;
          return (
            <g key={node.id}>
              <line
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                stroke={node.reason === "hwid" ? "rgba(192,132,252,0.55)" : "rgba(56,189,248,0.45)"}
                strokeWidth="1.5"
                strokeDasharray={node.reason === "ip" ? "4 3" : undefined}
              />
              <circle
                cx={x}
                cy={y}
                r="17"
                fill={node.reason === "hwid" ? "rgba(168,85,247,0.18)" : "rgba(14,165,233,0.16)"}
                stroke={node.reason === "hwid" ? "rgba(192,132,252,0.7)" : "rgba(56,189,248,0.6)"}
                strokeWidth="1.2"
              />
              <text
                x={x}
                y={y + 4}
                textAnchor="middle"
                fontSize="8"
                fill="white"
                opacity="0.9"
              >
                {node.username.length > 9 ? `${node.username.slice(0, 8)}…` : node.username}
              </text>
              <text x={x} y={y + 30} textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.45)">
                {node.reason === "hwid" ? "HWID" : "IP"}
              </text>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r="26" fill="rgba(168,85,247,0.22)" stroke="rgba(216,180,254,0.85)" strokeWidth="1.5" />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize="9" fill="white" fontWeight="700">
          {user.username.length > 10 ? `${user.username.slice(0, 9)}…` : user.username}
        </text>
      </svg>
      <div className="flex flex-wrap gap-3 justify-center text-[10px] text-white/40 pb-1">
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-purple-400/70" /> общий HWID
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-sky-400/70" /> общий IP
        </span>
      </div>
    </div>
  );
}

export default function AdminRiskPage() {
  const [ready, setReady] = useState(false);
  const [users, setUsers] = useState<RiskUser[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async (scan: boolean) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin-risk${scan ? "?scan=1" : ""}`, { cache: "no-store" });
      const data = await res.json();
      if (res.status === 403) {
        window.location.href = "/dashboard";
        return;
      }
      if (!res.ok) {
        setError(data.error || "Не удалось загрузить риск-данные");
        return;
      }
      setUsers(data.users || []);
      setStats(data.stats || null);
    } catch {
      setError("Ошибка соединения с сервером");
    } finally {
      setLoading(false);
      setScanning(false);
      setReady(true);
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  async function action(userId: number, actionName: string) {
    if (actionName === "ban" && !window.confirm("Забанить пользователя по риск-скору?")) return;
    if (actionName === "clear" && !window.confirm("Сбросить все флаги риска?")) return;
    if (actionName === "reset-hwid" && !window.confirm("Сбросить HWID пользователя?")) return;

    setBusyId(userId);
    try {
      const res = await fetch("/api/admin-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionName, user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Ошибка");
        return;
      }
      await load(false);
    } catch {
      alert("Ошибка соединения");
    } finally {
      setBusyId(null);
    }
  }

  async function rescan() {
    setScanning(true);
    await load(true);
  }

  if (!ready && loading) return null;

  return (
    <>
      <Header />
      <main className="relative min-h-screen text-white overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(168,85,247,0.16),transparent_45%),radial-gradient(circle_at_80%_20%,rgba(14,165,233,0.1),transparent_40%)]" />

        <div className="max-w-7xl mx-auto px-6 pt-36 pb-24">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
            <Link
              href="/dashboard/admin"
              className="inline-flex items-center gap-2 text-white/50 hover:text-white transition text-sm"
            >
              <ArrowLeft size={16} weight="bold" />В админку
            </Link>
            <button
              type="button"
              onClick={rescan}
              disabled={scanning}
              className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-60 transition"
            >
              <ArrowsClockwise size={16} className={scanning ? "animate-spin" : ""} />
              {scanning ? "Сканирую..." : "Пересчитать риск"}
            </button>
          </div>

          <p className="text-white/40 text-xs tracking-widest uppercase mb-2">Безопасность</p>
          <h1 className="text-5xl font-extrabold mb-3">
            <span className="bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
              HWID-граф и риск-скор
            </span>
          </h1>
          <p className="text-white/50 mb-10 max-w-3xl leading-relaxed">
            Автоматические флаги: общий HWID, кластеры IP, мультиаккаунты, частая смена IP и
            реферальный фрод. Чем выше скор — тем больше поводов проверить аккаунт.
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {[
              { label: "Всего пользователей", value: stats?.totalUsers ?? 0, icon: <UsersThree size={18} /> },
              { label: "С флагами", value: stats?.flaggedUsers ?? 0, icon: <ShieldWarning size={18} /> },
              { label: "Высокий риск", value: stats?.highRisk ?? 0, icon: <WarningCircle size={18} /> },
              { label: "Открытые события", value: stats?.openEvents ?? 0, icon: <Clock size={18} /> },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center gap-2 text-white/45 text-xs mb-2">
                  {item.icon}
                  {item.label}
                </div>
                <p className="text-3xl font-bold">{item.value}</p>
              </div>
            ))}
          </div>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center text-white/40">
              Загрузка...
            </div>
          ) : users.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center">
              <CheckCircle size={42} className="mx-auto text-green-300 mb-4" />
              <p className="text-xl font-semibold mb-2">Подозрительных аккаунтов нет</p>
              <p className="text-white/40 text-sm">
                Сканирование не нашло общих HWID, IP-кластеров или реферального фрода.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {users.map((user) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-3xl border border-white/10 bg-white/[0.035] overflow-hidden"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-5 border-b border-white/10">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Link
                          href={`/u/${encodeURIComponent(user.username)}`}
                          className="text-xl font-bold hover:text-purple-300 transition"
                        >
                          {user.username}
                        </Link>
                        {user.banned ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 border border-red-400/30 text-red-300">
                            забанен
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-white/40 break-all">{user.email}</p>
                      <div className="flex flex-wrap gap-4 mt-3 text-xs text-white/40">
                        <span className="inline-flex items-center gap-1">
                          <Fingerprint size={13} />
                          {user.hwid ? `${user.hwid.slice(0, 22)}…` : "HWID не привязан"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Globe size={13} />
                          {user.last_ip || "IP неизвестен"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock size={13} />
                          {formatDate(user.last_seen_at)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`rounded-2xl border px-4 py-3 text-center ${scoreColor(user.risk_score)}`}>
                        <p className="text-[10px] uppercase tracking-wider opacity-70">Риск</p>
                        <p className="text-3xl font-extrabold leading-none">{user.risk_score}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid lg:grid-cols-[1.15fr_1fr] gap-5 p-6">
                    <div>
                      <div className="flex flex-col gap-2 mb-4">
                        {user.flags.map((flag) => (
                          <div
                            key={flag.code}
                            className="rounded-xl border border-white/10 bg-black/25 px-4 py-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold">{flag.label}</p>
                              <span className="text-[10px] text-white/35">+{flag.severity}</span>
                            </div>
                            <p className="text-xs text-white/45 mt-1 leading-relaxed">{flag.details}</p>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busyId === user.id}
                          onClick={() => action(user.id, "clear")}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 transition"
                        >
                          <CheckCircle size={14} /> Сбросить флаги
                        </button>
                        <button
                          type="button"
                          disabled={busyId === user.id}
                          onClick={() => action(user.id, "reset-hwid")}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 transition"
                        >
                          <Trash size={14} /> Сбросить HWID
                        </button>
                        <button
                          type="button"
                          disabled={busyId === user.id}
                          onClick={() => action(user.id, user.banned ? "unban" : "ban")}
                          className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs border transition disabled:opacity-50 ${
                            user.banned
                              ? "bg-green-500/10 border-green-400/30 text-green-300 hover:bg-green-500/20"
                              : "bg-red-500/10 border-red-400/30 text-red-300 hover:bg-red-500/20"
                          }`}
                        >
                          <Prohibit size={14} /> {user.banned ? "Разбанить" : "Забанить"}
                        </button>
                      </div>
                    </div>

                    <RiskGraph user={user} />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
