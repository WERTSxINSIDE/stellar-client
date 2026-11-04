"use client";

import { useEffect, useState } from "react";
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
  Palette,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react";

type Cosmetic = {
  key: string;
  type: "nickname_color" | "frame" | "badge" | "theme";
  title: string;
  description: string | null;
  price: number;
  value: string | null;
  rarity: "common" | "rare" | "epic" | "legendary" | string;
};

type CoinTx = {
  id: number;
  amount: number;
  type: string;
  note: string | null;
  created_at: string;
};

const RARITY: Record<string, string> = {
  common: "border-white/15 bg-white/[0.04]",
  rare: "border-sky-400/30 bg-sky-500/10",
  epic: "border-purple-400/30 bg-purple-500/10",
  legendary: "border-amber-400/40 bg-amber-500/10",
};

const RARITY_LABEL: Record<string, string> = {
  common: "Обычный",
  rare: "Редкий",
  epic: "Эпический",
  legendary: "Легендарный",
};

export default function CosmeticsPage() {
  const { lang } = useI18n();
  const tr = (ru: string, en: string) => (lang === "en" ? en : ru);
  const router = useRouter();

  const [items, setItems] = useState<Cosmetic[]>([]);
  const [owned, setOwned] = useState<string[]>([]);
  const [equipped, setEquipped] = useState<Record<string, string | null>>({});
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<CoinTx[]>([]);
  const [tab, setTab] = useState<Cosmetic["type"]>("nickname_color");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    const res = await fetch("/api/cosmetics", { cache: "no-store" });
    if (res.status === 401) {
      router.replace("/login");
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      setNotice({ ok: false, text: data.error || tr("Ошибка загрузки", "Failed to load") });
      return;
    }
    setItems(Array.isArray(data.items) ? data.items : []);
    setOwned(Array.isArray(data.owned) ? data.owned : []);
    setEquipped(data.equipped || {});
    setBalance(Number(data.balance) || 0);
    setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function buy(item: Cosmetic) {
    if (busy) return;
    setBusy(item.key);
    setNotice(null);
    try {
      const res = await fetch("/api/cosmetics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: item.key }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ ok: false, text: data.error || tr("Не удалось купить", "Purchase failed") });
        return;
      }
      setBalance(Number(data.balance) || 0);
      setNotice({ ok: true, text: `${tr("Куплено", "Purchased")}: ${item.title}` });
      await load();
    } catch {
      setNotice({ ok: false, text: tr("Ошибка сервера", "Server error") });
    } finally {
      setBusy(null);
    }
  }

  async function equip(item: Cosmetic) {
    if (busy) return;
    if (!owned.includes(item.key)) return;
    setBusy(item.key);
    setNotice(null);
    try {
      const unequip = equipped[item.type] === item.key;
      const res = await fetch("/api/cosmetics", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: item.type, key: unequip ? null : item.key }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ ok: false, text: data.error || tr("Не удалось применить", "Could not apply") });
        return;
      }
      setEquipped((prev) => ({ ...prev, [item.type]: unequip ? null : item.key }));
      setNotice({
        ok: true,
        text: unequip ? tr("Косметика снята", "Cosmetic removed") : tr("Косметика надета", "Cosmetic equipped"),
      });
    } catch {
      setNotice({ ok: false, text: tr("Ошибка сервера", "Server error") });
    } finally {
      setBusy(null);
    }
  }

  const tabs: { id: Cosmetic["type"]; label: string; icon: React.ReactNode }[] = [
    { id: "nickname_color", label: tr("Цвет ника", "Nickname color"), icon: <Palette size={16} /> },
    { id: "frame", label: tr("Рамки", "Frames"), icon: <Sparkle size={16} /> },
    { id: "badge", label: tr("Бейджи", "Badges"), icon: <Crown size={16} /> },
    { id: "theme", label: tr("Темы профиля", "Profile themes"), icon: <Palette size={16} /> },
  ];

  const visible = items.filter((item) => item.type === tab);

  return (
    <>
      <Header />
      <main className="relative min-h-screen bg-[#0a0710] text-white">
        <div className="max-w-6xl mx-auto px-6 pt-36 pb-24">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-white/50 hover:text-white transition text-sm mb-8"
          >
            <ArrowLeft size={16} weight="bold" /> {tr("В кабинет", "Back to dashboard")}
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Sparkle size={28} weight="fill" className="text-purple-400" />
                <p className="text-white/40 text-xs tracking-widest uppercase">
                  {tr("SC-магазин", "SC shop")}
                </p>
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold">
                {tr("Косметика профиля", "Profile cosmetics")}
              </h1>
              <p className="text-white/45 mt-2 max-w-2xl">
                {tr(
                  "Тратьте SC-монеты на цвета ника, рамки, бейджи и темы. Монеты начисляются за ежедневные награды, покупки, отзывы и достижения.",
                  "Spend SC coins on nickname colors, frames, badges and themes. Coins are earned from daily rewards, purchases, reviews and achievements."
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

          <div className="flex flex-wrap gap-2 mb-6">
            {tabs.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setTab(entry.id)}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                  tab === entry.id
                    ? "border-purple-400/40 bg-purple-500/20 text-purple-100"
                    : "border-white/10 bg-white/5 text-white/55 hover:text-white"
                }`}
              >
                {entry.icon} {entry.label}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-white/40">{tr("Загрузка...", "Loading...")}</p>
          ) : visible.length === 0 ? (
            <p className="text-white/40">{tr("В этой категории пока нет предметов.", "No items in this category yet.")}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {visible.map((item) => {
                const isOwned = owned.includes(item.key);
                const isEquipped = equipped[item.type] === item.key;
                return (
                  <div
                    key={item.key}
                    className={`min-w-0 overflow-hidden rounded-2xl border p-5 ${
                      RARITY[item.rarity] || RARITY.common
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="rounded-md border border-white/10 bg-black/25 px-2 py-0.5 text-[10px] uppercase tracking-widest text-white/50">
                        {RARITY_LABEL[item.rarity] || item.rarity}
                      </span>
                      {isEquipped && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                          <CheckCircle size={13} weight="fill" /> {tr("Надето", "Equipped")}
                        </span>
                      )}
                    </div>

                    <div className="h-24 rounded-xl border border-white/10 bg-black/30 grid place-items-center mb-4 overflow-hidden">
                      {item.type === "nickname_color" && (
                        <span className="text-xl font-extrabold" style={{ color: item.value || "#fff" }}>
                          {tr("Ваш ник", "Your nickname")}
                        </span>
                      )}
                      {item.type === "frame" && (
                        <div
                          className="h-16 w-16 rounded-full grid place-items-center"
                          style={{ background: item.value || "#7c3aed" }}
                        >
                          <div className="h-12 w-12 rounded-full bg-[#0a0710] grid place-items-center text-lg">
                            🙂
                          </div>
                        </div>
                      )}
                      {item.type === "badge" && (
                        <span className="text-4xl">{item.value || "⭐"}</span>
                      )}
                      {item.type === "theme" && (
                        <div
                          className="h-full w-full grid place-items-center"
                          style={{ background: item.value || "#312e81" }}
                        >
                          <span className="text-sm font-semibold text-white/90">
                            {tr("Профиль", "Profile")}
                          </span>
                        </div>
                      )}
                    </div>

                    <h3 className="font-semibold mb-1 break-words">{item.title}</h3>
                    <p className="text-xs text-white/45 leading-relaxed mb-4 break-words">
                      {item.description}
                    </p>

                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-200">
                        <Coins size={16} weight="fill" /> {item.price} SC
                      </span>
                      {isOwned ? (
                        <button
                          type="button"
                          onClick={() => equip(item)}
                          disabled={busy === item.key}
                          className={`rounded-xl border px-4 py-2 text-xs font-semibold transition disabled:opacity-60 ${
                            isEquipped
                              ? "border-white/15 bg-white/10 text-white/70 hover:bg-white/15"
                              : "border-purple-400/40 bg-purple-500/20 text-purple-100 hover:bg-purple-500/30"
                          }`}
                        >
                          {isEquipped
                            ? tr("Снять", "Remove")
                            : tr("Надеть", "Equip")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => buy(item)}
                          disabled={busy === item.key || balance < item.price}
                          className="rounded-xl bg-amber-500 hover:bg-amber-400 px-4 py-2 text-xs font-bold text-black transition disabled:opacity-40"
                        >
                          {balance < item.price
                            ? tr("Не хватает", "Not enough")
                            : busy === item.key
                              ? tr("Покупка...", "Buying...")
                              : tr("Купить", "Buy")}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-12 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-bold mb-4">{tr("История SC-монет", "SC coin history")}</h2>
            {transactions.length === 0 ? (
              <p className="text-white/40 text-sm">{tr("Операций пока нет.", "No transactions yet.")}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-white/75 truncate">
                        {tx.note || tx.type}
                      </p>
                      <p className="text-[11px] text-white/30">
                        {new Date(tx.created_at.replace(" ", "T")).toLocaleDateString(
                          lang === "en" ? "en-GB" : "ru-RU"
                        )}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-sm font-bold ${
                        tx.amount > 0 ? "text-emerald-300" : "text-rose-300"
                      }`}
                    >
                      {tx.amount > 0 ? `+${tx.amount}` : tx.amount} SC
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
