"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

const POLL_MS = 20_000;

type Props = {
  className?: string;
  withLabel?: boolean;
};

/**
 * Бейдж онлайна в шапке.
 * Опрашивает /api/server-status раз в 20 секунд и обновляет цифру без перезагрузки.
 */
export default function OnlineBadge({ className = "", withLabel = false }: Props) {
  const { t } = useI18n();
  const [online, setOnline] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch("/api/server-status", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (active && data?.ok) setOnline(Number(data.online) || 0);
      } catch {
        // сеть недоступна — оставляем последнее значение
      }
    }

    load();
    const timer = setInterval(load, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const live = online !== null && online > 0;

  return (
    <Link
      href="/status"
      title={t("status.onlineLabel")}
      aria-label={
        online === null
          ? t("status.onlineLabel")
          : t("status.onlineCount", { count: online })
      }
      className={`inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 sm:px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/10 transition ${className}`}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        {live && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            live ? "bg-emerald-400" : "bg-white/35"
          }`}
        />
      </span>
      <span className="tabular-nums font-semibold text-white/90">
        {online === null ? "—" : online}
      </span>
      {withLabel && (
        <span className="hidden sm:inline text-white/50">
          {t("status.onlineLabel")}
        </span>
      )}
    </Link>
  );
}
