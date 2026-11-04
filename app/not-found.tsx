"use client";

import Link from "next/link";
import { Compass, House, Lifebuoy } from "@phosphor-icons/react";
import GridBackground from "@/components/GridBackground";
import { useI18n } from "@/lib/i18n";

export default function NotFound() {
  const { t } = useI18n();

  return (
    <div className="relative min-h-screen bg-[#0a0710] text-white flex items-center justify-center overflow-hidden px-4 py-20">
      <GridBackground />
      <div className="relative z-10 w-full max-w-lg text-center">
        <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-400/20 grid place-items-center text-purple-300">
          <Compass size={34} weight="fill" />
        </div>
        <p className="text-7xl sm:text-8xl font-extrabold leading-none mb-4 bg-gradient-to-b from-white to-white/30 bg-clip-text text-transparent">
          404
        </p>
        <h1 className="text-2xl sm:text-3xl font-extrabold mb-3">{t("notFound.title")}</h1>
        <p className="text-white/50 text-sm sm:text-base mb-8 leading-relaxed">
          {t("notFound.subtitle")}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 px-5 py-3 text-sm font-semibold transition"
          >
            <House size={17} weight="fill" /> {t("notFound.home")}
          </Link>
          <Link
            href="/support"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/8 hover:bg-white/15 border border-white/10 px-5 py-3 text-sm font-semibold transition"
          >
            <Lifebuoy size={17} weight="fill" /> {t("notFound.support")}
          </Link>
        </div>
      </div>
    </div>
  );
}
