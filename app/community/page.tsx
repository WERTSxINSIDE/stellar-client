"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowSquareOut,
  ChatCircleText,
  CheckCircle,
  Clock,
  Coins,
  DownloadSimple,
  Eye,
  FunnelSimple,
  Gift,
  Heart,
  Key,
  MagnifyingGlass,
  Plus,
  Pulse,
  RocketLaunch,
  Sparkle,
  StackSimple,
  Star,
  Tag,
  Trophy,
  UsersThree,
  VideoCamera,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import GridBackground from "@/components/GridBackground";
import { useI18n } from "@/lib/i18n";

type FeedEvent = {
  id: number;
  type: string;
  title: string;
  details: string | null;
  created_at: string;
  username: string | null;
  avatar_url: string | null;
};

type ShowcaseItem = {
  id: number;
  user_id: number;
  type: "config" | "video";
  title: string;
  description: string | null;
  url: string | null;
  file_name: string | null;
  price: number;
  tags: string[];
  views: number | null;
  created_at: string;
  username: string;
  avatar_url: string | null;
  avg_rating: number;
  ratings: number;
  my_rating: number | null;
  is_owner: boolean;
  purchased: boolean;
  sales: number;
  game: string | null;
  version: string | null;
  discount_percent: number;
  discount_until: string | null;
  discount_active: boolean;
  final_price: number;
  is_favorite: boolean;
};

type Bundle = {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  discount_percent: number;
  status: string;
  created_at: string;
  username: string;
  avatar_url: string | null;
  items_count: number;
  base_price: number;
  final_price: number;
  purchased: boolean;
  is_owner: boolean;
  items: {
    id: number;
    title: string;
    price: number;
    final_price: number;
    owned: boolean;
  }[];
};

type Tab = "live" | "config" | "video";

const MAX_FILE_BYTES = 1_500_000;
const MAX_PRICE = 10_000;
const MIN_PAID_PRICE = 10;
const ALLOWED_EXT = [".cfg", ".txt", ".json", ".ini", ".toml", ".yml", ".yaml", ".zip"];

function parseDate(value: string) {
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function timeAgo(value: string, lang: "ru" | "en") {
  const seconds = Math.max(1, Math.floor((Date.now() - parseDate(value).getTime()) / 1000));
  if (seconds < 60) return lang === "ru" ? "только что" : "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return lang === "ru" ? `${minutes} мин назад` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return lang === "ru" ? `${hours} ч назад` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return lang === "ru" ? `${days} дн. назад` : `${days}d ago`;
}

function Stars({
  value,
  size = 18,
  onRate,
  disabled,
  title,
}: {
  value: number;
  size?: number;
  onRate?: (rating: number) => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <div className="flex items-center gap-0.5" title={title}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!onRate || disabled}
          onClick={() => onRate?.(star)}
          aria-label={`${star}/5`}
          className={`transition ${
            onRate && !disabled
              ? "cursor-pointer hover:scale-110"
              : "cursor-default"
          }`}
        >
          <Star
            size={size}
            weight={star <= Math.round(value) ? "fill" : "regular"}
            className={star <= Math.round(value) ? "text-yellow-400" : "text-white/20"}
          />
        </button>
      ))}
    </div>
  );
}

function FeedIcon({ type }: { type: string }) {
  const cls = "text-purple-300";
  if (type === "key") return <Key size={20} weight="fill" className={cls} />;
  if (type === "launch") return <RocketLaunch size={20} weight="fill" className={cls} />;
  if (type === "achievement") return <Trophy size={20} weight="fill" className={cls} />;
  if (type === "review") return <ChatCircleText size={20} weight="fill" className={cls} />;
  if (type === "showcase") return <Sparkle size={20} weight="fill" className={cls} />;
  if (type === "purchase") return <Coins size={20} weight="fill" className={cls} />;
  return <Pulse size={20} weight="fill" className={cls} />;
}

export default function CommunityPage() {
  const { t, lang } = useI18n();

  const [tab, setTab] = useState<Tab>("live");
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [online, setOnline] = useState(0);
  const [launches, setLaunches] = useState(0);
  const [feedLoading, setFeedLoading] = useState(true);
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [showcaseLoading, setShowcaseLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("new");
  const [activeTag, setActiveTag] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [userChecked, setUserChecked] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [buying, setBuying] = useState<number | null>(null);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [bundlesLoading, setBundlesLoading] = useState(false);
  const [buyingBundle, setBuyingBundle] = useState<number | null>(null);
  const [bundleCodeInput, setBundleCodeInput] = useState<Record<number, string>>({});
  const [bundleCoupons, setBundleCoupons] = useState<
    Record<number, { code: string; discount_percent: number; final_price: number }>
  >({});
  const [bundleCouponBusy, setBundleCouponBusy] = useState<number | null>(null);

  const loadFeed = useCallback(async () => {
    try {
      const res = await fetch("/api/feed", { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) return;
      setFeed(Array.isArray(data.events) ? data.events : []);
      setOnline(Number(data.online) || 0);
      setLaunches(Number(data.launches_today) || 0);
    } catch {
      // тихо игнорируем — лента обновится в следующий раз
    } finally {
      setFeedLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
    const timer = setInterval(loadFeed, 20000);
    return () => clearInterval(timer);
  }, [loadFeed]);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setLoggedIn(!!d.user))
      .catch(() => {})
      .finally(() => setUserChecked(true));
  }, []);

  const loadShowcase = useCallback(async (type: "config" | "video") => {
    setShowcaseLoading(true);
    try {
      const params = new URLSearchParams({ type });
      if (search.trim()) params.set("q", search.trim());
      if (sort !== "new") params.set("sort", sort);
      if (activeTag) params.set("tag", activeTag);
      if (favoritesOnly) params.set("favorites", "1");
      if (minPrice.trim()) params.set("min_price", minPrice.trim());
      if (maxPrice.trim()) params.set("max_price", maxPrice.trim());

      const res = await fetch(`/api/showcase?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (data.ok) {
        setItems(Array.isArray(data.items) ? data.items : []);
        if (Array.isArray(data.tags)) setAllTags(data.tags);
      }
    } catch {
      // оставляем прошлый список
    } finally {
      setShowcaseLoading(false);
    }
  }, [search, sort, activeTag, favoritesOnly, minPrice, maxPrice]);

  const loadBundles = useCallback(async () => {
    setBundlesLoading(true);
    try {
      const res = await fetch("/api/showcase/bundles", { cache: "no-store" });
      const data = await res.json();
      if (data.ok) setBundles(Array.isArray(data.bundles) ? data.bundles : []);
    } catch {
      // тихо игнорируем
    } finally {
      setBundlesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab !== "config" && tab !== "video") return;
    const timer = setTimeout(() => loadShowcase(tab), search.trim() ? 300 : 0);
    return () => clearTimeout(timer);
  }, [tab, loadShowcase, search]);

  useEffect(() => {
    if (tab !== "config") return;
    loadBundles();
  }, [tab, loadBundles]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function buy(item: ShowcaseItem) {
    if (!loggedIn) {
      setToast({ ok: false, text: t("community.loginToBuy") });
      return;
    }
    setBuying(item.id);
    try {
      const res = await fetch(`/api/showcase/${item.id}/buy`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setToast({
          ok: false,
          text:
            res.status === 401
              ? t("community.loginToBuy")
              : data.error || t("community.buyError"),
        });
        return;
      }
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? { ...row, purchased: true, sales: Number(row.sales || 0) + 1 }
            : row
        )
      );
      setToast({
        ok: true,
        text: t("community.bought", { price: data.price ?? item.final_price ?? item.price }),
      });
    } catch {
      setToast({ ok: false, text: t("common.serverError") });
    } finally {
      setBuying(null);
    }
  }

  async function toggleFavorite(item: ShowcaseItem) {
    if (!loggedIn) {
      setToast({ ok: false, text: t("community.loginToBuy") });
      return;
    }
    try {
      const res = await fetch(`/api/showcase/${item.id}/favorite`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setToast({ ok: false, text: data.error || t("common.serverError") });
        return;
      }
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id ? { ...row, is_favorite: !!data.is_favorite } : row
        )
      );
      setToast({
        ok: true,
        text: data.is_favorite
          ? t("community.favoriteAdd")
          : t("community.favoriteRemove"),
      });
    } catch {
      setToast({ ok: false, text: t("common.serverError") });
    }
  }

  async function buyBundle(bundle: Bundle) {
    if (!loggedIn) {
      setToast({ ok: false, text: t("community.loginToBuy") });
      return;
    }
    setBuyingBundle(bundle.id);
    try {
      const coupon = bundleCoupons[bundle.id];
      const res = await fetch(`/api/showcase/bundles/${bundle.id}/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(coupon ? { code: coupon.code } : {}),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ ok: false, text: data.error || t("community.buyError") });
        return;
      }
      setToast({
        ok: true,
        text: t("community.bundle.bought", { price: data.price ?? bundle.final_price }),
      });
      await Promise.all([loadBundles(), loadShowcase(tab === "video" ? "video" : "config")]);
    } catch {
      setToast({ ok: false, text: t("common.serverError") });
    } finally {
      setBuyingBundle(null);
    }
  }

  async function applyBundleCoupon(bundle: Bundle) {
    const code = (bundleCodeInput[bundle.id] || "").trim().toUpperCase();
    if (!code) {
      setBundleCoupons((prev) => {
        const next = { ...prev };
        delete next[bundle.id];
        return next;
      });
      return;
    }
    setBundleCouponBusy(bundle.id);
    try {
      const params = new URLSearchParams({
        code,
        bundle: String(bundle.id),
        amount: String(Math.round(bundle.final_price)),
      });
      const res = await fetch(`/api/discount-codes/validate?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setBundleCoupons((prev) => {
          const next = { ...prev };
          delete next[bundle.id];
          return next;
        });
        setToast({ ok: false, text: data.error || t("community.buyError") });
        return;
      }
      setBundleCoupons((prev) => ({
        ...prev,
        [bundle.id]: {
          code: data.code.code,
          discount_percent: Number(data.code.discount_percent) || 0,
          final_price: Number(data.final_price) || bundle.final_price,
        },
      }));
      setToast({ ok: true, text: data.message || t("community.bundle.bought", { price: data.final_price }) });
    } catch {
      setToast({ ok: false, text: t("common.serverError") });
    } finally {
      setBundleCouponBusy(null);
    }
  }

  function eventDetails(event: FeedEvent) {
    if (event.type === "achievement") {
      const title = String(event.title || "");
      const prefix = "Достижение: ";
      if (title.startsWith(prefix)) return title.slice(prefix.length);
      return title || event.details || "";
    }
    if (event.type === "key") {
      return event.details ? t("community.feed.days", { count: event.details }) : "";
    }
    if (event.type === "review" && event.details) {
      return t("community.feed.rating", { count: event.details });
    }
    return event.details || "";
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "live", label: t("community.tab.live"), icon: <Pulse size={18} weight="fill" /> },
    { id: "config", label: t("community.tab.configs"), icon: <StackSimple size={18} weight="fill" /> },
    { id: "video", label: t("community.tab.videos"), icon: <VideoCamera size={18} weight="fill" /> },
  ];

  return (
    <div className="relative min-h-screen bg-[#0a0710] text-white">
      <GridBackground />
      <Header />
      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-36 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/25 bg-purple-500/10 px-4 py-1.5 text-xs text-purple-200 mb-5">
            <UsersThree size={15} weight="fill" /> {t("community.title")}
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold mb-4">
            {t("community.title")}
          </h1>
          <p className="text-white/50 text-lg max-w-2xl mx-auto">{t("community.subtitle")}</p>
        </motion.div>

        <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
          {tabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold border transition ${
                tab === entry.id
                  ? "bg-purple-600 border-purple-500 text-white"
                  : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              {entry.icon}
              {entry.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {tab === "live" ? (
            <motion.section
              key="live"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <div className="grid sm:grid-cols-2 gap-4 mb-8">
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-5 flex items-center gap-4">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400" />
                  </span>
                  <div>
                    <p className="text-3xl font-bold leading-none">{online}</p>
                    <p className="text-white/45 text-sm mt-1">{t("community.online")}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-purple-400/20 bg-purple-500/[0.06] p-5 flex items-center gap-4">
                  <RocketLaunch size={28} weight="fill" className="text-purple-300" />
                  <div>
                    <p className="text-3xl font-bold leading-none">{launches}</p>
                    <p className="text-white/45 text-sm mt-1">{t("community.launchesToday")}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-2xl font-bold">{t("community.liveTitle")}</h2>
                    <p className="text-white/45 text-sm mt-1">{t("community.liveSubtitle")}</p>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-emerald-300/80 rounded-full bg-emerald-500/10 border border-emerald-400/20 px-3 py-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE
                  </span>
                </div>

                {feedLoading ? (
                  <p className="text-white/35 text-center py-12">{t("common.loading")}</p>
                ) : feed.length === 0 ? (
                  <p className="text-white/35 text-center py-12">{t("community.liveEmpty")}</p>
                ) : (
                  <div className="flex flex-col divide-y divide-white/[0.06]">
                    {feed.map((event) => (
                      <div key={event.id} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
                        <div className="mt-0.5 h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-400/20 grid place-items-center shrink-0">
                          <FeedIcon type={event.type} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-white/85 leading-relaxed">
                            {event.username ? (
                              <Link
                                href={`/u/${encodeURIComponent(event.username)}`}
                                className="font-semibold text-white hover:text-purple-300 transition"
                              >
                                {event.username}
                              </Link>
                            ) : (
                              <span className="font-semibold text-white">
                                {t("community.feed.system")}
                              </span>
                            )}{" "}
                            <span className="text-white/60">
                              {t(`community.feed.${event.type}`)}
                            </span>
                          </p>
                          {eventDetails(event) && (
                            <p className="text-xs text-purple-200/70 mt-0.5 break-words">
                              {eventDetails(event)}
                            </p>
                          )}
                          <p className="text-[11px] text-white/30 mt-1 flex items-center gap-1">
                            <Clock size={11} /> {timeAgo(event.created_at, lang)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.section>
          ) : (
            <motion.section
              key={tab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold">{t("community.showcaseTitle")}</h2>
                  <p className="text-white/45 text-sm mt-1">{t("community.showcaseSubtitle")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!loggedIn && userChecked) {
                      setToast({ ok: false, text: t("community.loginToSubmit") });
                      return;
                    }
                    setSubmitOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2.5 text-sm font-semibold transition"
                >
                  <Plus size={17} weight="bold" /> {t("community.submit")}
                </button>
              </div>

              <p className="text-xs text-white/35 mb-6">
                {t("community.rewardHint")} {t("community.moderationNote")}
              </p>

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 md:p-5 mb-6">
                <div className="flex flex-col lg:flex-row gap-3">
                  <div className="relative flex-1">
                    <MagnifyingGlass
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
                    />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t("community.searchPlaceholder")}
                      maxLength={80}
                      className="w-full bg-black/40 pl-11 pr-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-sm"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <div className="relative">
                      <FunnelSimple
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
                      />
                      <select
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                        aria-label={t("community.sort")}
                        className="bg-black/40 pl-9 pr-8 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-sm text-white/80"
                      >
                        <option value="new">{t("community.sort.new")}</option>
                        <option value="rating">{t("community.sort.rating")}</option>
                        <option value="popular">{t("community.sort.popular")}</option>
                        <option value="price_asc">{t("community.sort.priceAsc")}</option>
                        <option value="price_desc">{t("community.sort.priceDesc")}</option>
                      </select>
                    </div>

                    <select
                      value={activeTag}
                      onChange={(e) => setActiveTag(e.target.value)}
                      aria-label={t("community.tags")}
                      className="bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-sm text-white/80 max-w-[180px]"
                    >
                      <option value="">{t("community.allTags")}</option>
                      {allTags.map((tag) => (
                        <option key={tag} value={tag}>
                          #{tag}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        if (!loggedIn) {
                          setToast({ ok: false, text: t("community.loginToBuy") });
                          return;
                        }
                        setFavoritesOnly((value) => !value);
                      }}
                      className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                        favoritesOnly
                          ? "border-rose-400/40 bg-rose-500/15 text-rose-200"
                          : "border-white/10 bg-black/40 text-white/60 hover:text-white"
                      }`}
                    >
                      <Heart size={15} weight={favoritesOnly ? "fill" : "regular"} />
                      {t("community.favoritesOnly")}
                    </button>

                    {tab === "config" && (
                      <>
                        <input
                          type="number"
                          min={0}
                          value={minPrice}
                          onChange={(e) => setMinPrice(e.target.value)}
                          placeholder={t("community.priceFrom")}
                          className="w-24 bg-black/40 px-3 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-sm"
                        />
                        <input
                          type="number"
                          min={0}
                          value={maxPrice}
                          onChange={(e) => setMaxPrice(e.target.value)}
                          placeholder={t("community.priceTo")}
                          className="w-24 bg-black/40 px-3 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-sm"
                        />
                      </>
                    )}

                    {(search ||
                      activeTag ||
                      favoritesOnly ||
                      minPrice ||
                      maxPrice ||
                      sort !== "new") && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("");
                          setActiveTag("");
                          setFavoritesOnly(false);
                          setMinPrice("");
                          setMaxPrice("");
                          setSort("new");
                        }}
                        className="px-3 py-3 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 transition"
                      >
                        {t("community.resetFilters")}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {showcaseLoading ? (
                <p className="text-white/35 text-center py-16">{t("community.showcaseLoading")}</p>
              ) : items.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center text-white/40">
                  {t("community.showcaseEmpty")}
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-5">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 flex flex-col gap-3 hover:border-purple-400/30 transition"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="shrink-0 rounded-lg bg-purple-500/15 border border-purple-400/20 p-1.5 text-purple-300">
                            {item.type === "config" ? (
                              <StackSimple size={17} weight="fill" />
                            ) : (
                              <VideoCamera size={17} weight="fill" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <Link
                              href={`/community/${item.type}/${item.id}`}
                              className="font-bold text-white hover:text-purple-300 transition line-clamp-1"
                            >
                              {item.title}
                            </Link>
                            <p className="text-[11px] text-white/35 flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span>
                                {t("community.by")}{" "}
                                <Link
                                  href={`/u/${encodeURIComponent(item.username)}`}
                                  className="text-white/55 hover:text-purple-300 transition"
                                >
                                  {item.username}
                                </Link>
                              </span>
                              {item.type === "config" && (
                                <span
                                  className={`rounded-md border px-1.5 py-0.5 font-semibold ${
                                    item.final_price > 0
                                      ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
                                      : "border-white/10 bg-white/5 text-white/45"
                                  }`}
                                >
                                  {item.final_price > 0 ? (
                                    <span className="inline-flex items-center gap-1">
                                      {item.discount_active &&
                                        item.final_price < item.price && (
                                          <span className="text-white/35 line-through">
                                            {item.price} ₽
                                          </span>
                                        )}
                                      {item.final_price} ₽
                                    </span>
                                  ) : (
                                    t("community.free")
                                  )}
                                </span>
                              )}
                              {item.discount_active && item.discount_percent > 0 && (
                                <span className="rounded-md border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 font-semibold text-amber-200">
                                  {t("community.discount", {
                                    percent: item.discount_percent,
                                  })}
                                </span>
                              )}
                              {item.is_owner && (
                                <span className="rounded-md border border-purple-400/25 bg-purple-500/10 px-1.5 py-0.5 text-purple-200">
                                  {t("community.yourItem")}
                                </span>
                              )}
                              {item.purchased && !item.is_owner && (
                                <span className="rounded-md border border-emerald-400/25 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300">
                                  {t("community.purchased")}
                                </span>
                              )}
                            </p>
                            {(item.game || item.version) && (
                              <p className="text-[11px] text-white/40 flex flex-wrap items-center gap-2 mt-1">
                                {item.game && (
                                  <span className="inline-flex items-center gap-1 rounded-md border border-purple-400/20 bg-purple-500/10 px-1.5 py-0.5 text-purple-200">
                                    <Gift size={10} /> {t(`community.game.${item.game}`)}
                                  </span>
                                )}
                                {item.version && (
                                  <span className="inline-flex items-center gap-1">
                                    <Tag size={10} /> {t("community.version", { version: item.version })}
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Stars
                            value={item.avg_rating}
                            size={15}
                            title={t("community.ratingOnPage")}
                          />
                          <button
                            type="button"
                            onClick={() => toggleFavorite(item)}
                            aria-label={
                              item.is_favorite
                                ? t("community.favoriteRemove")
                                : t("community.favoriteAdd")
                            }
                            className={`rounded-lg border p-1.5 transition ${
                              item.is_favorite
                                ? "border-rose-400/40 bg-rose-500/15 text-rose-300"
                                : "border-white/10 bg-white/5 text-white/40 hover:text-rose-200"
                            }`}
                          >
                            <Heart
                              size={15}
                              weight={item.is_favorite ? "fill" : "regular"}
                            />
                          </button>
                        </div>
                      </div>

                      {item.description && (
                        <p className="text-sm text-white/55 leading-relaxed whitespace-pre-line line-clamp-4">
                          {item.description}
                        </p>
                      )}

                      {Array.isArray(item.tags) && item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {item.tags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => setActiveTag(tag)}
                              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/45 hover:text-purple-200 hover:border-purple-400/30 transition"
                            >
                              <Tag size={10} /> {tag}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/35">
                        <span>
                          {item.ratings > 0
                            ? t("community.ratings", { count: item.ratings })
                            : t("community.noRatings")}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Eye size={12} /> {t("community.views", { count: item.views || 0 })}
                        </span>
                        {item.type === "config" && (
                          <span className="inline-flex items-center gap-1">
                            <Coins size={12} /> {t("community.sales", { count: item.sales || 0 })}
                          </span>
                        )}
                        {item.my_rating ? (
                          <span className="text-yellow-300/80">★ {item.my_rating}/5</span>
                        ) : null}
                      </div>

                      <div className="mt-auto pt-2 flex flex-wrap items-center gap-3">
                        <Link
                          href={`/community/${item.type}/${item.id}`}
                          className="inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2 text-sm font-semibold transition"
                        >
                          <ArrowSquareOut size={16} /> {t("community.openItem")}
                        </Link>
                        {item.type === "video" ? (
                          <a
                            href={`/api/showcase/${item.id}/download`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl bg-white/8 hover:bg-white/15 border border-white/10 px-4 py-2 text-sm font-semibold transition"
                          >
                            <ArrowSquareOut size={16} /> {t("community.watch")}
                          </a>
                        ) : item.final_price > 0 && !item.purchased && !item.is_owner ? (
                          <button
                            type="button"
                            onClick={() => buy(item)}
                            disabled={buying === item.id}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-4 py-2 text-sm font-semibold transition"
                          >
                            <Coins size={16} />
                            {buying === item.id
                              ? t("community.buying")
                              : t("community.buyFor", { price: item.final_price })}
                          </button>
                        ) : (
                          <a
                            href={`/api/showcase/${item.id}/download`}
                            className="inline-flex items-center gap-2 rounded-xl bg-white/8 hover:bg-white/15 border border-white/10 px-4 py-2 text-sm font-semibold transition"
                          >
                            <DownloadSimple size={16} /> {t("community.download")}
                          </a>
                        )}
                        {item.type === "config" && item.file_name && (
                          <span className="text-[11px] text-white/25 truncate">
                            {item.file_name}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === "config" && (
                <div className="mt-10">
                  <div className="flex items-center gap-2 mb-2">
                    <Gift size={22} className="text-purple-300" />
                    <h2 className="text-2xl font-bold">{t("community.bundlesTitle")}</h2>
                  </div>
                  <p className="text-white/45 text-sm mb-5">
                    {t("community.bundlesSubtitle")}
                  </p>

                  {bundlesLoading ? (
                    <p className="text-white/35 text-center py-8">{t("common.loading")}</p>
                  ) : bundles.length === 0 ? (
                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center text-white/40">
                      {t("community.bundle.empty")}
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-5">
                      {bundles.map((bundle) => (
                        <div
                          key={bundle.id}
                          className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 flex flex-col gap-3 hover:border-purple-400/30 transition"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-bold text-white line-clamp-1">{bundle.title}</p>
                              <p className="text-[11px] text-white/35">
                                {t("community.by")} {bundle.username} ·{" "}
                                {t("community.bundle.items", { count: bundle.items_count })}
                              </p>
                            </div>
                            <span className="shrink-0 rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                              {t("community.discount", { percent: bundle.discount_percent })}
                            </span>
                          </div>

                          {bundle.description && (
                            <p className="text-sm text-white/55 leading-relaxed whitespace-pre-line line-clamp-3">
                              {bundle.description}
                            </p>
                          )}

                          <ul className="text-[11px] text-white/45 flex flex-col gap-1">
                            {bundle.items.slice(0, 5).map((entry) => (
                              <li key={entry.id} className="flex items-center justify-between gap-2">
                                <span className="truncate">{entry.title}</span>
                                <span className={entry.owned ? "text-emerald-300/80" : ""}>
                                  {entry.owned
                                    ? t("community.purchased")
                                    : `${entry.final_price} ₽`}
                                </span>
                              </li>
                            ))}
                            {bundle.items.length > 5 && (
                              <li className="text-white/30">+{bundle.items.length - 5}</li>
                            )}
                          </ul>

                          <div className="mt-auto pt-2 flex flex-wrap items-center gap-3">
                            {bundle.purchased ? (
                              <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300">
                                <CheckCircle size={16} /> {t("community.bundle.owned")}
                              </span>
                            ) : bundle.is_owner ? (
                              <span className="text-xs text-white/35">
                                {t("community.yourItem")}
                              </span>
                            ) : (
                              <>
                                <div className="w-full flex gap-2">
                                  <input
                                    value={bundleCodeInput[bundle.id] || ""}
                                    onChange={(e) =>
                                      setBundleCodeInput((prev) => ({
                                        ...prev,
                                        [bundle.id]: e.target.value.toUpperCase(),
                                      }))
                                    }
                                    maxLength={24}
                                    placeholder={lang === "en" ? "Promo code" : "Промокод"}
                                    className="min-w-0 flex-1 bg-black/40 px-3 py-2 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-xs font-mono tracking-wide"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => applyBundleCoupon(bundle)}
                                    disabled={bundleCouponBusy === bundle.id}
                                    className="shrink-0 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-40 px-3 py-2 text-xs font-semibold transition"
                                  >
                                    {bundleCouponBusy === bundle.id ? "…" : lang === "en" ? "Apply" : "Применить"}
                                  </button>
                                </div>
                                {bundleCoupons[bundle.id] && (
                                  <span className="text-[11px] text-emerald-300">
                                    {bundleCoupons[bundle.id].code} · −
                                    {bundleCoupons[bundle.id].discount_percent}% ·{" "}
                                    {bundleCoupons[bundle.id].final_price} ₽
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => buyBundle(bundle)}
                                  disabled={buyingBundle === bundle.id}
                                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-4 py-2 text-sm font-semibold transition"
                                >
                                  <Coins size={16} />
                                  {buyingBundle === bundle.id
                                    ? t("community.bundle.buying")
                                    : t("community.bundle.buy", {
                                        price:
                                          bundleCoupons[bundle.id]?.final_price ?? bundle.final_price,
                                      })}
                                </button>
                                {bundle.base_price > bundle.final_price && (
                                  <span className="text-[11px] text-emerald-300/80">
                                    {t("community.bundle.savings", {
                                      amount: bundle.base_price - bundle.final_price,
                                    })}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] max-w-[92vw] rounded-2xl border px-5 py-3 text-sm shadow-2xl ${
              toast.ok
                ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
                : "border-red-400/30 bg-red-500/15 text-red-100"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              {toast.ok ? <CheckCircle size={17} /> : <WarningCircle size={17} />}
              {toast.text}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {submitOpen && (
          <SubmitModal
            defaultType={tab === "video" ? "video" : "config"}
            onClose={() => setSubmitOpen(false)}
            onSent={(message) => {
              setToast({ ok: true, text: message });
              setSubmitOpen(false);
            }}
            onError={(message) => setToast({ ok: false, text: message })}
          />
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}

function SubmitModal({
  defaultType,
  onClose,
  onSent,
  onError,
}: {
  defaultType: "config" | "video";
  onClose: () => void;
  onSent: (message: string) => void;
  onError: (message: string) => void;
}) {
  const { t } = useI18n();
  const [type, setType] = useState<"config" | "video">(defaultType);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [version, setVersion] = useState("1.0");
  const [price, setPrice] = useState("0");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState("");
  const [fileName, setFileName] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function pickFile(selected: File | null) {
    setError("");
    setFile(selected);
    setFileData("");
    setFileName("");
    if (!selected) return;

    const lower = selected.name.toLowerCase();
    if (!ALLOWED_EXT.some((ext) => lower.endsWith(ext))) {
      setError(t("community.invalidFile"));
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      setError(t("community.fileTooLarge"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      setFileData(result.includes(",") ? result.split(",").pop() || "" : result);
      setFileName(selected.name);
    };
    reader.onerror = () => setError(t("community.invalidFile"));
    reader.readAsDataURL(selected);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (title.trim().length < 3) {
      setError(t("community.fillRequired"));
      return;
    }
    if (type === "video" && !/^https?:\/\/.+/i.test(url.trim())) {
      setError(t("community.invalidUrl"));
      return;
    }
    if (type === "config" && (!fileData || !fileName)) {
      setError(t("community.fillRequired"));
      return;
    }
    if (type === "config") {
      const numeric = Number(price);
      if (
        !Number.isInteger(numeric) ||
        numeric < 0 ||
        numeric > MAX_PRICE ||
        (numeric > 0 && numeric < MIN_PAID_PRICE)
      ) {
        setError(t("community.invalidPrice"));
        return;
      }
    }

    setSending(true);
    try {
      const res = await fetch("/api/showcase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim(),
          description: description.trim(),
          tags: tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
            .slice(0, 5),
          url: type === "video" ? url.trim() : undefined,
          price: type === "config" ? Number(price || 0) : 0,
          game: type === "config" ? "minecraft" : undefined,
          version: type === "config" ? version.trim() || "1.0" : undefined,
          file_name: type === "config" ? fileName : undefined,
          file_data: type === "config" ? fileData : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setError(t("community.loginToSubmit"));
        } else {
          setError(data.error || t("community.submitError"));
        }
        return;
      }
      onSent(t("community.sent"));
    } catch {
      onError(t("common.serverError"));
    } finally {
      setSending(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-xl px-4 py-8"
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-[#141018] p-6 md:p-8 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold">{t("community.submitTitle")}</h2>
            <p className="text-xs text-white/40 mt-1">{t("community.moderationNote")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="rounded-xl p-2 bg-white/5 hover:bg-white/10 border border-white/10 transition"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wide text-white/40 mb-2">
              {t("community.type")}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["config", "video"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setType(value);
                    setError("");
                  }}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                    type === value
                      ? "bg-purple-600 border-purple-500 text-white"
                      : "bg-white/5 border-white/10 text-white/55 hover:text-white"
                  }`}
                >
                  {value === "config" ? <StackSimple size={16} /> : <VideoCamera size={16} />}
                  {t(`community.type.${value}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wide text-white/40 mb-2">
              {t("community.field.title")}
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder={t("community.field.titlePlaceholder")}
              className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wide text-white/40 mb-2">
              {t("community.field.description")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder={t("community.field.descriptionPlaceholder")}
              className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wide text-white/40 mb-2">
              {t("community.field.tags")}
            </label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              maxLength={200}
              placeholder={t("community.field.tagsPlaceholder")}
              className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
            />
            <p className="text-[11px] text-white/30 mt-1">{t("community.field.tagsHint")}</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {type === "config" && (
              <div>
                <label className="block text-xs uppercase tracking-wide text-white/40 mb-2">
                  {t("community.field.version")}
                </label>
                <input
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  maxLength={24}
                  placeholder="1.0"
                  className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
                />
                <p className="text-[11px] text-white/30 mt-1">
                  {t("community.field.versionHint")}
                </p>
              </div>
            )}
          </div>

          {type === "video" ? (
            <div>
              <label className="block text-xs uppercase tracking-wide text-white/40 mb-2">
                {t("community.field.url")}
              </label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t("community.field.urlPlaceholder")}
                className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs uppercase tracking-wide text-white/40 mb-2">
                {t("community.field.file")}
              </label>
              <input
                ref={inputRef}
                type="file"
                accept={ALLOWED_EXT.join(",")}
                onChange={(e) => pickFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="w-full rounded-xl border border-dashed border-white/20 bg-white/[0.03] hover:border-purple-400/40 hover:bg-purple-500/[0.06] px-4 py-5 text-sm text-white/60 transition text-left"
              >
                <span className="font-semibold text-white/80">
                  {file ? fileName || file.name : t("community.chooseFile")}
                </span>
                <span className="block text-[11px] text-white/35 mt-1">
                  {t("community.fileHint")}
                </span>
              </button>
            </div>
          )}

          {type === "config" && (
            <div>
              <label className="block text-xs uppercase tracking-wide text-white/40 mb-2">
                {t("community.field.price")}
              </label>
              <input
                type="number"
                min={0}
                max={MAX_PRICE}
                step={1}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
              />
              <p className="text-[11px] text-white/35 mt-2">
                {t("community.priceHint", {
                  min: MIN_PAID_PRICE,
                  max: MAX_PRICE,
                })}
              </p>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-300 flex items-center gap-2">
              <WarningCircle size={16} /> {error}
            </p>
          )}

          <button
            type="submit"
            disabled={sending}
            className="mt-1 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-60 px-5 py-3 font-semibold transition"
          >
            {sending ? t("community.sending") : t("community.send")}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
