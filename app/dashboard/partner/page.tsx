"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ArrowLeft, UsersThree, Check } from "@phosphor-icons/react";

type Platform = "youtube" | "tiktok";

export default function PartnerPage() {
  const router = useRouter();
  const [platform, setPlatform] = useState<Platform>("youtube");
  const [link, setLink] = useState("");
  const [tg, setTg] = useState("");
  const [views, setViews] = useState("");
  const [experience, setExperience] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("platform");
    const target: Platform = p === "tiktok" ? "tiktok" : "youtube";

    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        setPlatform(target);
        if (!data.user) router.replace("/login");
      })
      .catch(() => setPlatform(target));
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sent || sending) return;
    setMsg("");
    if (!link.trim() || !tg.trim() || !views.trim() || !reason.trim()) {
      setMsg("Пожалуйста, заполните обязательные поля");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/partner-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          channel_link: link.trim(),
          telegram: tg.trim(),
          views: views.trim(),
          experience: experience.trim(),
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Не удалось отправить заявку");
        return;
      }
      setSent(true);
      setMsg("Заявка отправлена ✓ Мы рассмотрим её в ближайшее время");
    } catch {
      setMsg("Ошибка сети, попробуйте позже");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Header />

      <main className="relative min-h-screen text-white overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-40 pointer-events-none">
          <Image src="/fluid2.png" alt="" fill className="object-cover" priority />
        </div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/60 via-black/70 to-black pointer-events-none" />

        <div className="max-w-3xl mx-auto px-6 pt-36 pb-24">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-white/50 hover:text-white transition text-sm mb-8"
          >
            <ArrowLeft size={16} weight="bold" />В кабинет
          </Link>

          <p className="text-white/40 text-xs tracking-widest uppercase mb-2">
            Система Партнёрства
          </p>
          <h1 className="text-5xl font-extrabold mb-3">
            <span className="bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
              Стать партнёром
            </span>
          </h1>
          <p className="text-white/40 mb-12">
            {platform === "youtube"
              ? "Заявка на медиа-партнёрство — YouTube"
              : "Заявка на медиа-партнёрство — TikTok"}
          </p>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-8">
            <div className="flex items-center gap-2 mb-6">
              <UsersThree size={22} className="text-white/70" />
              <h2 className="text-2xl font-bold">Заявка</h2>
            </div>

            <form onSubmit={submit} className="space-y-5">
              <div>
                <label className="text-white/40 text-xs mb-1.5 block">
                  {platform === "youtube"
                    ? "Ссылка на ваш YouTube-канал:"
                    : "Ссылка на ваш TikTok-аккаунт:"}
                </label>
                <input
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder={
                    platform === "youtube"
                      ? "https://youtube.com/@channel"
                      : "https://tiktok.com/@username"
                  }
                  className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="text-white/40 text-xs mb-1.5 block">
                  Ваш Telegram для связи:
                </label>
                <input
                  value={tg}
                  onChange={(e) => setTg(e.target.value)}
                  placeholder="@username"
                  className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="text-white/40 text-xs mb-1.5 block">
                  {platform === "youtube"
                    ? "Какие у вас средние просмотры на видео?:"
                    : "Какие у вас средние просмотры на ролики?:"}
                </label>
                <input
                  value={views}
                  onChange={(e) => setViews(e.target.value)}
                  placeholder="Например: 500–1000 в среднем"
                  className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="text-white/40 text-xs mb-1.5 block">
                  Был ли у вас опыт в партнёрстве с другими клиентами?:
                </label>
                <textarea
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  rows={3}
                  placeholder="Кратко опишите опыт (если есть)"
                  className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none resize-none"
                />
              </div>

              <div>
                <label className="text-white/40 text-xs mb-1.5 block">
                  Почему вы хотите стать нашим медиа-партнёром?:
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  placeholder="Расскажите, почему хотите сотрудничать"
                  className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none resize-none"
                />
              </div>

              {msg && (
                <p
                  className={`text-sm ${
                    msg.includes("✓") ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {msg}
                </p>
              )}

              <button
                type="submit"
                disabled={sent || sending}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold transition bg-purple-600 hover:bg-purple-700 disabled:opacity-60"
              >
                <Check size={18} weight="bold" />
                {sending ? "Отправка..." : sent ? "Заявка отправлена" : "Подать заявку на партнёрство"}
              </button>
            </form>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
