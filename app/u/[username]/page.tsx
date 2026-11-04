"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useI18n, type Lang } from "@/lib/i18n";
import { achievementEn } from "@/lib/achievements";
import {
  ArrowLeft,
  Copy,
  Check,
  Trophy,
  Clock,
  RocketLaunch,
  Star,
  ShieldCheck,
  Handshake,
  CircleNotch,
  UserCircle,
} from "@phosphor-icons/react";

type ProfileAchievement = {
  key: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  unlocked_at: string | null;
};

type Profile = {
  username: string;
  avatar_url: string | null;
  bio: string | null;
  banner_url: string | null;
  accent_color: string | null;
  created_at: string | null;
  days_in_club: number;
  subscription_active: boolean;
  is_admin: boolean;
  is_partner: boolean;
  stats: {
    seconds: number;
    launches: number;
    achievements_unlocked: number;
    achievements_total: number;
    reviews: number;
    review_rating: number;
  };
  achievements: ProfileAchievement[];
};

const RARITY_STYLES: Record<string, string> = {
  common: "border-white/15 bg-white/[0.04]",
  rare: "border-sky-400/30 bg-sky-500/10",
  epic: "border-purple-400/30 bg-purple-500/10",
  legendary: "border-amber-400/40 bg-amber-500/10",
};

const RARITY_ORDER: Record<string, number> = {
  legendary: 0,
  epic: 1,
  rare: 2,
  common: 3,
};

function formatPlayTime(seconds: number, lang: Lang) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return lang === "en"
      ? `${hours.toLocaleString("en-US")}h ${minutes}m`
      : `${hours.toLocaleString("ru-RU")} ч ${minutes} мин`;
  }
  if (minutes > 0) {
    return lang === "en"
      ? `${minutes.toLocaleString("en-US")}m`
      : `${minutes.toLocaleString("ru-RU")} мин`;
  }
  return lang === "en" ? `${seconds}s` : `${seconds} сек`;
}

function formatDate(value: string | null, lang: Lang) {
  if (!value) return "—";
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(lang === "en" ? "en-GB" : "ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function initial(name: string) {
  return (name.trim()[0] || "?").toUpperCase();
}

export default function PublicProfilePage() {
  const { t, lang } = useI18n();
  const params = useParams<{ username: string }>();
  const username = typeof params?.username === "string" ? decodeURIComponent(params.username) : "";

  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    setLoading(true);
    setError("");

    fetch(`/api/profile/${encodeURIComponent(username)}`)
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setError(data.error || t("profile.loadError"));
          return;
        }
        setProfile(data.profile);
      })
      .catch(() => {
        if (!cancelled) setError(t("profile.networkError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [username, t]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const achievements = profile
    ? [...profile.achievements]
        .map((a) => {
          const en = lang === "en" ? achievementEn(a.key) : null;
          return en ? { ...a, title: en.title, description: en.description } : a;
        })
        .sort(
          (a, b) =>
            (RARITY_ORDER[a.rarity] ?? 9) - (RARITY_ORDER[b.rarity] ?? 9) ||
            a.title.localeCompare(b.title, lang)
        )
    : [];

  const accent = /^#[0-9a-f]{6}$/i.test(profile?.accent_color || "")
    ? String(profile?.accent_color)
    : "#a855f7";

  return (
    <>
      <Header />
      <main className="relative min-h-screen text-white overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none bg-[radial-gradient(circle_at_20%_0%,rgba(147,51,234,0.18),transparent_55%),radial-gradient(circle_at_80%_10%,rgba(56,189,248,0.12),transparent_50%)]" />

        <section className="relative z-10 pt-32 md:pt-40 pb-24 px-6">
          <div className="w-full max-w-4xl mx-auto">
            <Link
              href="/leaderboard"
              className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition mb-8"
            >
              <ArrowLeft size={16} weight="bold" />
              {t("profile.backToTop")}
            </Link>

            {loading && (
              <div className="flex items-center justify-center py-32 text-white/40 gap-3">
                <CircleNotch size={22} className="animate-spin" />
                {t("profile.loading")}
              </div>
            )}

            {!loading && error && (
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center">
                <UserCircle size={48} className="text-white/25 mx-auto mb-4" />
                <p className="text-xl font-semibold mb-1">{t("profile.unavailable")}</p>
                <p className="text-white/40">{error}</p>
              </div>
            )}

            {!loading && !error && profile && (
              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
                {/* Шапка профиля */}
                <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl">
                  <div className="relative h-32 sm:h-44 w-full overflow-hidden">
                    {profile.banner_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profile.banner_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-full h-full"
                        style={{
                          background: `linear-gradient(135deg, ${accent}66 0%, ${accent}22 45%, rgba(10,10,10,0.9) 100%)`,
                        }}
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                  </div>

                  <div className="relative p-6 md:p-8 pt-0 -mt-12">
                    <div
                      className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-25"
                      style={{ backgroundColor: accent }}
                    />

                    <div className="relative flex flex-col sm:flex-row sm:items-end gap-5">
                      <div
                        className="w-20 h-20 rounded-2xl overflow-hidden grid place-items-center text-3xl font-black shrink-0 shadow-lg ring-2 ring-white/20"
                        style={{ background: `linear-gradient(135deg, ${accent}, #d946ef)` }}
                      >
                        {profile.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={profile.avatar_url}
                            alt={profile.username}
                            className="w-20 h-20 object-cover"
                          />
                        ) : (
                          initial(profile.username)
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h1 className="text-3xl md:text-4xl font-extrabold break-words">
                            {profile.username}
                          </h1>
                          {profile.is_admin && (
                            <span className="flex items-center gap-1 text-[11px] uppercase tracking-wider font-semibold px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30">
                              <ShieldCheck size={13} weight="fill" /> {t("profile.admin")}
                            </span>
                          )}
                          {profile.is_partner && (
                            <span className="flex items-center gap-1 text-[11px] uppercase tracking-wider font-semibold px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30">
                              <Handshake size={13} weight="fill" /> {t("profile.partner")}
                            </span>
                          )}
                          {profile.subscription_active && (
                            <span className="flex items-center gap-1 text-[11px] uppercase tracking-wider font-semibold px-2.5 py-1 rounded-full bg-green-500/15 text-green-300 border border-green-400/30">
                              <Star size={13} weight="fill" /> {t("profile.subActive")}
                            </span>
                          )}
                        </div>
                        <p className="text-white/40 text-sm mt-2">
                          {t("profile.inClubSince", { date: formatDate(profile.created_at, lang) })} ·{" "}
                          {t("profile.days", { count: profile.days_in_club })}
                        </p>
                        {profile.bio && (
                          <p className="text-white/60 text-sm mt-3 whitespace-pre-line break-words max-w-2xl">
                            {profile.bio}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={copyLink}
                        className="self-start sm:self-end flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition shrink-0"
                      >
                        {copied ? (
                          <>
                            <Check size={16} weight="bold" className="text-green-400" /> {t("profile.copied")}
                          </>
                        ) : (
                          <>
                            <Copy size={16} /> {t("profile.share")}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Статистика */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex items-center gap-2 text-white/40 text-xs mb-2">
                      <Clock size={16} /> {t("profile.inClient")}
                    </div>
                    <p className="text-xl font-bold">{formatPlayTime(profile.stats.seconds, lang)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex items-center gap-2 text-white/40 text-xs mb-2">
                      <RocketLaunch size={16} /> {t("profile.launches")}
                    </div>
                    <p className="text-xl font-bold">
                      {profile.stats.launches.toLocaleString(lang === "en" ? "en-US" : "ru-RU")}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex items-center gap-2 text-white/40 text-xs mb-2">
                      <Trophy size={16} /> {t("profile.achievements")}
                    </div>
                    <p className="text-xl font-bold">
                      {profile.stats.achievements_unlocked}
                      <span className="text-white/30 text-base">/{profile.stats.achievements_total}</span>
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex items-center gap-2 text-white/40 text-xs mb-2">
                      <Star size={16} /> {t("profile.reviews")}
                    </div>
                    {profile.stats.reviews > 0 ? (
                      <p className="text-xl font-bold flex items-center gap-1.5">
                        {profile.stats.review_rating}
                        <Star size={15} weight="fill" className="text-yellow-400" />
                        <span className="text-white/30 text-sm font-normal">
                          ({profile.stats.reviews})
                        </span>
                      </p>
                    ) : (
                      <p className="text-xl font-bold text-white/30">—</p>
                    )}
                  </div>
                </div>

                {/* Достижения */}
                <div className="mt-10">
                  <div className="flex items-end justify-between gap-4 mb-5">
                    <div>
                      <h2 className="text-2xl font-bold">{t("profile.achievements")}</h2>
                      <p className="text-white/40 text-sm">{t("profile.unlockedAwards")}</p>
                    </div>
                    <span className="text-sm text-white/40 shrink-0">
                      {t("profile.of", {
                        a: profile.stats.achievements_unlocked,
                        b: profile.stats.achievements_total,
                      })}
                    </span>
                  </div>

                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-6">
                    <div
                      className="h-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${accent}, #f0abfc)`,
                        width: `${Math.round(
                          (profile.stats.achievements_unlocked / profile.stats.achievements_total) * 100
                        )}%`,
                      }}
                    />
                  </div>

                  {achievements.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center text-white/40">
                      {t("profile.noAchievements")}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {achievements.map((a) => (
                        <div
                          key={a.key}
                          className={`rounded-2xl border p-5 ${RARITY_STYLES[a.rarity] || RARITY_STYLES.common}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-11 h-11 rounded-xl grid place-items-center text-xl bg-white/10 shrink-0">
                              {a.icon}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold leading-snug break-words">{a.title}</p>
                              <p className="text-xs text-white/40 leading-relaxed">{a.description}</p>
                            </div>
                          </div>
                          {a.unlocked_at && (
                            <p className="text-[11px] text-white/30 mt-3">
                              {t("profile.unlockedOn", {
                                date: formatDate(String(a.unlocked_at), lang),
                              })}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
