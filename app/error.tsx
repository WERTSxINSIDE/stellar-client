"use client";

import { useEffect } from "react";
import Link from "next/link";
import { WarningCircle, ArrowClockwise, House } from "@phosphor-icons/react";
import GridBackground from "@/components/GridBackground";
import { useI18n } from "@/lib/i18n";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="relative min-h-screen bg-[#0a0710] text-white flex items-center justify-center overflow-hidden px-4 py-20">
      <GridBackground />
      <div className="relative z-10 w-full max-w-lg rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl p-8 sm:p-10 text-center">
        <div className="mx-auto mb-5 w-14 h-14 rounded-2xl bg-red-500/10 border border-red-400/20 grid place-items-center text-red-300">
          <WarningCircle size={30} weight="fill" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold mb-3">{t("error.title")}</h1>
        <p className="text-white/50 text-sm sm:text-base mb-8 leading-relaxed">
          {t("error.subtitle")}
        </p>
        {error.digest && (
          <p className="text-[11px] text-white/25 mb-6 break-all">ID: {error.digest}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 px-5 py-3 text-sm font-semibold transition"
          >
            <ArrowClockwise size={17} weight="bold" /> {t("error.retry")}
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/8 hover:bg-white/15 border border-white/10 px-5 py-3 text-sm font-semibold transition"
          >
            <House size={17} weight="fill" /> {t("notFound.home")}
          </Link>
        </div>
      </div>
    </div>
  );
}
