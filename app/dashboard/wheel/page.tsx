"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useI18n, type Lang } from "@/lib/i18n";
import { ArrowLeft, CircleNotch, ClockCounterClockwise } from "@phosphor-icons/react";

type PrizeInfo = {
  key: string;
  label: string;
  weight: number;
  kind: "sub" | "hwid" | "balance";
  hours?: number;
  days?: number;
  amount?: number;
  chance: number;
};

type WheelState = {
  canSpin: boolean;
  hoursLeft: number;
  spins: number;
  cooldownHours: number;
  prizes: PrizeInfo[];
};

const COLORS = ["#7c3aed", "#4338ca"];

function prizeLabel(key: string, fallback: string, lang: Lang) {
  if (lang !== "en") return fallback;
  if (key === "hwid") return "HWID reset";
  if (key === "lifetime") return "Lifetime";
  const hours = key.match(/^sub_(\d+)h$/);
  if (hours) return `${hours[1]} hour${hours[1] === "1" ? "" : "s"} of subscription`;
  const days = key.match(/^sub_(\d+)d$/);
  if (days) return `${days[1]} day${days[1] === "1" ? "" : "s"} of subscription`;
  const balance = key.match(/^balance_(\d+)$/);
  if (balance) return `+${balance[1]} ₽`;
  return fallback;
}

function shortLabel(label: string) {
  const s = label
    .replace(" подписки", "")
    .replace(" of subscription", "")
    .replace("HWID сброс", "HWID")
    .replace("HWID reset", "HWID");
  if (s.includes("₽")) return s.replace(" ₽", "₽");
  return s.length > 10 ? s.slice(0, 9) + "..." : s;
}

export default function WheelPage() {
  const { lang } = useI18n();
  const tr = (ru: string, en: string) => (lang === "en" ? en : ru);
  const router = useRouter();
  const [state, setState] = useState<WheelState | null>(null);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);

  const prizes = state?.prizes ?? [];
  const SEG_COUNT = prizes.length || 1;
  const SEG = 360 / SEG_COUNT;

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) router.replace("/login");
      });
    fetch("/api/wheel")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setState(d);
      })
      .finally(() => setLoading(false));
  }, [router]);

  const spin = useCallback(async () => {
    if (!state || spinning || (!state.canSpin && state.spins <= 0)) return;
    setSpinning(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/wheel", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || tr("Ошибка", "Error"));
        setSpinning(false);
        await refresh();
        return;
      }

      const idx: number = data.index ?? 0;
      const center = idx * SEG + SEG / 2;
      const jitter = Math.random() * 24 - 12;
      const currentMod = ((rotation % 360) + 360) % 360;
      const desired = (360 - center + jitter + 360) % 360;
      const delta = ((desired - currentMod) % 360 + 360) % 360 + 360 * 5;
      setRotation(rotation + delta);

      const delay = 4200;
      setTimeout(() => {
        setResult(prizeLabel(data.prize.key, data.prize.label, lang));
        setSpinning(false);
        refresh();
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, delay);
    } catch {
      setError(tr("Ошибка сервера", "Server error"));
      setSpinning(false);
    }
    }, [state, spinning, rotation, lang]);

  async function refresh() {
    const r = await fetch("/api/wheel");
    const d = await r.json();
    if (d.ok) setState(d);
  }

  const canGo = !!state && (state.spins > 0 || (state.canSpin && state.hoursLeft === 0));

  return (
    <div className="min-h-screen bg-[#07070d] text-white flex flex-col">
      <Header />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-10">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition mb-6"
        >
          <ArrowLeft size={16} /> {tr("Назад в дашборд", "Back to dashboard")}
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold">{tr("Колесо фортуны", "Wheel of fortune")}</h1>
          <p className="text-white/40 mt-2">
            {tr("Бесплатная крутка каждые", "A free spin every")} {state?.cooldownHours ?? 72} {tr("часа. Дополнительные крутки выпадают в", "hours. Extra spins drop from")}
            {tr("ежедневных наградах.", "daily rewards.")}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 sm:p-8 flex flex-col items-center">
            <div className="relative w-[300px] h-[300px] sm:w-[340px] sm:h-[340px] mb-6">
              <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-10 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[18px] border-l-transparent border-r-transparent border-t-white drop-shadow-lg" />
              <div
                className="w-full h-full rounded-full border-[6px] border-white/20 shadow-[0_0_50px_rgba(124,58,237,0.35)]"
                style={{
                  background: `conic-gradient(from 0deg, ${Array.from({ length: SEG_COUNT })
                    .map((_, i) => `${COLORS[i % 2]} ${i * SEG}deg ${(i + 1) * SEG}deg`)
                    .join(", ")})`,
                  transform: `rotate(${rotation}deg)`,
                  transition: spinning ? "transform 4.1s cubic-bezier(0.12, 0.6, 0.1, 1)" : "none",
                }}
              >
                {prizes.map((p, i) => (
                  <span
                    key={p.key}
                    className="absolute left-1/2 top-1/2 text-[8px] sm:text-[9px] font-bold uppercase tracking-wide text-white/90 whitespace-nowrap"
                    style={{
                      transform: `rotate(${i * SEG + SEG / 2}deg) translate(-50%, ${prizes.length > 8 ? "-110px" : "-118px"})`,
                      transformOrigin: "0 0",
                      textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                    }}
                  >
                    {shortLabel(prizeLabel(p.key, p.label, lang))}
                  </span>
                ))}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-[#07070d] border-4 border-white/30 z-[1] flex items-center justify-center">
                  <span className="text-lg font-black">SC</span>
                </div>
              </div>
            </div>

            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
            {result && (
              <div
                ref={resultRef}
                className="w-full rounded-2xl border border-purple-400/50 bg-purple-500/15 p-4 text-center mb-4"
              >
                <p className="text-purple-300 text-sm">{tr("Выпало:", "Result:")}</p>
                <p className="text-xl font-bold">{result}</p>
              </div>
            )}

            <button
              onClick={spin}
              disabled={loading || spinning || !canGo}
              className="w-full max-w-sm py-4 rounded-2xl font-bold text-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {spinning ? (
                <>
                  <CircleNotch size={20} className="animate-spin" /> {tr("Крутим...", "Spinning...")}
                </>
              ) : loading ? (
                tr("Загрузка...", "Loading...")
              ) : state && state.spins > 0 ? (
                tr(`Крутить (круток: ${state.spins})`, `Spin (spins: ${state.spins})`)
              ) : state && state.hoursLeft > 0 ? (
                tr(`Крутка через ${state.hoursLeft} ч.`, `Next spin in ${state.hoursLeft} h.`)
              ) : (
                tr("Крутить бесплатно", "Spin for free")
              )}
            </button>

            <div className="flex items-center gap-6 mt-4 text-sm text-white/50">
              <span className="inline-flex items-center gap-1.5">
                <ClockCounterClockwise size={16} /> {tr("Бесплатно раз в", "Free every")} {state?.cooldownHours ?? 72} {tr("ч", "h")}
              </span>
              <span>{tr("Бонус-крутки:", "Bonus spins:")} <span className="text-purple-300 font-semibold">{state?.spins ?? 0}</span></span>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 h-fit">
            <h3 className="text-lg font-bold mb-4">{tr("Шансы", "Odds")}</h3>
            <div className="space-y-2">
              {(state?.prizes ?? []).map((p) => (
                <div
                  key={p.key}
                  className="flex items-center justify-between gap-3 text-sm py-1.5 border-b border-white/5 last:border-0"
                >
                  <span className="text-white/70">{prizeLabel(p.key, p.label, lang)}</span>
                  <span className="text-purple-300 font-semibold whitespace-nowrap">{p.chance}%</span>
                </div>
              ))}
            </div>
            <p className="text-white/30 text-xs mt-4">
              {tr("Шансы указаны с учётом весов рулетки и в сумме дают 100%. Выигрыш в подписку добавляется к", "Odds are shown with roulette weights and add up to 100%. A subscription win is added to")}
              {tr("текущей подписке.", "your current subscription.")}
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
