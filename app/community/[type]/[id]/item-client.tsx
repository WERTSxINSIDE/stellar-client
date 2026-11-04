"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowSquareOut,
  ChatCircleText,
  CheckCircle,
  Coins,
  DownloadSimple,
  Eye,
  Heart,
  Star,
  StackSimple,
  Tag,
  UsersThree,
  VideoCamera,
  WarningCircle,
} from "@phosphor-icons/react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import GridBackground from "@/components/GridBackground";
import { useI18n } from "@/lib/i18n";

type BaseItem = {
  id: number;
  user_id: number;
  type: "config" | "video";
  title: string;
  description: string | null;
  url: string | null;
  file_name: string | null;
  price: number;
  tags: string[] | null;
  views: number | null;
  created_at: string;
  username: string;
  avatar_url: string | null;
  game: string | null;
  version: string | null;
};

type Item = BaseItem & {
  avg_rating: number;
  ratings: number;
  my_rating: number | null;
  my_comment: string | null;
  is_owner: boolean;
  purchased: boolean;
  sales: number;
  discount_percent: number;
  discount_until: string | null;
  discount_active: boolean;
  final_price: number;
  is_favorite: boolean;
  following: boolean;
  followers: number;
};

type ItemVersion = {
  id: number;
  version: string;
  changelog: string | null;
  file_name: string | null;
  created_at: string;
};

type Review = {
  id: number;
  rating: number;
  comment: string;
  author_reply: string | null;
  reply_at: string | null;
  created_at: string;
  username: string;
  avatar_url: string | null;
};

function parseDate(value: string) {
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function fmtDate(value: string, lang: "ru" | "en") {
  return parseDate(value).toLocaleDateString(lang === "en" ? "en-US" : "ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function Stars({
  value,
  size = 18,
  onRate,
  disabled,
}: {
  value: number;
  size?: number;
  onRate?: (rating: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!onRate || disabled}
          onClick={() => onRate?.(star)}
          aria-label={`${star}/5`}
          className={onRate && !disabled ? "cursor-pointer hover:scale-110 transition" : "cursor-default"}
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

export default function ItemClient({ initialItem }: { initialItem: BaseItem }) {
  const { t, lang } = useI18n();

  const [item, setItem] = useState<Item>({
    ...initialItem,
    game: initialItem.game ?? null,
    version: initialItem.version ?? null,
    avg_rating: 0,
    ratings: 0,
    my_rating: null,
    my_comment: null,
    is_owner: false,
    purchased: false,
    sales: 0,
    discount_percent: 0,
    discount_until: null,
    discount_active: false,
    final_price: Number(initialItem.price || 0),
    is_favorite: false,
    following: false,
    followers: 0,
  });
  const [reviews, setReviews] = useState<Review[]>([]);
  const [versions, setVersions] = useState<ItemVersion[]>([]);
  const [canReview, setCanReview] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [buying, setBuying] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount_percent: number;
    final_price: number;
  } | null>(null);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const [ratingValue, setRatingValue] = useState(0);
  const [comment, setComment] = useState("");
  const [reviewSending, setReviewSending] = useState(false);

  const [replyFor, setReplyFor] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);

  const viewSent = useRef(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((ok: boolean, text: string) => {
    setNotice({ ok, text });
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/showcase/${initialItem.id}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        if (res.status !== 401) flash(false, data.error || t("common.serverError"));
        return;
      }
      if (data.item) setItem({ ...data.item, price: Number(data.item.price || 0) });
      setReviews(Array.isArray(data.reviews) ? data.reviews : []);
      setVersions(Array.isArray(data.versions) ? data.versions : []);
      setCanReview(!!data.can_review);
      setLoggedIn(
        (prev) =>
          prev ||
          !!data.can_review ||
          !!data.item?.is_owner ||
          !!data.item?.purchased
      );
      if (data.item?.my_rating) setRatingValue(Number(data.item.my_rating));
      if (data.item?.my_comment) setComment(String(data.item.my_comment));
    } catch {
      flash(false, t("common.serverError"));
    } finally {
      setLoading(false);
    }
  }, [initialItem.id, flash, t]);

  useEffect(() => {
    load();

    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setLoggedIn(!!d.user))
      .catch(() => {});

    if (!viewSent.current) {
      viewSent.current = true;
      fetch(`/api/showcase/${initialItem.id}/view`, { method: "POST" }).catch(() => {});
    }
  }, [load, initialItem.id]);

  async function applyCoupon() {
    const code = couponCode.trim().toUpperCase();
    setCouponError("");
    if (!code) {
      setAppliedCoupon(null);
      return;
    }
    setCouponBusy(true);
    try {
      const params = new URLSearchParams({
        code,
        item: String(item.id),
        amount: String(Math.round(item.final_price)),
        track: "1",
      });
      const res = await fetch(`/api/discount-codes/validate?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setAppliedCoupon(null);
        setCouponError(data.error || t("community.buyError"));
        return;
      }
      setAppliedCoupon({
        code: data.code.code,
        discount_percent: Number(data.code.discount_percent) || 0,
        final_price: Number(data.final_price) || item.final_price,
      });
      flash(true, data.message || t("community.bought", { price: data.final_price }));
    } catch {
      setAppliedCoupon(null);
      setCouponError(t("common.serverError"));
    } finally {
      setCouponBusy(false);
    }
  }

  async function buy() {
    setBuying(true);
    try {
      const res = await fetch(`/api/showcase/${item.id}/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(appliedCoupon ? { code: appliedCoupon.code } : {}),
      });
      const data = await res.json();
      if (!res.ok) {
        flash(
          false,
          res.status === 401 ? t("community.loginToBuy") : data.error || t("community.buyError")
        );
        return;
      }
      setItem((prev) => ({
        ...prev,
        purchased: true,
        sales: Number(prev.sales || 0) + 1,
      }));
      flash(true, t("community.bought", { price: data.price ?? item.final_price ?? item.price }));
      setAppliedCoupon(null);
      setCouponCode("");
      load();
    } catch {
      flash(false, t("common.serverError"));
    } finally {
      setBuying(false);
    }
  }

  async function toggleFavorite() {
    if (favoriteBusy) return;
    if (!loggedIn) {
      flash(false, t("community.loginToBuy"));
      return;
    }
    setFavoriteBusy(true);
    try {
      const res = await fetch(`/api/showcase/${item.id}/favorite`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        flash(false, data.error || t("common.serverError"));
        return;
      }
      setItem((prev) => ({ ...prev, is_favorite: !!data.is_favorite }));
    } catch {
      flash(false, t("common.serverError"));
    } finally {
      setFavoriteBusy(false);
    }
  }

  async function toggleFollow() {
    if (followBusy || item.is_owner) return;
    if (!loggedIn) {
      flash(false, t("community.loginToBuy"));
      return;
    }
    setFollowBusy(true);
    try {
      const res = await fetch(`/api/showcase/authors/${item.user_id}/follow`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        flash(false, data.error || t("common.serverError"));
        return;
      }
      setItem((prev) => ({
        ...prev,
        following: !!data.following,
        followers: Number(data.followers || 0),
      }));
    } catch {
      flash(false, t("common.serverError"));
    } finally {
      setFollowBusy(false);
    }
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (ratingValue < 1) {
      flash(false, t("community.item.chooseStars"));
      return;
    }
    setReviewSending(true);
    try {
      const res = await fetch("/api/showcase/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, rating: ratingValue, comment }),
      });
      const data = await res.json();
      if (!res.ok) {
        flash(false, data.error || t("community.ratingError"));
        return;
      }
      setItem((prev) => ({
        ...prev,
        avg_rating: Number(data.avg || 0),
        ratings: Number(data.count || 0),
        my_rating: ratingValue,
        my_comment: data.my_comment ?? comment,
      }));
      flash(true, t("community.item.reviewSaved"));
      load();
    } catch {
      flash(false, t("common.serverError"));
    } finally {
      setReviewSending(false);
    }
  }

  async function sendReply(reviewId: number) {
    const text = replyText.trim();
    if (!text) return;
    setReplySending(true);
    try {
      const res = await fetch(`/api/showcase/${item.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_id: reviewId, reply: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        flash(false, data.error || t("common.serverError"));
        return;
      }
      setReviews((prev) =>
        prev.map((review) =>
          review.id === reviewId
            ? {
                ...review,
                author_reply: data.review?.author_reply ?? text,
                reply_at: data.review?.reply_at ?? new Date().toISOString(),
              }
            : review
        )
      );
      setReplyFor(null);
      setReplyText("");
      flash(true, t("community.item.replySaved"));
    } catch {
      flash(false, t("common.serverError"));
    } finally {
      setReplySending(false);
    }
  }

  const isPaid = item.type === "config" && item.final_price > 0;
  const canDownload = item.type === "video" || !isPaid || item.purchased || item.is_owner;
  const reviewLocked = isPaid && !item.purchased && !item.is_owner;
  const hasDiscount =
    item.discount_active && item.discount_percent > 0 && item.final_price < item.price;

  return (
    <div className="relative min-h-screen bg-[#0a0710] text-white">
      <GridBackground />
      <Header />
      <main className="relative z-10 max-w-5xl mx-auto px-6 pt-36 pb-24">
        <Link
          href="/community"
          className="inline-flex items-center gap-2 text-white/50 hover:text-white transition text-sm mb-8"
        >
          <ArrowLeft size={16} weight="bold" /> {t("community.item.back")}
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-purple-500/15 border border-purple-400/20 px-2.5 py-1 text-xs text-purple-200">
              {item.type === "config" ? (
                <StackSimple size={14} weight="fill" />
              ) : (
                <VideoCamera size={14} weight="fill" />
              )}
              {t(`community.type.${item.type}`)}
            </span>
            {item.type === "config" && (
              <span
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                  item.final_price > 0
                    ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
                    : "border-white/10 bg-white/5 text-white/50"
                }`}
              >
                {item.final_price > 0 ? (
                  <span className="inline-flex items-center gap-1.5">
                    {hasDiscount && (
                      <span className="text-white/35 line-through">{item.price} ₽</span>
                    )}
                    {item.final_price} ₽
                  </span>
                ) : (
                  t("community.free")
                )}
              </span>
            )}
            {hasDiscount && (
              <span className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-200">
                {t("community.item.discountBadge", {
                  percent: item.discount_percent,
                })}
              </span>
            )}
            {item.game && (
              <span className="rounded-lg border border-purple-400/20 bg-purple-500/10 px-2.5 py-1 text-xs text-purple-200">
                {t(`community.game.${item.game}`)}
              </span>
            )}
            {item.version && (
              <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/55">
                {t("community.version", { version: item.version })}
              </span>
            )}
            {item.is_owner && (
              <span className="rounded-lg border border-purple-400/25 bg-purple-500/10 px-2.5 py-1 text-xs text-purple-200">
                {t("community.yourItem")}
              </span>
            )}
            {item.purchased && !item.is_owner && (
              <span className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                {t("community.purchased")}
              </span>
            )}
          </div>

          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight mb-4 break-words">
            {item.title}
          </h1>

          <div className="flex flex-wrap items-center gap-3 mb-6">
            {item.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.avatar_url}
                alt={item.username}
                className="h-10 w-10 rounded-full object-cover border border-white/10"
              />
            ) : (
              <span className="h-10 w-10 rounded-full bg-purple-500/15 border border-purple-400/20 grid place-items-center text-purple-200 font-bold">
                {item.username.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div>
              <p className="text-sm text-white/45">{t("community.by")}</p>
              <Link
                href={`/u/${encodeURIComponent(item.username)}`}
                className="font-semibold text-white hover:text-purple-300 transition"
              >
                {item.username}
              </Link>
            </div>
            {!item.is_owner && (
              <button
                type="button"
                onClick={toggleFollow}
                disabled={followBusy}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition disabled:opacity-60 ${
                  item.following
                    ? "border-purple-400/40 bg-purple-500/15 text-purple-200"
                    : "border-white/10 bg-white/5 text-white/55 hover:text-white"
                }`}
              >
                <UsersThree size={13} weight={item.following ? "fill" : "regular"} />
                {item.following
                  ? t("community.item.following")
                  : t("community.item.follow")}
                <span className="text-white/35">
                  {t("community.item.followers", { count: item.followers })}
                </span>
              </button>
            )}
            <span className="text-white/20">·</span>
            <span className="text-xs text-white/35">{fmtDate(item.created_at, lang)}</span>
            <span className="inline-flex items-center gap-1 text-xs text-white/35">
              <Eye size={13} /> {t("community.views", { count: item.views || 0 })}
            </span>
            <button
              type="button"
              onClick={toggleFavorite}
              disabled={favoriteBusy}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition disabled:opacity-60 ${
                item.is_favorite
                  ? "border-rose-400/40 bg-rose-500/15 text-rose-200"
                  : "border-white/10 bg-white/5 text-white/55 hover:text-rose-200"
              }`}
            >
              <Heart size={13} weight={item.is_favorite ? "fill" : "regular"} />
              {item.is_favorite
                ? t("community.item.favorited")
                : t("community.item.favorite")}
            </button>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 md:p-8 mb-6">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-5">
              <div className="flex items-center gap-2">
                <Stars value={item.avg_rating} size={18} />
                <span className="text-sm text-white/60">
                  {item.ratings > 0
                    ? `${item.avg_rating.toFixed(1)} · ${t("community.ratings", {
                        count: item.ratings,
                      })}`
                    : t("community.noRatings")}
                </span>
              </div>
              {item.type === "config" && (
                <span className="inline-flex items-center gap-1.5 text-sm text-white/45">
                  <Coins size={15} /> {t("community.sales", { count: item.sales || 0 })}
                </span>
              )}
            </div>

            {item.description && (
              <p className="text-white/70 leading-relaxed whitespace-pre-line mb-5">
                {item.description}
              </p>
            )}

            {Array.isArray(item.tags) && item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-5">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/50"
                  >
                    <Tag size={11} /> {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-5 border-t border-white/[0.06]">
              {item.type === "video" ? (
                <a
                  href={`/api/showcase/${item.id}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 px-5 py-3 text-sm font-semibold transition"
                >
                  <ArrowSquareOut size={17} /> {t("community.watch")}
                </a>
              ) : isPaid && !item.purchased && !item.is_owner ? (
                <div className="w-full flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input
                      value={couponCode}
                      onChange={(e) => {
                        setCouponCode(e.target.value.toUpperCase());
                        setCouponError("");
                      }}
                      maxLength={24}
                      placeholder={lang === "en" ? "Author or streamer code" : "Промокод автора или стримера"}
                      className="min-w-0 flex-1 bg-black/40 px-3 py-2 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-xs font-mono tracking-wide"
                    />
                    <button
                      type="button"
                      onClick={applyCoupon}
                      disabled={couponBusy || !couponCode.trim()}
                      className="shrink-0 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-40 px-3 py-2 text-xs font-semibold transition"
                    >
                      {couponBusy ? "…" : lang === "en" ? "Apply" : "Применить"}
                    </button>
                  </div>
                  {couponError && (
                    <span className="text-[11px] text-red-300 inline-flex items-center gap-1">
                      <WarningCircle size={12} /> {couponError}
                    </span>
                  )}
                  {appliedCoupon && (
                    <span className="text-[11px] text-emerald-300">
                      {appliedCoupon.code} · −{appliedCoupon.discount_percent}% ·{" "}
                      {lang === "en" ? "total" : "итого"} {appliedCoupon.final_price} ₽
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={buy}
                    disabled={buying}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-5 py-3 text-sm font-semibold transition"
                  >
                    <Coins size={17} />
                    {buying
                      ? t("community.buying")
                      : t("community.buyFor", {
                          price: appliedCoupon?.final_price ?? item.final_price,
                        })}
                  </button>
                </div>
              ) : (
                <a
                  href={`/api/showcase/${item.id}/download`}
                  className="inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 px-5 py-3 text-sm font-semibold transition"
                >
                  <DownloadSimple size={17} /> {t("community.download")}
                </a>
              )}

              {item.type === "config" && item.file_name && (
                <span className="text-xs text-white/30 truncate max-w-full">
                  {item.file_name}
                </span>
              )}

              {isPaid && !item.purchased && !item.is_owner && (
                <span className="text-xs text-white/35">
                  {t("community.item.buyHint")}
                </span>
              )}

              {hasDiscount && (
                <span className="text-xs text-emerald-300/80">
                  {t("community.item.savings", { amount: item.price - item.final_price })}
                </span>
              )}
            </div>
          </div>

          {item.type === "config" && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8 mb-6">
              <div className="flex items-center gap-2 mb-5">
                <StackSimple size={22} className="text-purple-300" />
                <h2 className="text-2xl font-bold">{t("community.item.versions")}</h2>
                <span className="text-white/35 text-sm">({versions.length})</span>
              </div>

              {versions.length === 0 ? (
                <p className="text-white/35 text-sm">{t("community.item.noVersions")}</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {versions.map((version) => (
                    <div
                      key={version.id}
                      className="rounded-2xl border border-white/10 bg-black/25 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                          <Tag size={13} className="text-purple-300" />
                          {version.version}
                        </span>
                        <span className="text-[11px] text-white/30">
                          {fmtDate(version.created_at, lang)}
                        </span>
                      </div>
                      {version.changelog && (
                        <p className="text-sm text-white/60 whitespace-pre-wrap break-words mb-2">
                          {version.changelog}
                        </p>
                      )}
                      {canDownload ? (
                        <a
                          href={`/api/showcase/${item.id}/download?version=${version.id}`}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-300 hover:text-purple-200 transition"
                        >
                          <DownloadSimple size={13} />
                          {t("community.item.downloadVersion")}
                          {version.file_name ? ` · ${version.file_name}` : ""}
                        </a>
                      ) : (
                        <span className="text-[11px] text-white/30">
                          {t("community.item.reviewAfterPurchase")}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
            <div className="flex items-center gap-2 mb-6">
              <ChatCircleText size={22} className="text-purple-300" />
              <h2 className="text-2xl font-bold">{t("community.item.reviewsTitle")}</h2>
              <span className="text-white/35 text-sm">({reviews.length})</span>
            </div>

            {loading ? (
              <p className="text-white/35 text-center py-8">{t("common.loading")}</p>
            ) : (
              <>
                {canReview ? (
                  <form
                    onSubmit={submitReview}
                    className="rounded-2xl border border-white/10 bg-black/25 p-4 md:p-5 mb-6"
                  >
                    <p className="text-sm font-semibold mb-3">
                      {item.my_rating
                        ? t("community.item.yourReview")
                        : t("community.item.leaveReview")}
                    </p>
                    <Stars
                      value={ratingValue}
                      size={26}
                      onRate={(value) => setRatingValue(value)}
                    />
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={3}
                      maxLength={1000}
                      placeholder={t("community.item.commentPlaceholder")}
                      className="mt-3 w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none resize-none text-sm"
                    />
                    <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
                      <span className="text-[11px] text-white/30">
                        {comment.length}/1000
                      </span>
                      <button
                        type="submit"
                        disabled={reviewSending}
                        className="rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-60 px-5 py-2.5 text-sm font-semibold transition"
                      >
                        {reviewSending ? t("community.sending") : t("community.item.sendReview")}
                      </button>
                    </div>
                  </form>
                ) : reviewLocked ? (
                  <p className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-200/80 mb-6">
                    {t("community.item.reviewAfterPurchase")}
                  </p>
                ) : item.is_owner ? (
                  <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/45 mb-6">
                    {t("community.item.ownerNoReview")}
                  </p>
                ) : (
                  <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/45 mb-6">
                    {t("community.item.loginToReview")}
                  </p>
                )}

                {reviews.length === 0 ? (
                  <p className="text-white/35 text-center py-8">
                    {t("community.item.noReviews")}
                  </p>
                ) : (
                  <div className="flex flex-col gap-4">
                    {reviews.map((review) => (
                      <div
                        key={review.id}
                        className="rounded-2xl border border-white/10 bg-black/25 p-4"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {review.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={review.avatar_url}
                                alt={review.username}
                                className="h-8 w-8 rounded-full object-cover border border-white/10"
                              />
                            ) : (
                              <span className="h-8 w-8 rounded-full bg-purple-500/15 border border-purple-400/20 grid place-items-center text-purple-200 text-xs font-bold">
                                {review.username.slice(0, 1).toUpperCase()}
                              </span>
                            )}
                            <div className="min-w-0">
                              <Link
                                href={`/u/${encodeURIComponent(review.username)}`}
                                className="text-sm font-semibold text-white hover:text-purple-300 transition"
                              >
                                {review.username}
                              </Link>
                              <div className="flex items-center gap-2">
                                <Stars value={review.rating} size={13} />
                                <span className="text-[11px] text-white/30">
                                  {fmtDate(review.created_at, lang)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <p className="text-sm text-white/70 whitespace-pre-wrap break-words">
                          {review.comment}
                        </p>

                        {review.author_reply ? (
                          <div className="mt-3 rounded-xl border border-purple-400/20 bg-purple-500/[0.07] p-3">
                            <p className="text-[11px] font-semibold text-purple-200 mb-1">
                              {t("community.item.authorReply")}
                            </p>
                            <p className="text-sm text-white/65 whitespace-pre-wrap break-words">
                              {review.author_reply}
                            </p>
                          </div>
                        ) : item.is_owner ? (
                          replyFor === review.id ? (
                            <div className="mt-3">
                              <textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                rows={2}
                                maxLength={800}
                                placeholder={t("community.item.replyPlaceholder")}
                                className="w-full bg-black/40 px-3 py-2 rounded-xl border border-white/10 focus:border-purple-500 outline-none resize-none text-sm"
                              />
                              <div className="flex gap-2 justify-end mt-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReplyFor(null);
                                    setReplyText("");
                                  }}
                                  className="px-3 py-1.5 rounded-lg text-xs bg-white/5 hover:bg-white/10 border border-white/10 transition"
                                >
                                  {t("community.item.cancel")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => sendReply(review.id)}
                                  disabled={replySending || !replyText.trim()}
                                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition"
                                >
                                  {replySending ? t("community.sending") : t("community.item.reply")}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setReplyFor(review.id);
                                setReplyText("");
                              }}
                              className="mt-3 text-xs font-semibold text-purple-300 hover:text-purple-200 transition"
                            >
                              {t("community.item.reply")}
                            </button>
                          )
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </main>

      {notice && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] max-w-[92vw] rounded-2xl border px-5 py-3 text-sm shadow-2xl ${
            notice.ok
              ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
              : "border-red-400/30 bg-red-500/15 text-red-100"
          }`}
        >
          <span className="inline-flex items-center gap-2">
            {notice.ok ? <CheckCircle size={17} /> : <WarningCircle size={17} />}
            {notice.text}
          </span>
        </motion.div>
      )}

      <Footer />
    </div>
  );
}
