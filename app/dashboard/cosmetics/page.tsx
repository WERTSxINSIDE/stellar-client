"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useI18n } from "@/lib/i18n";
import { isCosmicBadge, isRgbValue } from "@/lib/cosmetics";
import { applySiteTheme, siteThemeClass } from "@/lib/site-theme";
import {
  ArrowLeft,
  CheckCircle,
  Coins,
  Crown,
  GameController,
  Palette,
  Sparkle,
  WarningCircle,
} from "@phosphor-icons/react";

type Cosmetic = {
  key: string;
  type: "nickname_color" | "frame" | "badge" | "theme" | "site_theme" | "game";
  title: string;
  description: string | null;
  price: number;
  value: string | null;
  rarity: "common" | "rare" | "epic" | "legendary" | "cosmic" | string;
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
  cosmic: "cosmic-card",
};

const RARITY_LABEL: Record<string, { ru: string; en: string }> = {
  common: { ru: "Обычный", en: "Common" },
  rare: { ru: "Редкий", en: "Rare" },
  epic: { ru: "Эпический", en: "Epic" },
  legendary: { ru: "Легендарный", en: "Legendary" },
  cosmic: { ru: "Космический", en: "Cosmic" },
};

/** Категории игровой косметики — по префиксу ключа предмета. */
const GAME_GROUPS: { id: string; ru: string; en: string; prefix: string }[] = [
  { id: "all", ru: "Все", en: "All", prefix: "" },
  { id: "pet", ru: "Питомцы", en: "Pets", prefix: "game_pet_" },
  { id: "wings", ru: "Крылья", en: "Wings", prefix: "game_wings_" },
  { id: "backpack", ru: "Рюкзаки", en: "Backpacks", prefix: "game_backpack_" },
  { id: "model", ru: "Модели", en: "Models", prefix: "game_model_" },
  { id: "cape", ru: "Плащи", en: "Capes", prefix: "game_cape_" },
  { id: "hat", ru: "Головные уборы", en: "Hats", prefix: "game_hat_" },
  { id: "aura", ru: "Эффекты", en: "Effects", prefix: "game_aura_" },
];

function gameSlotOf(key: string): string | null {
  const match = /^game_([a-z]+)_/.exec(key);
  return match?.[1] ?? null;
}

export default function CosmeticsPage() {
  const { lang } = useI18n();
  const tr = (ru: string, en: string) => (lang === "en" ? en : ru);
  const router = useRouter();

  const [items, setItems] = useState<Cosmetic[]>([]);
  const [owned, setOwned] = useState<string[]>([]);
  const [equipped, setEquipped] = useState<Record<string, string | null>>({});
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<CoinTx[]>([]);
  const [tab, setTab] = useState<Cosmetic["type"]>("game");
  const [gameGroup, setGameGroup] = useState("all");
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
      const slot = item.type === "game" ? gameSlotOf(item.key) : null;
      const stateKey = item.type === "game" && slot ? `game_${slot}` : item.type;
      const unequip = equipped[stateKey] === item.key;
      const res = await fetch("/api/cosmetics", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: item.type,
          key: unequip ? null : item.key,
          slot: slot || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ ok: false, text: data.error || tr("Не удалось применить", "Could not apply") });
        return;
      }
      setEquipped((prev) => ({ ...prev, [stateKey]: unequip ? null : item.key }));
      if (item.type === "site_theme") {
        applySiteTheme(unequip ? null : item.value);
      }
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
    { id: "game", label: tr("Покупка косметики в игру", "In-game cosmetics"), icon: <GameController size={16} /> },
    { id: "nickname_color", label: tr("Цвет ника", "Nickname color"), icon: <Palette size={16} /> },
    { id: "frame", label: tr("Рамки", "Frames"), icon: <Sparkle size={16} /> },
    { id: "badge", label: tr("Бейджи", "Badges"), icon: <Crown size={16} /> },
    { id: "theme", label: tr("Темы профиля", "Profile themes"), icon: <Palette size={16} /> },
    { id: "site_theme", label: tr("Темы сайта", "Site themes"), icon: <Sparkle size={16} /> },
  ];

  const gamePrefix = GAME_GROUPS.find((group) => group.id === gameGroup)?.prefix ?? "";
  const visible = items.filter(
    (item) => item.type === tab && (tab !== "game" || item.key.startsWith(gamePrefix))
  );

  return (
    <>
      <Header />
      <main className="cosmetics-rgb-bg relative min-h-screen text-white">
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
              <h1 className="cosmic-rgb-text text-4xl md:text-5xl font-extrabold">
                {tr("Косметика профиля", "Profile cosmetics")}
              </h1>
              <p className="text-white/45 mt-2 max-w-2xl">
                {tr(
                  "Тратьте SC-монеты на косметику для профиля и для персонажа в Minecraft. Монеты начисляются за ежедневные награды, покупки, отзывы и достижения.",
                  "Spend SC coins on profile cosmetics and on cosmetics for your Minecraft character. Coins are earned from daily rewards, purchases, reviews and achievements."
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

          <div className="mb-6 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/[0.06] px-4 py-3 text-xs text-white/55">
            <span className="cosmic-rgb-text font-bold">COSMIC</span>{" "}
            {tr(
              "— космическая редкость: анимированные RGB-эффекты для ника, рамки, бейджа и темы профиля. Предметы с пометкой «Космический» переливаются всеми цветами.",
              "— cosmic rarity: animated RGB effects for your nickname, frame, badge and profile theme. Items marked “Cosmic” shift through every colour."
            )}
          </div>

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

          {tab === "game" && (
            <div className="mb-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] px-4 py-3 text-xs text-white/55">
              {tr(
                "Покупка привязывается к вашему нику и автоматически подтягивается клиентом. Можно надеть по одному предмету из каждой категории: питомец, крылья, рюкзак, модель, плащ, головной убор и эффект. После перезапуска клиента всё появится в Minecraft.",
                "A purchase is linked to your nickname and picked up by the client automatically. You can equip one item from each category: pet, wings, backpack, model, cape, hat and effect. Everything appears in Minecraft after restarting the client."
              )}
            </div>
          )}

          {tab === "game" && (
            <div className="flex flex-wrap gap-2 mb-5">
              {GAME_GROUPS.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setGameGroup(group.id)}
                  className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                    gameGroup === group.id
                      ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-100"
                      : "border-white/10 bg-white/[0.04] text-white/55 hover:text-white"
                  }`}
                >
                  {tr(group.ru, group.en)}
                </button>
              ))}
            </div>
          )}

          {tab === "site_theme" && (
            <div className="mb-5 rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.06] px-4 py-3 text-xs text-white/55">
              {tr(
                "Тема сайта применяется ко всем страницам — фон, свечение и настроение интерфейса. Её видите только вы.",
                "A site theme applies to every page — background, glow and the mood of the whole interface. Only you see it."
              )}
            </div>
          )}

          {loading ? (
            <p className="text-white/40">{tr("Загрузка...", "Loading...")}</p>
          ) : visible.length === 0 ? (
            <p className="text-white/40">{tr("В этой категории пока нет предметов.", "No items in this category yet.")}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {visible.map((item) => {
                const isOwned = owned.includes(item.key);
                const isEquipped =
                  item.type === "game"
                    ? equipped[`game_${gameSlotOf(item.key)}`] === item.key
                    : equipped[item.type] === item.key;
                return (
                  <div
                    key={item.key}
                    className={`min-w-0 overflow-hidden rounded-2xl border p-5 ${
                      RARITY[item.rarity] || RARITY.common
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span
                        className={`rounded-md border border-white/10 bg-black/25 px-2 py-0.5 text-[10px] uppercase tracking-widest text-white/50 ${
                          item.rarity === "cosmic" ? "cosmic-rarity" : ""
                        }`}
                      >
                        {RARITY_LABEL[item.rarity]
                          ? lang === "en"
                            ? RARITY_LABEL[item.rarity].en
                            : RARITY_LABEL[item.rarity].ru
                          : item.rarity}
                      </span>
                      {isEquipped && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300">
                          <CheckCircle size={13} weight="fill" /> {tr("Надето", "Equipped")}
                        </span>
                      )}
                    </div>

                    <div className="h-24 rounded-xl border border-white/10 bg-black/30 grid place-items-center mb-4 overflow-hidden">
                      {item.type === "nickname_color" &&
                        (isRgbValue(item.value) ? (
                          <span className="cosmic-rgb-text text-xl font-extrabold">
                            {tr("Ваш ник", "Your nickname")}
                          </span>
                        ) : (
                          <span className="text-xl font-extrabold" style={{ color: item.value || "#fff" }}>
                            {tr("Ваш ник", "Your nickname")}
                          </span>
                        ))}
                      {item.type === "frame" && (
                        <div
                          className={`h-16 w-16 rounded-full grid place-items-center ${
                            isRgbValue(item.value) ? "cosmic-rgb-surface" : ""
                          }`}
                          style={isRgbValue(item.value) ? undefined : { background: item.value || "#7c3aed" }}
                        >
                          <div className="h-12 w-12 rounded-full bg-[#0a0710] grid place-items-center text-lg">
                            🙂
                          </div>
                        </div>
                      )}
                      {item.type === "badge" && (
                        <span
                          className={`text-4xl ${isCosmicBadge(item.value) ? "cosmic-badge" : ""}`}
                        >
                          {item.value || "⭐"}
                        </span>
                      )}
                      {item.type === "theme" && (
                        <div
                          className={`h-full w-full grid place-items-center ${
                            isRgbValue(item.value) ? "cosmic-rgb-surface" : ""
                          }`}
                          style={isRgbValue(item.value) ? undefined : { background: item.value || "#312e81" }}
                        >
                          <span className="text-sm font-semibold text-white/90">
                            {tr("Профиль", "Profile")}
                          </span>
                        </div>
                      )}
                      {item.type === "game" && (
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-4xl drop-shadow-[0_0_12px_rgba(168,85,247,0.45)]">
                            {item.value || "✨"}
                          </span>
                          <span className="text-[10px] uppercase tracking-widest text-white/35">
                            {tr("В игре", "In game")}
                          </span>
                        </div>
                      )}
                      {item.type === "site_theme" && (
                        <div
                          className={`relative h-full w-full overflow-hidden ${
                            siteThemeClass(item.value) || ""
                          }`}
                        >
                          <div className="absolute inset-x-3 top-3 h-2.5 rounded-full border border-white/10 bg-black/45" />
                          <div className="absolute left-3 top-8 h-11 w-16 rounded-lg border border-white/10 bg-black/35" />
                          <div className="absolute right-3 top-8 h-11 w-9 rounded-lg border border-white/10 bg-black/35" />
                          <div className="absolute inset-x-3 bottom-3 h-6 rounded-lg border border-white/10 bg-black/35" />
                          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-white/80">
                            {tr("Весь сайт", "Whole site")}
                          </span>
                        </div>
                      )}
                    </div>

                    <h3
                      className={`font-semibold mb-1 break-words ${
                        item.rarity === "cosmic" ? "cosmic-card-title" : ""
                      }`}
                    >
                      {item.title}
                    </h3>
                    <p
                      className={`text-xs leading-relaxed mb-4 break-words ${
                        item.rarity === "cosmic" ? "cosmic-card-desc" : "text-white/45"
                      }`}
                    >
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
