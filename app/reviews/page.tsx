"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Star,
  ChatCircleText,
  ThumbsUp,
  SealCheck,
} from "@phosphor-icons/react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useI18n, type Lang } from "@/lib/i18n";

type Review = {
  id: number;
  rating: number;
  body: string;
  created_at: string;
  username: string;
  nickname_color: string | null;
  helpful: number;
  viewer_helpful: boolean;
  verified: boolean;
};
type Mine = { id: number; rating: number; body: string; status: string };

function fmtDate(value: string, lang: Lang) {
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString(lang === "en" ? "en-GB" : "ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function safeColor(value: string | null) {
  return /^#[0-9a-f]{6}$/i.test(value || "") ? String(value) : undefined;
}

export default function ReviewsPage() {
  const { lang } = useI18n();
  const tr = (ru: string, en: string) => (lang === "en" ? en : ru);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [mine, setMine] = useState<Mine[]>([]);
  const [distribution, setDistribution] = useState<Record<string, number>>({});
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(false);
  const [sending, setSending] = useState(false);
  const [voting, setVoting] = useState<number | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/reviews");
      const d = await res.json();
      if (d.ok) {
        setReviews(d.reviews || []);
        setMine(d.mine || []);
        setDistribution(d.distribution || {});
        setLoggedIn(Array.isArray(d.mine));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit() {
    setMsg("");
    if (text.trim().length < 10) {
      setMsg(tr("Отзыв слишком короткий (минимум 10 символов)", "Review is too short (minimum 10 characters)"));
      setMsgOk(false);
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, body: text }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg(d.error || tr("Ошибка отправки", "Could not send the review"));
        setMsgOk(false);
        return;
      }
      setText("");
      setRating(5);
      setMsg(tr("Спасибо! Отзыв отправлен на проверку.", "Thank you! Your review has been sent for moderation."));
      setMsgOk(true);
      await load();
    } catch {
      setMsg(tr("Ошибка сервера", "Server error"));
      setMsgOk(false);
    } finally {
      setSending(false);
    }
  }

  async function vote(review: Review) {
    if (!loggedIn || voting !== null) return;
    setVoting(review.id);
    try {
      const res = await fetch(`/api/reviews/${review.id}/vote`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) {
        setMsg(d.error || tr("Не удалось поставить отметку", "Could not mark the review"));
        setMsgOk(false);
        return;
      }
      setReviews((prev) =>
        prev.map((r) =>
          r.id === review.id
            ? { ...r, helpful: Number(d.helpful) || 0, viewer_helpful: !!d.voted }
            : r
        )
      );
    } catch {
      setMsg(tr("Ошибка сервера", "Server error"));
      setMsgOk(false);
    } finally {
      setVoting(null);
    }
  }

  const avg =
    reviews.length > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : 0;
  const pending = mine.find((m) => m.status === "pending");
  const totalVotes = Object.values(distribution).reduce((sum, value) => sum + value, 0);

  return (
    <>
      <Header />
      <main className="relative min-h-screen text-white overflow-hidden">
        <div className="absolute inset-0 -z-20 opacity-40 pointer-events-none">
          <Image src="/fluid1.png" alt="" fill className="object-cover" priority />
        </div>
        <div className="absolute inset-0 -z-30 opacity-30 pointer-events-none">
          <Image src="/fluid2.png" alt="" fill className="object-cover" />
        </div>
        <section className="relative z-10 pt-40 pb-32 flex flex-col items-center px-6">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-6xl font-extrabold mb-4 text-center"
          >
            {tr("Отзывы", "Reviews")}
          </motion.h1>
          <p className="text-white/50 mb-8 text-center">
            {tr("Что говорят пользователи Stellar Client", "What Stellar Client users say")}
          </p>

          {reviews.length > 0 && (
            <div className="w-full max-w-3xl mb-10 grid gap-4 sm:grid-cols-[auto_1fr] rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6">
              <div className="flex flex-col items-center justify-center sm:pr-6 sm:border-r border-white/10">
                <p className="text-5xl font-extrabold">{avg.toFixed(1)}</p>
                <div className="flex items-center gap-0.5 mt-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      size={18}
                      weight={i <= Math.round(avg) ? "fill" : "regular"}
                      className={i <= Math.round(avg) ? "text-yellow-400" : "text-white/25"}
                    />
                  ))}
                </div>
                <p className="text-white/40 text-xs mt-2">
                  {tr(`${reviews.length} отзыв(ов)`, `${reviews.length} reviews`)}
                </p>
              </div>
              <div className="flex flex-col gap-1.5 justify-center">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = distribution[String(star)] || 0;
                  const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                  return (
                    <div key={star} className="flex items-center gap-2 text-xs text-white/50">
                      <span className="w-3 text-right">{star}</span>
                      <Star size={11} weight="fill" className="text-yellow-400 shrink-0" />
                      <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-yellow-400/80"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="w-full max-w-3xl flex flex-col gap-5 mb-14">
            {loading ? (
              <p className="text-white/30 text-center py-8">{tr("Загрузка...", "Loading...")}</p>
            ) : reviews.length === 0 ? (
              <p className="text-white/30 text-center py-8">
                {tr("Пока нет отзывов — станьте первым!", "No reviews yet - be the first!")}
              </p>
            ) : (
              reviews.map((r, idx) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: Math.min(idx * 0.05, 0.4) }}
                  className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6"
                >
                  <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-purple-600/30 border border-purple-500/30 flex items-center justify-center text-sm font-bold">
                        {r.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/u/${encodeURIComponent(r.username)}`}
                            className="font-semibold text-sm hover:opacity-80 transition"
                            style={{ color: safeColor(r.nickname_color) }}
                          >
                            {r.username}
                          </Link>
                          {r.verified && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                              <SealCheck size={11} weight="fill" />
                              {tr("Подтверждённая покупка", "Verified purchase")}
                            </span>
                          )}
                        </div>
                        <p className="text-white/25 text-[11px] mt-0.5">
                          {fmtDate(r.created_at, lang)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star
                          key={i}
                          size={16}
                          weight={i <= r.rating ? "fill" : "regular"}
                          className={i <= r.rating ? "text-yellow-400" : "text-white/20"}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-white/75 text-sm whitespace-pre-wrap break-words">{r.body}</p>
                  <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => vote(r)}
                      disabled={!loggedIn || voting === r.id}
                      title={
                        loggedIn
                          ? tr("Полезный отзыв", "Helpful review")
                          : tr("Войдите, чтобы отметить отзыв", "Sign in to mark the review")
                      }
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed ${
                        r.viewer_helpful
                          ? "border-purple-400/40 bg-purple-500/15 text-purple-200"
                          : "border-white/10 bg-white/5 text-white/45 hover:text-white/80"
                      }`}
                    >
                      <ThumbsUp
                        size={13}
                        weight={r.viewer_helpful ? "fill" : "regular"}
                      />
                      {tr("Полезно", "Helpful")}
                      <span className="text-white/35">{r.helpful}</span>
                    </button>
                    {!loggedIn && (
                      <span className="text-[11px] text-white/25">
                        {tr("Войдите, чтобы голосовать", "Sign in to vote")}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>

          <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7">
            <div className="flex items-center gap-2 mb-4">
              <ChatCircleText size={22} className="text-purple-400" />
              <h2 className="text-xl font-bold">{tr("Оставить отзыв", "Leave a review")}</h2>
            </div>
            {!loggedIn && !loading ? (
              <p className="text-white/60">
                <Link href="/login" className="text-purple-400 hover:text-purple-300">
                  {tr("Войдите", "Sign in")}
                </Link>{" "}
                {tr("чтобы оставить отзыв.", "to leave a review.")}
              </p>
            ) : pending ? (
              <p className="text-white/60">
                {tr(
                  "Ваш отзыв на проверке — он появится после модерации.",
                  "Your review is being checked - it will appear after moderation."
                )}
              </p>
            ) : (
              <>
                <p className="text-white/40 text-xs mb-2">
                  {tr("За одобренный отзыв начисляем 25 SC-монет.", "Approved reviews earn 25 SC coins.")}
                </p>
                <div className="flex items-center gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setRating(i)}
                      className="transition hover:scale-110"
                    >
                      <Star
                        size={28}
                        weight={i <= rating ? "fill" : "regular"}
                        className={i <= rating ? "text-yellow-400" : "text-white/25"}
                      />
                    </button>
                  ))}
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={tr(
                    "Расскажите о вашем опыте использования клиента...",
                    "Tell us about your experience with the client..."
                  )}
                  rows={4}
                  maxLength={1000}
                  className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none resize-none mb-3"
                />
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  {msg ? (
                    <p className={`text-sm ${msgOk ? "text-green-400" : "text-red-400"}`}>{msg}</p>
                  ) : (
                    <span className="text-white/30 text-xs">{text.length}/1000</span>
                  )}
                  <button
                    onClick={submit}
                    disabled={sending}
                    className="px-6 py-3 rounded-xl font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition"
                  >
                    {sending ? tr("Отправка...", "Sending...") : tr("Отправить", "Send")}
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
