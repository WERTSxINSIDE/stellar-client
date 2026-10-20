"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Star, ChatCircleText } from "@phosphor-icons/react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

type Review = { id: number; rating: number; body: string; created_at: string; username: string };
type Mine = { id: number; rating: number; body: string; status: string };

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [mine, setMine] = useState<Mine[]>([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(false);
  const [sending, setSending] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/reviews");
      const d = await res.json();
      if (d.ok) { setReviews(d.reviews || []); setMine(d.mine || []); setLoggedIn(Array.isArray(d.mine)); }
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function submit() {
    setMsg("");
    if (text.trim().length < 10) { setMsg("Напишите хотя бы пару предложений (минимум 10 символов)"); setMsgOk(false); return; }
    setSending(true);
    try {
      const res = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating, body: text }) });
      const d = await res.json();
      if (!res.ok) { setMsg(d.error || "Ошибка отправки"); setMsgOk(false); return; }
      setText(""); setRating(5); setMsg("Спасибо! Отзыв отправлен на проверку."); setMsgOk(true); await load();
    } catch { setMsg("Ошибка сервера"); setMsgOk(false); }
    finally { setSending(false); }
  }

  const avg = reviews.length > 0 ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10 : 0;
  const pending = mine.find((m) => m.status === "pending");

  return (
    <>
      <Header />
      <main className="relative min-h-screen text-white overflow-hidden">
        <div className="absolute inset-0 -z-20 opacity-40 pointer-events-none"><Image src="/fluid1.png" alt="" fill className="object-cover" priority /></div>
        <div className="absolute inset-0 -z-30 opacity-30 pointer-events-none"><Image src="/fluid2.png" alt="" fill className="object-cover" /></div>
        <section className="relative z-10 pt-40 pb-32 flex flex-col items-center px-6">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="text-6xl font-extrabold mb-4 text-center">Отзывы</motion.h1>
          <p className="text-white/50 mb-3 text-center">Что говорят пользователи Stellar Client</p>
          {reviews.length > 0 && (
            <div className="flex items-center gap-2 mb-14">
              <div className="flex items-center gap-0.5">{[1,2,3,4,5].map(i=><Star key={i} size={20} weight={i <= Math.round(avg)?"fill":"regular"} className={i <= Math.round(avg)?"text-yellow-400":"text-white/25"}/>)}</div>
              <span className="text-white/60 text-sm">{avg} · {reviews.length} отзыв(ов)</span>
            </div>
          )}
          <div className="w-full max-w-3xl flex flex-col gap-5 mb-14">
            {loading ? <p className="text-white/30 text-center py-8">Загрузка...</p> : reviews.length === 0 ? <p className="text-white/30 text-center py-8">Пока нет отзывов — станьте первым!</p> : reviews.map((r, idx) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: Math.min(idx*0.05,0.4) }} className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6">
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-purple-600/30 border border-purple-500/30 flex items-center justify-center text-sm font-bold">{r.username.charAt(0).toUpperCase()}</div>
                    <span className="font-semibold text-sm">{r.username}</span>
                  </div>
                  <div className="flex items-center gap-0.5">{[1,2,3,4,5].map(i=><Star key={i} size={16} weight={i <= r.rating?"fill":"regular"} className={i <= r.rating?"text-yellow-400":"text-white/20"}/>)}</div>
                </div>
                <p className="text-white/75 text-sm whitespace-pre-wrap break-words">{r.body}</p>
                <p className="text-white/25 text-xs mt-4">{String(r.created_at).slice(0,10)}</p>
              </motion.div>
            ))}
          </div>
          <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7">
            <div className="flex items-center gap-2 mb-4"><ChatCircleText size={22} className="text-purple-400" /><h2 className="text-xl font-bold">Оставить отзыв</h2></div>
            {!loggedIn && !loading ? <p className="text-white/60">Чтобы оставить отзыв, <Link href="/login" className="text-purple-400 hover:text-purple-300">войдите в аккаунт</Link>.</p> : pending ? <p className="text-white/60">Ваш отзыв на проверке — он появится на сайте после одобрения администратором.</p> : (
              <>
                <div className="flex items-center gap-1 mb-4">{[1,2,3,4,5].map(i=><button key={i} type="button" onClick={()=>setRating(i)} className="transition hover:scale-110"><Star size={28} weight={i<=rating?"fill":"regular"} className={i<=rating?"text-yellow-400":"text-white/25"}/></button>)}</div>
                <textarea value={text} onChange={(e)=>setText(e.target.value)} placeholder="Расскажите о вашем опыте использования клиента..." rows={4} maxLength={1000} className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none resize-none mb-3" />
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  {msg ? <p className={`text-sm ${msgOk?"text-green-400":"text-red-400"}`}>{msg}</p> : <span className="text-white/30 text-xs">{text.length}/1000</span>}
                  <button onClick={submit} disabled={sending} className="px-6 py-3 rounded-xl font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition">{sending?"Отправка...":"Отправить"}</button>
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
