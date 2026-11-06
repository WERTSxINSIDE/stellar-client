"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, CircleNotch, Coins, Clock } from "@phosphor-icons/react";
import { useI18n } from "@/lib/i18n";

type Quest = {
  key: string;
  title_ru: string;
  title_en: string;
  desc_ru: string;
  desc_en: string;
  icon: string;
  reward: number;
  target: number;
  unit: "count" | "seconds";
  progress: number;
  claimed: boolean;
  claimable: boolean;
  requires_clan: boolean;
};

type QuestData = {
  quests: Quest[];
  claimed_reward: number;
  claimable_reward: number;
  resets_at: string;
};

function formatProgress(quest: Quest, value: number, lang: "ru" | "en") {
  if (quest.unit === "seconds") {
    const minutes = Math.floor(value / 60);
    const target = Math.floor(quest.target / 60);
    return `${minutes}/${target} ${lang === "en" ? "min" : "мин"}`;
  }
  return `${Math.min(value, quest.target)}/${quest.target}`;
}

export default function DailyQuests({ onBalance }: { onBalance?: (balance: number) => void }) {
  const { lang } = useI18n();
  const tr = (ru: string, en: string) => (lang === "en" ? en : ru);
  const [data, setData] = useState<QuestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/quests", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || tr("Не удалось загрузить квесты", "Failed to load quests"));
        return;
      }
      setData(json);
      setError("");
    } catch {
      setError(tr("Ошибка сервера", "Server error"));
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    load();
  }, [load]);

  async function claim(quest: Quest) {
    if (busy || !quest.claimable) return;
    setBusy(quest.key);
    setNotice("");
    setError("");
    try {
      const res = await fetch("/api/quests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: quest.key }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || tr("Не удалось получить награду", "Could not claim the reward"));
        await load();
        return;
      }
      setData({
        quests: json.quests,
        claimed_reward: json.claimed_reward,
        claimable_reward: json.claimable_reward,
        resets_at: json.resets_at,
      });
      if (typeof json.balance === "number") onBalance?.(json.balance);
      setNotice(
        tr(`Получено +${json.reward} SC`, `Claimed +${json.reward} SC`)
      );
    } catch {
      setError(tr("Ошибка сервера", "Server error"));
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-white/40">
        <CircleNotch size={20} className="animate-spin mx-auto mb-3" />
        {tr("Загрузка квестов...", "Loading quests...")}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        {error || tr("Квесты недоступны", "Quests are unavailable")}
      </div>
    );
  }

  const done = data.quests.filter((quest) => quest.claimed).length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h3 className="text-2xl font-bold">{tr("Ежедневные квесты", "Daily quests")}</h3>
          <p className="text-sm text-white/40">
            {tr(
              "Награда — только SC. Квесты обновляются каждый день.",
              "Rewards are SC only. Quests reset every day."
            )}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.07] px-4 py-2 text-right">
          <p className="text-[10px] uppercase tracking-widest text-emerald-300/70">
            {tr("Можно получить", "Available now")}
          </p>
          <p className="text-lg font-bold text-emerald-300">+{data.claimable_reward} SC</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4 text-xs text-white/40">
        <span className="inline-flex items-center gap-1.5">
          <Coins size={14} className="text-purple-300" />
          {tr("Выполнено", "Completed")}: {done}/{data.quests.length}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock size={14} />
          {tr("Сброс", "Reset")}:{" "}
          {new Date(data.resets_at).toLocaleString(lang === "en" ? "en-GB" : "ru-RU", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {notice && (
        <div className="mb-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {notice}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {data.quests.map((quest) => {
          const percent = Math.min(
            100,
            Math.round((Math.min(quest.progress, quest.target) / quest.target) * 100)
          );
          return (
            <div
              key={quest.key}
              className={`rounded-2xl border p-4 transition ${
                quest.claimed
                  ? "border-emerald-400/20 bg-emerald-500/[0.05]"
                  : quest.claimable
                  ? "border-purple-400/35 bg-purple-500/[0.08]"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 shrink-0 rounded-xl bg-white/[0.06] grid place-items-center text-xl">
                  {quest.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{lang === "en" ? quest.title_en : quest.title_ru}</p>
                    <span className="rounded-full border border-purple-400/25 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-200">
                      +{quest.reward} SC
                    </span>
                    {quest.claimed && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        <Check size={10} weight="bold" />
                        {tr("получено", "claimed")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/40 mt-0.5">
                    {lang === "en" ? quest.desc_en : quest.desc_ru}
                  </p>

                  <div className="mt-2.5 flex items-center gap-3">
                    <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          quest.claimed
                            ? "bg-emerald-400"
                            : quest.claimable
                            ? "bg-purple-400"
                            : "bg-white/30"
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[11px] tabular-nums text-white/45">
                      {formatProgress(quest, quest.progress, lang)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => claim(quest)}
                  disabled={!quest.claimable || !!busy}
                  className={`shrink-0 self-center rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                    quest.claimed
                      ? "bg-emerald-500/15 text-emerald-300 cursor-default"
                      : quest.claimable
                      ? "bg-purple-600 text-white hover:bg-purple-700"
                      : "bg-white/[0.05] text-white/30 cursor-not-allowed"
                  }`}
                >
                  {busy === quest.key ? (
                    <CircleNotch size={16} className="animate-spin" />
                  ) : quest.claimed ? (
                    tr("Готово", "Done")
                  ) : quest.claimable ? (
                    tr("Забрать", "Claim")
                  ) : (
                    tr("В процессе", "In progress")
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
