"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useI18n } from "@/lib/i18n";
import {
  ArrowLeft,
  CheckCircle,
  Coins,
  Crown,
  Gift,
  Lock,
  Sparkle,
  Trophy,
  WarningCircle,
} from "@phosphor-icons/react";

type Reward =
  | { kind: "coins"; amount: number }
  | { kind: "cosmetic"; key: string; title: string; icon: string | null; rarity?: string | null };

type Level = {
  level: number;
  xp: number;
  free: Reward;
  premium: Reward;
  unlocked: boolean;
  free_claimed: boolean;
  premium_claimed: boolean;
};

type State = {
  season: { id: string; title_ru: string; title_en: string; starts_at: string; ends_at: string };
  xp: number;
  level: number;
  premium: boolean;
  premium_price: number;
  max_level: number;
  xp_per_level: number;
  xp_to_next: number;
  levels: Level[];
  claimable: number;
};

function rewardText(reward: Reward, tr: (ru: string, en: string) => string) {
  if (reward.kind === "coins") return `+${reward.amount} SC`;
  return reward.title;
}

export default function BattlePassPage() {
  const { lang } = useI18n();
  const tr = (ru: string, en: string) => (lang === "en" ? en : ru);
  const router = useRouter();
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/battle-pass");
    const data = await res.json();
    if (res.ok && data.ok) setState(data);
    else if (res.status === 401) router.replace("/login");
  }, [router]);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) router.replace("/login");
      });
    load().finally(() => setLoading(false));
  }, [load, router]);

  async function action(payload: Record<string, unknown>, key: string) {
    setBusy(key);
    setNotice(null);
    try {
      const res = await fetch("/api/battle-pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ ok: false, text: data.error || tr("Ошибка", "Error") });
        return;
      }
      if (payload.action === "buy-premium") {
        setNotice({ ok: true, text: tr("Премиум-пропуск активирован", "Premium pass activated") });
      } else if (data.reward?.kind === "cosmetic") {
        setNotice({
          ok: true,
          text: tr(`Получено: ${data.reward.title}`, `Received: ${data.reward.title}`),
        });
      } else {
        setNotice({
          ok: true,
          text: data.reward?.duplicate
            ? tr(
                `Предмет уже был — начислено ${data.reward.amount} SC`,
                `Already owned — ${data.reward.amount} SC credited`
              )
            : tr(`Начислено +${data.reward?.amount ?? 0} SC`, `+${data.reward?.amount ?? 0} SC credited`),
        });
      }
      if (data.season) setState(data as State);
      else await load();
    } catch {
      setNotice({ ok: false, text: tr("Ошибка сервера", "Server error") });
    } finally {
      setBusy(null);
    }
  }

  const progress = state
    ? Math.min(100, ((state.xp % state.xp_per_level) / state.xp_per_level) * 100)
    : 0;

  return (
    <>
      <Header />
      <main className="relative min-h-screen text-white">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.18),transparent_55%)]" />
        <div className="max-w-6xl mx-auto px-6 pt-36 pb-24">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-white/50 hover:text-white transition text-sm mb-8"
          >
            <ArrowLeft size={16} weight="bold" /> {tr("В кабинет", "Back to dashboard")}
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-5 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Trophy size={28} weight="fill" className="text-purple-400" />
                <p className="text-white/40 text-xs tracking-widest uppercase">
                  {tr("Сезонный пропуск", "Season pass")}
                </p>
              </div>
              <h1 className="cosmic-rgb-text text-4xl md:text-5xl font-extrabold">
                {lang === "en" ? state?.season.title_en || "Battle pass" : state?.season.title_ru || "Батл-пасс"}
              </h1>
              <p className="text-white/45 mt-2 max-w-2xl">
                {tr(
                  "XP начисляется за ежедневные квесты, ежедневную награду и игру в клиенте. Уровни и награды сбрасываются в начале нового месяца.",
                  "XP is earned from daily quests, the daily reward and playtime. Levels and rewards reset at the start of a new month."
                )}
              </p>
            </div>
            <div className="rounded-2xl border border-purple-400/30 bg-purple-500/10 px-5 py-4 min-w-[180px]">
              <p className="text-[11px] uppercase tracking-widest text-purple-200/70">
                {tr("Уровень", "Level")}
              </p>
              <p className="text-3xl font-bold text-purple-200">
                {state?.level ?? 0}
                <span className="text-white/40 text-base"> / {state?.max_level ?? 20}</span>
              </p>
              <p className="text-xs text-white/40 mt-1">{state?.xp ?? 0} XP</p>
            </div>
          </div>

          {notice && (
            <div
              className={`mb-5 rounded-2xl border px-4 py-3 text-sm flex items-center gap-2 ${
                notice.ok
                  ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                  : "border-red-400/30 bg-red-500/10 text-red-200"
              }`}
            >
              {notice.ok ? <CheckCircle size={17} /> : <WarningCircle size={17} />}
              {notice.text}
            </div>
          )}

          {loading || !state ? (
            <div className="py-24 text-center text-white/40">{tr("Загрузка...", "Loading...")}</div>
          ) : (
            <>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mb-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <p className="text-sm text-white/60">
                    {tr("До следующего уровня", "To the next level")}:{" "}
                    <span className="text-white font-semibold">{state.xp_to_next} XP</span>
                  </p>
                  <div className="flex items-center gap-2">
                    {state.premium ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
                        <Crown size={14} weight="fill" /> {tr("Премиум активен", "Premium active")}
                      </span>
                    ) : (
                      <button
                        onClick={() => action({ action: "buy-premium" }, "premium")}
                        disabled={busy === "premium"}
                        className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 transition disabled:opacity-50"
                      >
                        <Crown size={14} weight="fill" />
                        {busy === "premium"
                          ? tr("Покупаем...", "Buying...")
                          : tr(`Купить премиум · ${state.premium_price} SC`, `Buy premium · ${state.premium_price} SC`)}
                      </button>
                    )}
                  </div>
                </div>
                <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-cyan-400 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-white/35">
                  {tr(
                    `Сезон до ${new Date(state.season.ends_at).toLocaleDateString("ru-RU")}`,
                    `Season ends ${new Date(state.season.ends_at).toLocaleDateString("en-GB")}`
                  )}
                </p>
              </div>

              <div className="space-y-3">
                {state.levels.map((level) => {
                  const canFree = level.unlocked && !level.free_claimed;
                  const canPremium = level.unlocked && state.premium && !level.premium_claimed;
                  return (
                    <div
                      key={level.level}
                      className={`rounded-2xl border p-4 flex flex-col md:flex-row md:items-center gap-4 ${
                        level.unlocked
                          ? "border-white/10 bg-white/[0.03]"
                          : "border-white/[0.06] bg-white/[0.015] opacity-70"
                      }`}
                    >
                      <div className="flex items-center gap-3 md:w-40 shrink-0">
                        <div
                          className={`h-11 w-11 rounded-xl flex items-center justify-center font-bold ${
                            level.level === state.level
                              ? "bg-purple-500/30 text-purple-100 border border-purple-400/50"
                              : "bg-white/5 text-white/60 border border-white/10"
                          }`}
                        >
                          {level.unlocked ? level.level : <Lock size={16} />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{tr("Уровень", "Level")} {level.level}</p>
                          <p className="text-[11px] text-white/35">{level.xp} XP</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                        {(
                          [
                            { track: "free", reward: level.free, claimed: level.free_claimed, enabled: canFree },
                            {
                              track: "premium",
                              reward: level.premium,
                              claimed: level.premium_claimed,
                              enabled: canPremium,
                            },
                          ] as const
                        ).map((track) => (
                          <div
                            key={track.track}
                            className={`rounded-xl border px-3 py-2.5 flex items-center justify-between gap-3 ${
                              track.track === "premium"
                                ? "border-amber-400/25 bg-amber-500/[0.06]"
                                : "border-white/10 bg-white/[0.03]"
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-[10px] uppercase tracking-widest text-white/35 mb-0.5">
                                {track.track === "premium" ? tr("Премиум", "Premium") : tr("Бесплатно", "Free")}
                              </p>
                              <p className="text-sm font-medium truncate flex items-center gap-1.5">
                                {track.reward.kind === "coins" ? (
                                  <Coins size={14} className="text-amber-300" />
                                ) : (
                                  <Sparkle size={14} className="text-fuchsia-300" />
                                )}
                                {rewardText(track.reward, tr)}
                              </p>
                            </div>
                            {track.claimed ? (
                              <span className="text-[11px] text-emerald-300 inline-flex items-center gap-1">
                                <CheckCircle size={14} /> {tr("Получено", "Claimed")}
                              </span>
                            ) : track.enabled ? (
                              <button
                                onClick={() =>
                                  action(
                                    { action: "claim", level: level.level, track: track.track },
                                    `${level.level}:${track.track}`
                                  )
                                }
                                disabled={busy === `${level.level}:${track.track}`}
                                className="shrink-0 rounded-lg bg-purple-600 hover:bg-purple-500 px-3 py-1.5 text-[11px] font-semibold transition disabled:opacity-50"
                              >
                                {busy === `${level.level}:${track.track}`
                                  ? tr("...", "...")
                                  : tr("Забрать", "Claim")}
                              </button>
                            ) : (
                              <span className="text-[11px] text-white/30 inline-flex items-center gap-1">
                                {track.track === "premium" && !state.premium ? (
                                  <>
                                    <Lock size={12} /> {tr("Премиум", "Premium")}
                                  </>
                                ) : (
                                  <>
                                    <Lock size={12} /> {tr("Закрыто", "Locked")}
                                  </>
                                )}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-xs text-white/45 flex items-start gap-2">
                <Gift size={16} className="text-purple-300 shrink-0 mt-0.5" />
                <p>
                  {tr(
                    "Если премиум-награда уже есть в инвентаре, вместо неё начислим SC-компенсацию. Ежедневные квесты дают +20 XP, ежедневная награда +30 XP, каждый заработанный за игру SC — +1 XP.",
                    "If a premium reward is already in your inventory, you receive SC compensation instead. Daily quests give +20 XP, the daily reward +30 XP, and every SC earned from playtime +1 XP."
                  )}
                </p>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
