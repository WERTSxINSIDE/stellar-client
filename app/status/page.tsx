"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowClockwise,
  CheckCircle,
  Clock,
  DownloadSimple,
  Pulse,
  RocketLaunch,
  UsersThree,
  WarningCircle,
} from "@phosphor-icons/react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import GridBackground from "@/components/GridBackground";
import { useI18n, type Lang } from "@/lib/i18n";

type Incident = {
  id: number;
  title: string;
  body: string | null;
  severity: string;
  status: string;
  started_at: string;
  resolved_at: string | null;
};

type StatusData = {
  ok: boolean;
  status: "operational" | "degraded" | "down";
  online: number;
  launches_today: number;
  users: number;
  launcher_version: string;
  uptime: { day: number; week: number; month: number };
  incidents: Incident[];
  updated_at: string;
};

const STATUS_STYLES: Record<
  string,
  { ring: string; text: string; dot: string; label: string }
> = {
  operational: {
    ring: "border-emerald-400/30 bg-emerald-500/10",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
    label: "status.operational",
  },
  degraded: {
    ring: "border-amber-400/30 bg-amber-500/10",
    text: "text-amber-300",
    dot: "bg-amber-400",
    label: "status.degraded",
  },
  down: {
    ring: "border-red-400/30 bg-red-500/10",
    text: "text-red-300",
    dot: "bg-red-400",
    label: "status.down",
  },
};

const SEVERITY_KEYS: Record<string, string> = {
  minor: "status.severity.minor",
  major: "status.severity.major",
  critical: "status.severity.critical",
  maintenance: "status.severity.maintenance",
};

const INCIDENT_STATUS_KEYS: Record<string, string> = {
  investigating: "status.incident.investigating",
  identified: "status.incident.identified",
  monitoring: "status.incident.monitoring",
  resolved: "status.incident.resolved",
};

function formatDate(value: string | null, lang: Lang) {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(lang === "en" ? "en-GB" : "ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function durationLabel(incident: Incident, lang: Lang) {
  const from = new Date(
    incident.started_at.includes("T")
      ? incident.started_at
      : incident.started_at.replace(" ", "T")
  ).getTime();
  const to = incident.resolved_at
    ? new Date(
        incident.resolved_at.includes("T")
          ? incident.resolved_at
          : incident.resolved_at.replace(" ", "T")
      ).getTime()
    : Date.now();
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return "";
  const minutes = Math.max(1, Math.round((to - from) / 60_000));
  if (minutes < 60) {
    return lang === "en" ? `${minutes} min` : `${minutes} мин`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) {
    return lang === "en" ? `${hours}h ${rest}m` : `${hours} ч ${rest} мин`;
  }
  const days = Math.floor(hours / 24);
  return lang === "en" ? `${days}d ${hours % 24}h` : `${days} д ${hours % 24} ч`;
}

export default function StatusPage() {
  const { t, lang } = useI18n();
  const [data, setData] = useState<StatusData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/status", { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        setError(payload.error || t("common.serverError"));
        return;
      }
      setData(payload as StatusData);
      setError("");
    } catch {
      setError(t("common.connectionError"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 20_000);
    return () => clearInterval(timer);
  }, [load]);

  const style = STATUS_STYLES[data?.status || "operational"];

  return (
    <div className="relative min-h-screen bg-[#0a0710] text-white">
      <GridBackground />
      <Header />

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-28 sm:pt-36 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-8 sm:mb-10"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/25 bg-purple-500/10 px-4 py-1.5 text-xs text-purple-200 mb-5">
            <Pulse size={15} weight="fill" /> {t("status.eyebrow")}
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold mb-3">
            {t("status.title")}
          </h1>
          <p className="text-white/50 text-sm sm:text-base max-w-2xl mx-auto">
            {t("status.subtitle")}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
          className={`rounded-3xl border p-6 sm:p-8 mb-5 ${style.ring}`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <div className="flex items-center gap-4">
              <span className="relative flex h-4 w-4 shrink-0">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${style.dot} opacity-60`} />
                <span className={`relative inline-flex rounded-full h-4 w-4 ${style.dot}`} />
              </span>
              <div>
                <p className={`text-xl sm:text-2xl font-bold ${style.text}`}>
                  {t(style.label)}
                </p>
                <p className="text-white/45 text-sm mt-1">
                  {t("status.lastUpdated")}:{" "}
                  {data ? formatDate(data.updated_at, lang) : t("common.loading")}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setRefreshing(true);
                load();
              }}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/8 hover:bg-white/15 disabled:opacity-60 border border-white/10 px-4 py-2.5 text-sm font-semibold transition"
            >
              <ArrowClockwise
                size={16}
                weight="bold"
                className={refreshing ? "animate-spin" : ""}
              />
              {t("status.refresh")}
            </button>
          </div>

          {error && (
            <p className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          )}
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
          <StatCard
            icon={<Pulse size={22} weight="fill" />}
            label={t("status.online")}
            value={data ? String(data.online) : "—"}
            accent="text-emerald-300"
          />
          <StatCard
            icon={<RocketLaunch size={22} weight="fill" />}
            label={t("status.launchesToday")}
            value={data ? String(data.launches_today) : "—"}
            accent="text-purple-300"
          />
          <StatCard
            icon={<UsersThree size={22} weight="fill" />}
            label={t("status.users")}
            value={data ? String(data.users) : "—"}
            accent="text-sky-300"
          />
          <StatCard
            icon={<DownloadSimple size={22} weight="fill" />}
            label={t("status.launcherVersion")}
            value={data ? data.launcher_version : "—"}
            accent="text-amber-300"
          />
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-7 mb-5">
          <h2 className="text-lg sm:text-xl font-bold mb-4 flex items-center gap-2">
            <CheckCircle size={20} weight="fill" className="text-emerald-300" />
            {t("status.uptimeTitle")}
          </h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { key: "day", label: t("status.uptimeDay") },
              { key: "week", label: t("status.uptimeWeek") },
              { key: "month", label: t("status.uptimeMonth") },
            ].map((row) => {
              const value = data?.uptime?.[row.key as "day" | "week" | "month"] ?? 0;
              return (
                <div
                  key={row.key}
                  className="rounded-2xl border border-white/10 bg-black/25 p-4"
                >
                  <p className="text-white/40 text-xs mb-1">{row.label}</p>
                  <p className="text-2xl font-bold">
                    {data ? `${value.toFixed(2)}%` : "—"}
                  </p>
                  <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all duration-700"
                      style={{ width: `${data ? Math.max(2, value) : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
          <div className="flex items-center gap-2 mb-5">
            <WarningCircle size={20} className="text-amber-300" />
            <h2 className="text-lg sm:text-xl font-bold">{t("status.incidentsTitle")}</h2>
          </div>

          {loading ? (
            <p className="text-white/35 text-center py-10">{t("common.loading")}</p>
          ) : !data || data.incidents.length === 0 ? (
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.05] px-5 py-8 text-center">
              <CheckCircle size={30} weight="fill" className="text-emerald-300 mx-auto mb-3" />
              <p className="text-white/60 text-sm">{t("status.noIncidents")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {data.incidents.map((incident) => {
                const active = !incident.resolved_at;
                return (
                  <div
                    key={incident.id}
                    className="rounded-2xl border border-white/10 bg-black/25 p-4 sm:p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                          active
                            ? "border-amber-400/25 bg-amber-500/10 text-amber-200"
                            : "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
                        }`}
                      >
                        {t(INCIDENT_STATUS_KEYS[incident.status] || "status.incident.investigating")}
                      </span>
                      <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/50">
                        {t(SEVERITY_KEYS[incident.severity] || "status.severity.minor")}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-white/30">
                        <Clock size={11} /> {formatDate(incident.started_at, lang)}
                        {durationLabel(incident, lang) && ` · ${durationLabel(incident, lang)}`}
                      </span>
                    </div>
                    <p className="font-semibold text-white/90">{incident.title}</p>
                    {incident.body && (
                      <p className="text-sm text-white/55 mt-1 whitespace-pre-line leading-relaxed">
                        {incident.body}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-center text-white/30 text-xs mt-8">
          {t("status.footerHint")}{" "}
          <Link href="/support" className="text-purple-300 hover:text-purple-200">
            {t("status.contactSupport")}
          </Link>
        </p>
      </main>

      <Footer />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <div className={`mb-3 ${accent}`}>{icon}</div>
      <p className="text-2xl font-bold leading-none truncate">{value}</p>
      <p className="text-white/40 text-xs mt-1.5">{label}</p>
    </div>
  );
}
