"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useI18n } from "@/lib/i18n";
import {
  ArrowLeft,
  CheckCircle,
  Coins,
  Gift,
  PaperPlaneTilt,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react";

type Cosmetic = {
  key: string;
  type: string;
  title: string;
  price: number;
  rarity: string;
};

type GiftItem = {
  id: number;
  kind: "coins" | "cosmetic";
  amount: number;
  item_key: string | null;
  item_title: string | null;
  message: string | null;
  created_at: string;
  direction: "sent" | "received";
  sender: string | null;
  recipient: string | null;
};

export default function GiftsPage() {
  const { lang } = useI18n();
  const tr = (ru: string, en: string) => (lang === "en" ? en : ru);
  const router = useRouter();
  const [tab, setTab] = useState<"coins" | "cosmetic">("coins");
  const [username, setUsername] = useState("");
  const [amount, setAmount] = useState("50");
  const [itemKey, setItemKey] = useState("");
  const [message, setMessage] = useState("");
  const [balance, setBalance] = useState(0);
  const [owned, setOwned] = useState<Cosmetic[]>([]);
  const [sent, setSent] = useState<GiftItem[]>([]);
  const [received, setReceived] = useState<GiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const [giftsRes, cosmeticsRes] = await Promise.all([
      fetch("/api/gifts"),
      fetch("/api/cosmetics"),
    ]);
    const giftsData = await giftsRes.json();
    if (giftsRes.ok && giftsData.ok) {
      setSent(giftsData.sent || []);
      setReceived(giftsData.received || []);
    } else if (giftsRes.status === 401) {
      router.replace("/login");
      return;
    }

    const cosmeticsData = await cosmeticsRes.json();
    if (cosmeticsRes.ok && cosmeticsData.ok) {
      setBalance(Number(cosmeticsData.balance || 0));
      const ownedSet = new Set<string>(cosmeticsData.owned || []);
      setOwned(
        (cosmeticsData.items as Cosmetic[]).filter((item) => ownedSet.has(item.key))
      );
    }
  }, [router]);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) router.replace("/login");
      });
    load().finally(() => setLoading(false));
  }, [load, router]);

  const ownedTypes = useMemo(() => {
    const labels: Record<string, [string, string]> = {
      nickname_color: ["Цвета ника", "Nickname colors"],
      frame: ["Рамки", "Frames"],
      badge: ["Бейджи", "Badges"],
      theme: ["Темы профиля", "Profile themes"],
      site_theme: ["Темы сайта", "Site themes"],
    };
    return labels;
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/gifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: tab,
          username: username.trim(),
          amount: tab === "coins" ? Number(amount) : undefined,
          item_key: tab === "cosmetic" ? itemKey : undefined,
          message: message.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ ok: false, text: data.error || tr("Ошибка", "Error") });
        return;
      }
      setNotice({
        ok: true,
        text: tr("Подарок отправлен", "Gift sent"),
      });
      setUsername("");
      setMessage("");
      setItemKey("");
      await load();
    } catch {
      setNotice({ ok: false, text: tr("Ошибка сервера", "Server error") });
    } finally {
      setBusy(false);
    }
  }

  function GiftRow({ gift }: { gift: GiftItem }) {
    const isSent = gift.direction === "sent";
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 flex items-start gap-3">
        <div
          className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
            gift.kind === "coins"
              ? "bg-amber-500/15 text-amber-300"
              : "bg-fuchsia-500/15 text-fuchsia-300"
          }`}
        >
          {gift.kind === "coins" ? <Coins size={18} /> : <Sparkle size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="text-white/45">
              {isSent ? tr("Вы →", "You →") : `${gift.sender || tr("Игрок", "Player")} →`}
            </span>{" "}
            <span className="font-medium">
              {isSent ? gift.recipient : tr("вы", "you")}
            </span>
          </p>
          <p className="text-xs text-white/55">
            {gift.kind === "coins"
              ? `${gift.amount} SC`
              : gift.item_title || gift.item_key}
          </p>
          {gift.message && (
            <p className="text-xs text-white/35 mt-1 italic">«{gift.message}»</p>
          )}
        </div>
        <span className="text-[10px] text-white/25 shrink-0">
          {new Date(gift.created_at).toLocaleDateString(lang === "en" ? "en-GB" : "ru-RU")}
        </span>
      </div>
    );
  }

  return (
    <>
      <Header />
      <main className="relative min-h-screen text-white">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(236,72,153,0.14),transparent_55%)]" />
        <div className="max-w-4xl mx-auto px-6 pt-36 pb-24">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-white/50 hover:text-white transition text-sm mb-8"
          >
            <ArrowLeft size={16} weight="bold" /> {tr("В кабинет", "Back to dashboard")}
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Gift size={28} weight="fill" className="text-fuchsia-300" />
                <p className="text-white/40 text-xs tracking-widest uppercase">
                  {tr("Подарки", "Gifts")}
                </p>
              </div>
              <h1 className="cosmic-rgb-text text-4xl md:text-5xl font-extrabold">
                {tr("Подарить SC или косметику", "Send SC or cosmetics")}
              </h1>
              <p className="text-white/45 mt-2 max-w-2xl">
                {tr(
                  "Отправляйте монеты или предметы из инвентаря любому игроку по никнейму.",
                  "Send coins or inventory items to any player by username."
                )}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-5 py-4 min-w-[160px]">
              <p className="text-[11px] uppercase tracking-widest text-amber-200/70">
                {tr("Баланс", "Balance")}
              </p>
              <p className="text-2xl font-bold text-amber-200 inline-flex items-center gap-2">
                <Coins size={22} weight="fill" /> {balance} SC
              </p>
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

          <form
            onSubmit={submit}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mb-8"
          >
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setTab("coins")}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                  tab === "coins"
                    ? "border-amber-400/50 bg-amber-500/15 text-amber-200"
                    : "border-white/10 bg-white/[0.02] text-white/50 hover:bg-white/[0.05]"
                }`}
              >
                <Coins size={16} className="inline mr-1.5" /> SC
              </button>
              <button
                type="button"
                onClick={() => setTab("cosmetic")}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                  tab === "cosmetic"
                    ? "border-fuchsia-400/50 bg-fuchsia-500/15 text-fuchsia-200"
                    : "border-white/10 bg-white/[0.02] text-white/50 hover:bg-white/[0.05]"
                }`}
              >
                <Sparkle size={16} className="inline mr-1.5" /> {tr("Косметика", "Cosmetics")}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <label className="block">
                <span className="text-[11px] uppercase tracking-widest text-white/40 mb-1 block">
                  {tr("Получатель", "Recipient")}
                </span>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder={tr("Никнейм", "Username")}
                  maxLength={32}
                  required
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-fuchsia-400/50"
                />
              </label>

              {tab === "coins" ? (
                <label className="block">
                  <span className="text-[11px] uppercase tracking-widest text-white/40 mb-1 block">
                    {tr("Сумма SC", "SC amount")}
                  </span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    required
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-amber-400/50"
                  />
                </label>
              ) : (
                <label className="block">
                  <span className="text-[11px] uppercase tracking-widest text-white/40 mb-1 block">
                    {tr("Предмет", "Item")}
                  </span>
                  <select
                    value={itemKey}
                    onChange={(event) => setItemKey(event.target.value)}
                    required
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-fuchsia-400/50"
                  >
                    <option value="">
                      {owned.length === 0
                        ? tr("Нет косметики", "No cosmetics")
                        : tr("Выберите предмет", "Select an item")}
                    </option>
                    {Object.entries(ownedTypes).map(([type, labels]) => {
                      const items = owned.filter((item) => item.type === type);
                      if (!items.length) return null;
                      return (
                        <optgroup key={type} label={tr(labels[0], labels[1])}>
                          {items.map((item) => (
                            <option key={item.key} value={item.key}>
                              {item.title}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </label>
              )}
            </div>

            <label className="block mb-4">
              <span className="text-[11px] uppercase tracking-widest text-white/40 mb-1 block">
                {tr("Сообщение (необязательно)", "Message (optional)")}
              </span>
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={200}
                placeholder={tr("Пара слов получателю", "A few words for the recipient")}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-fuchsia-400/50"
              />
            </label>

            <button
              type="submit"
              disabled={busy || !username.trim() || (tab === "cosmetic" && !itemKey)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 px-5 py-2.5 text-sm font-semibold transition disabled:opacity-40"
            >
              <PaperPlaneTilt size={16} />
              {busy ? tr("Отправляем...", "Sending...") : tr("Отправить подарок", "Send gift")}
            </button>
          </form>

          {loading ? (
            <div className="py-16 text-center text-white/40">{tr("Загрузка...", "Loading...")}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section>
                <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-3">
                  {tr("Отправленные", "Sent")} · {sent.length}
                </h2>
                <div className="space-y-2">
                  {sent.length === 0 ? (
                    <p className="text-sm text-white/30">{tr("Пока пусто.", "Nothing yet.")}</p>
                  ) : (
                    sent.map((gift) => <GiftRow key={gift.id} gift={gift} />)
                  )}
                </div>
              </section>
              <section>
                <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-3">
                  {tr("Полученные", "Received")} · {received.length}
                </h2>
                <div className="space-y-2">
                  {received.length === 0 ? (
                    <p className="text-sm text-white/30">{tr("Пока пусто.", "Nothing yet.")}</p>
                  ) : (
                    received.map((gift) => <GiftRow key={gift.id} gift={gift} />)
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
