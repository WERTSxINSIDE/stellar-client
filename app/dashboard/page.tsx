"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Loader from "@/components/Loader";
import {
  SignOut,
  ShoppingCartSimple,
  CalendarBlank,
  Key,
  Hash,
  Fingerprint,
  Cube,
  DownloadSimple,
  ArrowUpRight,
  ShieldCheck,
  Shield,
  User,
  VideoCamera,
  Eye,
  Gift,
  Wallet,
  ChartBar,
  ClockCounterClockwise,
  SquaresFour,
  UsersThree,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
} from "@phosphor-icons/react";

type Me = {
  id: number;
  username: string;
  email: string;
  created_at: string;
  subscription_end: string | null;
  hwid: string | null;
  role: string;
  is_admin: number;
  balance: number;
  partner_rank: string;
  platform?: string | null;
} | null;

// Простой стабильный хеш (для наглядного HWID из данных аккаунта)
function makeHwid(seed: string) {
  let h1 = 0x811c9dc5;
  let out = "";
  for (let pass = 0; pass < 4; pass++) {
    let h = h1 ^ (pass * 0x9e3779b1);
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    out += (h >>> 0).toString(16).padStart(8, "0");
    h1 = h;
  }
  return out;
}

function formatDate(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

type RewardInfo = {
  day: number;
  type: "balance" | "subscription";
  amount?: number;
  days?: number;
  label: string;
};

export default function Dashboard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<Me>(null);
  const [transferUser, setTransferUser] = useState("");
  const [transferAmount, setTransferAmount] = useState(0);
  const [transferMsg, setTransferMsg] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);
  const [giftUser, setGiftUser] = useState("");
  const [giftDays, setGiftDays] = useState(30);
  const [giftMsg, setGiftMsg] = useState("");
  const [giftLoading, setGiftLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [playStats, setPlayStats] = useState<{ seconds: number; launches: number } | null>(null);
  const [reward, setReward] = useState<{ day: number; claimedToday: boolean; finished: boolean; rewards: RewardInfo[] } | null>(null);
  const [rewardMsg, setRewardMsg] = useState("");
  const [rewardLoading, setRewardLoading] = useState(false);
  const [tab, setTab] = useState<string>("account");
  const [partnerStage, setPartnerStage] = useState<"list" | "info">("list");
  const [partnerPlatform, setPartnerPlatform] = useState<"youtube" | "tiktok">("youtube");
  const [mediaSubs, setMediaSubs] = useState<{ id: number; video_url: string; status: string; reward: number; views: number; admin_note: string | null; created_at: string }[]>([]);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaMsg, setMediaMsg] = useState("");
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaRank, setMediaRank] = useState("");
  const [mediaPlatform, setMediaPlatform] = useState<string | null>(null);
  const [mediaVideoThreshold, setMediaVideoThreshold] = useState(7);
  const [mediaViewsThreshold, setMediaViewsThreshold] = useState(5000);
  const [mediaTotalViews, setMediaTotalViews] = useState(0);
  const [mediaEarned, setMediaEarned] = useState(0);
  const [bugIp, setBugIp] = useState("");
  const [bugFunction, setBugFunction] = useState("");
  const [bugFrequency, setBugFrequency] = useState("редко");
  const [bugDescription, setBugDescription] = useState("");
  const [bugMsg, setBugMsg] = useState("");
  const [bugLoading, setBugLoading] = useState(false);
  const [bugReports, setBugReports] = useState<{ id: number; server_ip: string; function_name: string; frequency: string; description: string; status: string; created_at: string; username?: string }[]>([]);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.user) router.replace("/login");
        else setUser(data.user);
      });
    fetch("/api/balance-history")
      .then((r) => r.json())
      .then((d) => d.ok && setHistory(d.history));
    fetch("/api/play-session")
      .then((r) => r.json())
      .then((d) => d.ok && setPlayStats(d.stats));
    fetch("/api/daily-reward")
      .then((r) => r.json())
      .then((d) => d.ok && setReward({ day: d.day, claimedToday: d.claimedToday, finished: d.finished, rewards: d.rewards }));
    fetch("/api/media-submit")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) return;
        if (d.submissions) setMediaSubs(d.submissions);
        if (d.rank) setMediaRank(d.rank);
        if (d.platform !== undefined) setMediaPlatform(d.platform);
        if (d.videoThreshold) setMediaVideoThreshold(d.videoThreshold);
        if (d.viewsThreshold) setMediaViewsThreshold(d.viewsThreshold);
        if (typeof d.totalViews === "number") setMediaTotalViews(d.totalViews);
        if (typeof d.earned === "number") setMediaEarned(d.earned);
      });
    fetch("/api/bug-report")
      .then((r) => r.json())
      .then((d) => d.ok && setBugReports(d.reports || []));
  }, [router]);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function transferBalance() {
    setTransferMsg("");
    if (!transferUser.trim() || transferAmount < 1) return;
    setTransferLoading(true);
    try {
      const res = await fetch("/api/balance-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: transferUser, amount: transferAmount }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTransferMsg(data.error || "Ошибка");
        return;
      }
      setTransferMsg(`Перевод выполнен ✓ Новый баланс: ${data.balance}₽`);
      setUser((prev) => prev ? { ...prev, balance: data.balance } : prev);
      setTransferUser("");
      setTransferAmount(0);
    } catch {
      setTransferMsg("Ошибка сервера");
    } finally {
      setTransferLoading(false);
    }
  }

  async function giftSubscription() {
    setGiftMsg("");
    if (!giftUser.trim() || giftDays < 1) return;
    setGiftLoading(true);
    try {
      const res = await fetch("/api/gift-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: giftUser, days: giftDays }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGiftMsg(data.error || "Ошибка");
        return;
      }
      setGiftMsg(`Подарок отправлен ✓`);
      setUser((prev) => prev ? { ...prev, subscription_end: data.subscription_end } : prev);
      setGiftUser("");
    } catch {
      setGiftMsg("Ошибка сервера");
    } finally {
      setGiftLoading(false);
    }
  }

  async function submitBugReport() {
    setBugMsg("");
    if (!bugIp.trim() || !bugFunction.trim() || !bugDescription.trim()) {
      setBugMsg("Заполните все поля");
      return;
    }
    setBugLoading(true);
    try {
      const res = await fetch("/api/bug-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          server_ip: bugIp,
          function_name: bugFunction,
          frequency: bugFrequency,
          description: bugDescription,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBugMsg(data.error || "Ошибка");
        return;
      }
      setBugMsg("Баг-репорт отправлен ✓");
      setBugIp("");
      setBugFunction("");
      setBugFrequency("редко");
      setBugDescription("");
      const list = await fetch("/api/bug-report").then((r) => r.json());
      if (list.ok) setBugReports(list.reports || []);
    } catch {
      setBugMsg("Ошибка сервера");
    } finally {
      setBugLoading(false);
    }
  }

  async function claimReward() {
    setRewardMsg("");
    setRewardLoading(true);
    try {
      const res = await fetch("/api/daily-reward", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setRewardMsg(data.error || "Ошибка");
        return;
      }
      setRewardMsg(`Награда получена ✓ ${data.message}`);
      setReward((prev) => prev ? { ...prev, claimedToday: true, finished: !!data.finished } : prev);
      setUser((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          balance: data.balance ?? prev.balance,
          subscription_end: data.subscription_end ?? prev.subscription_end,
        };
      });
      fetch("/api/balance-history")
        .then((r) => r.json())
        .then((d) => d.ok && setHistory(d.history));
    } catch {
      setRewardMsg("Ошибка сервера");
    } finally {
      setRewardLoading(false);
    }
  }

  async function submitMedia() {
    if (!mediaUrl.trim()) return;
    setMediaLoading(true);
    setMediaMsg("");
    try {
      const res = await fetch("/api/media-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_url: mediaUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMediaMsg(data.error || "Ошибка");
        return;
      }
      setMediaMsg("Видео отправлено ✓");
      setMediaUrl("");
      const r2 = await fetch("/api/media-submit");
      const d2 = await r2.json();
      if (d2.submissions) setMediaSubs(d2.submissions);
      if (d2.rank) setMediaRank(d2.rank);
      if (d2.platform !== undefined) setMediaPlatform(d2.platform);
      if (d2.videoThreshold) setMediaVideoThreshold(d2.videoThreshold);
      if (d2.viewsThreshold) setMediaViewsThreshold(d2.viewsThreshold);
      if (typeof d2.totalViews === "number") setMediaTotalViews(d2.totalViews);
      if (typeof d2.earned === "number") setMediaEarned(d2.earned);
    } catch {
      setMediaMsg("Ошибка сервера");
    } finally {
      setMediaLoading(false);
    }
  }

  function formatPlayTime(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h} ч ${m} мин`;
    return `${m} мин`;
  }

  const typeLabels: Record<string, string> = {
    subscription: "Подписка",
    transfer: "Перевод",
    media: "Видео",
    topup: "Пополнение",
    reward: "Ежедневная награда",
    hwid: "Сброс HWID",
  };

  // Производные данные аккаунта
  const reg = user ? new Date(user.created_at.replace(" ", "T")) : new Date();
  const regStr = user ? formatDate(reg) : "—";
  const subEnd = user?.subscription_end ? new Date(user.subscription_end.replace(" ", "T")) : null;
  const now = new Date();
  const hasSub = subEnd && subEnd > now;
  const subStr = user ? (hasSub ? formatDate(subEnd) : "Нет подписки") : "—";
  const hwid = user?.hwid ?? "—";

  const roleLabels: Record<string, string> = {
    user: "Пользователь",
    media: "Медиа",
    tester: "Тестер",
    admin: "Администратор",
  };

  const mediaApprovedCount = mediaSubs.filter((s) => s.status === "approved").length;
  const mediaPromoted = mediaRank === "Партнёр";
  const mediaPlatformLabel =
    mediaPlatform === "youtube" ? "YouTube" : mediaPlatform === "tiktok" ? "TikTok" : "—";
  const mediaVideoPct =
    mediaVideoThreshold > 0
      ? Math.min(100, Math.round((mediaApprovedCount / mediaVideoThreshold) * 100))
      : 0;
  const mediaViewsPct =
    mediaViewsThreshold > 0
      ? Math.min(100, Math.round((mediaTotalViews / mediaViewsThreshold) * 100))
      : 0;
  const formatNum = (n: number) => n.toLocaleString("ru-RU");

  return (
    <>
      <Loader onFinished={() => setReady(true)} />
      {ready && (
        <>
          <Header />

          <main className="relative min-h-screen text-white overflow-hidden">
            {/* Фоновая дымка */}
            <div className="absolute inset-0 -z-10 opacity-40 pointer-events-none">
              <Image
                src="/fluid2.png"
                alt=""
                fill
                className="object-cover"
                priority
              />
            </div>
            <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/60 via-black/70 to-black pointer-events-none" />

            <div className="max-w-5xl mx-auto px-6 pt-36 pb-24">
              {/* Заголовок + выйти */}
              <div className="flex items-start justify-between mb-8">
                <div>
                  <p className="text-white/40 text-xs tracking-widest uppercase mb-2">
                    Личный кабинет
                  </p>
                  <h1 className="text-5xl font-extrabold">Профиль</h1>
                </div>
                <button
                  onClick={logout}
                  className="flex items-center gap-2 text-sm font-medium px-5 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
                >
                  <SignOut size={18} weight="bold" />
                  Выйти
                </button>
              </div>

              <div className="flex flex-col lg:flex-row gap-8 items-start">
                {/* Боковое меню */}
                <aside className="w-full lg:w-72 shrink-0 lg:sticky lg:top-32">
                  <nav className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-3 flex lg:flex-col gap-1.5 overflow-x-auto">
                    {[
                      { id: "account", label: "Аккаунт", icon: <User size={18} /> },
                      { id: "reward", label: "Ежедневная награда", icon: <Gift size={18} />, dot: !!reward && !reward.finished && !reward.claimedToday },
                      { id: "balance", label: "Баланс", icon: <Wallet size={18} /> },
                      { id: "stats", label: "Статистика", icon: <ChartBar size={18} /> },
                      { id: "history", label: "История операций", icon: <ClockCounterClockwise size={18} /> },
                      {
                        id:
                          user?.role === "media"
                            ? "media"
                            : user?.role === "tester"
                            ? "tester"
                            : "partners",
                        label:
                          user?.role === "media"
                            ? "Медиа Отдел"
                            : user?.role === "tester"
                            ? "Тестовый отдел"
                            : "Система Партнерства",
                        icon: user?.role === "media" ? <VideoCamera size={18} /> : <UsersThree size={18} />,
                      },
                      { id: "actions", label: "Действия", icon: <SquaresFour size={18} /> },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setTab(item.id)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium whitespace-nowrap transition ${
                          tab === item.id
                            ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20"
                            : "text-white/60 hover:text-white hover:bg-white/[0.06]"
                        }`}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                        {item.dot && (
                          <span className="ml-auto w-2 h-2 rounded-full bg-purple-300 shrink-0" />
                        )}
                      </button>
                    ))}
                  </nav>
                </aside>

                {/* Основной контент */}
                <div className="flex-1 min-w-0">
              {/* Карточка пользователя */}
              <div className="relative rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7 mb-12 overflow-hidden">
                <div className="flex items-center justify-between gap-6 flex-wrap">
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-full overflow-hidden border border-white/15 shrink-0">
                      <Image
                        src="/icon.png"
                        alt="avatar"
                        width={64}
                        height={64}
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold leading-none mb-1">
                        {user?.username ?? "..."}
                      </h2>
                      <p className="text-white/50 text-sm mb-3">
                        {user?.email ?? ""}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70">
                          <ShieldCheck size={14} />
                          {roleLabels[user?.role || "user"]}
                        </span>
                        {user?.role === "media" && user?.platform && (
                          <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${
                            user.platform === "youtube"
                              ? "bg-red-500/10 border-red-500/30 text-red-300"
                              : "bg-white/5 border-white/10 text-white/70"
                          }`}>
                            <VideoCamera size={14} />
                            {user.platform === "youtube" ? "YouTube" : "TikTok"}
                          </span>
                        )}
                        <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70">
                          <Hash size={14} />
                          UID {user?.id ?? "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white/40 text-xs tracking-widest uppercase mb-1">
                      Подписка
                    </p>
                    <p className="text-xl font-semibold">{subStr}</p>
                  </div>
                </div>
              </div>

              {tab === "account" && (
              <div className="mb-12">
                <h3 className="text-3xl font-bold mb-1">Аккаунт</h3>
                <p className="text-white/40 mb-6">
                  Подписка, доступ и состояние защиты аккаунта.
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <InfoTile
                    icon={<ShoppingCartSimple size={18} />}
                    label="Подписка"
                    value={subStr}
                  />
                  <InfoTile
                    icon={<CalendarBlank size={18} />}
                    label="Регистрация"
                    value={regStr}
                  />
                  <InfoTile
                    icon={<Key size={18} />}
                    label="Доступ"
                    value="Активен"
                  />
                  <InfoTile
                    icon={<Hash size={18} />}
                    label="UID"
                    value={String(user?.id ?? "—")}
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-center gap-2 text-white/40 text-sm mb-2">
                    <Fingerprint size={18} />
                    HWID
                  </div>
                  <p className="font-mono text-lg break-all">{hwid}</p>
                </div>
              </div>
              )}

              {tab === "balance" && (
              <div className="mb-12">
                <h3 className="text-3xl font-bold mb-1">Баланс</h3>
                <p className="text-white/40 mb-6">
                  Перевод средств и подарки подписки.
                </p>

                <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7 mb-6 flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/30 grid place-items-center text-purple-300 shrink-0">
                      <Wallet size={22} />
                    </div>
                    <div>
                      <p className="text-white/40 text-xs tracking-widest uppercase mb-1">Текущий баланс</p>
                      <p className="text-3xl font-bold">{user?.balance ?? 0} ₽</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Перевод баланса */}
                  <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7">
                    <h4 className="text-xl font-bold mb-4">Перевести баланс</h4>

                    <div className="mb-4">
                      <label className="text-white/40 text-xs mb-1 block">Получатель</label>
                      <input
                        type="text"
                        value={transferUser}
                        onChange={(e) => setTransferUser(e.target.value)}
                        placeholder="Имя пользователя"
                        className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
                      />
                    </div>

                    <div className="mb-4">
                      <label className="text-white/40 text-xs mb-1 block">Сумма (₽)</label>
                      <input
                        type="number"
                        min={1}
                        value={transferAmount || ""}
                        onChange={(e) => setTransferAmount(Number(e.target.value))}
                        placeholder="0"
                        className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
                      />
                    </div>

                    {transferMsg && (
                      <p className={`text-sm mb-3 ${transferMsg.includes("✓") ? "text-green-400" : "text-red-400"}`}>{transferMsg}</p>
                    )}

                    <button
                      onClick={transferBalance}
                      disabled={transferLoading || !transferUser.trim() || transferAmount < 1}
                      className="w-full py-3 rounded-xl font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition"
                    >
                      {transferLoading ? "Отправка..." : "Перевести"}
                    </button>
                  </div>

                  {/* Подарок подписки */}
                  <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7">
                    <h4 className="text-xl font-bold mb-4">Подарить подписку</h4>
                    <p className="text-white/40 text-sm mb-4">
                      Отправь часть своей подписки другу.
                    </p>

                    <div className="mb-4">
                      <label className="text-white/40 text-xs mb-1 block">Получатель</label>
                      <input
                        type="text"
                        value={giftUser}
                        onChange={(e) => setGiftUser(e.target.value)}
                        placeholder="Имя пользователя"
                        className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
                      />
                    </div>

                    <div className="mb-4">
                      <label className="text-white/40 text-xs mb-1 block">Дней</label>
                      <input
                        type="number"
                        min={1}
                        max={90}
                        value={giftDays || ""}
                        onChange={(e) => setGiftDays(Number(e.target.value))}
                        placeholder="30"
                        className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
                      />
                    </div>

                    {giftMsg && (
                      <p className={`text-sm mb-3 ${giftMsg.includes("✓") ? "text-green-400" : "text-red-400"}`}>{giftMsg}</p>
                    )}

                    <button
                      onClick={giftSubscription}
                      disabled={giftLoading || !giftUser.trim() || giftDays < 1}
                      className="w-full py-3 rounded-xl font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition"
                    >
                      {giftLoading ? "Отправка..." : "Подарить"}
                    </button>
                  </div>
                </div>
              </div>
              )}

              {tab === "stats" && (
              <div className="mb-12">
                <h3 className="text-3xl font-bold mb-1">Статистика</h3>
                <p className="text-white/40 mb-6">
                  Твоя активность в клиенте.
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <InfoTile
                    icon={<VideoCamera size={18} />}
                    label="Запусков"
                    value={String(playStats?.launches ?? 0)}
                  />
                  <InfoTile
                    icon={<Key size={18} />}
                    label="Время в игре"
                    value={formatPlayTime(playStats?.seconds ?? 0)}
                  />
                </div>
              </div>
              )}

              {tab === "history" && (
              <div className="mb-12">
                <h3 className="text-3xl font-bold mb-1">История операций</h3>
                <p className="text-white/40 mb-6">
                  Все движения по балансу.
                </p>

                {history.length === 0 ? (
                  <p className="text-white/40">Пока нет операций.</p>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-white/40 border-b border-white/10">
                          <th className="px-4 py-3">Операция</th>
                          <th className="px-4 py-3">Сумма</th>
                          <th className="px-4 py-3">Дата</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((h) => (
                          <tr key={h.id} className="border-b border-white/5">
                            <td className="px-4 py-3">
                              <div>{typeLabels[h.type] || h.type}</div>
                              {h.note && <div className="text-white/40 text-xs">{h.note}</div>}
                            </td>
                            <td className={`px-4 py-3 font-semibold ${h.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                              {h.amount > 0 ? `+${h.amount}₽` : `${h.amount}₽`}
                            </td>
                            <td className="px-4 py-3 text-white/40">
                              {new Date(h.created_at.replace(" ", "T")).toLocaleDateString("ru-RU")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              )}

              {tab === "reward" && (
              <div className="mb-12">
                <h3 className="text-3xl font-bold mb-1">Ежедневная награда</h3>
                <p className="text-white/40 mb-6">
                  Цикл из 7 наград выдаётся один раз за аккаунт. Пропуск дня не сбрасывает прогресс.
                </p>

                <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7">
                  <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3 mb-5">
                    {(reward?.rewards ?? []).map((r) => {
                      const isPast = reward
                        ? reward.finished
                          ? true
                          : reward.claimedToday
                            ? r.day <= reward.day
                            : r.day < reward.day
                        : false;
                      const isCurrent = reward ? !reward.finished && r.day === reward.day : false;
                      return (
                        <div
                          key={r.day}
                          className={`rounded-2xl border p-3 min-w-0 overflow-hidden text-center transition ${
                            isCurrent
                              ? "border-purple-400/60 bg-purple-500/15"
                              : isPast
                                ? "border-green-500/30 bg-green-500/10"
                                : "border-white/10 bg-white/[0.03]"
                          }`}
                        >
                          <p className={`text-xs uppercase mb-1 ${isCurrent ? "text-purple-300" : "text-white/40"}`}>
                            День {r.day}
                          </p>
                          <p className={`text-xs font-semibold break-words hyphens-auto ${isCurrent ? "text-white" : "text-white/60"}`}>
                            {r.label}
                          </p>
                          {isPast && <p className="text-green-400 text-xs mt-1">Получено</p>}
                          {isCurrent && !reward?.claimedToday && (
                            <p className="text-purple-300 text-xs mt-1">Доступно</p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {rewardMsg && (
                    <p className={`text-sm mb-3 ${rewardMsg.includes("✓") ? "text-green-400" : "text-red-400"}`}>{rewardMsg}</p>
                  )}

                  <button
                    onClick={claimReward}
                    disabled={rewardLoading || !reward || reward.claimedToday || reward.finished}
                    className="w-full py-3 rounded-xl font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition"
                  >
                    {rewardLoading
                      ? "Получение..."
                      : !reward
                        ? "Загрузка..."
                        : reward.finished
                          ? "Все награды получены ✓"
                          : reward.claimedToday
                            ? "Награда за сегодня получена"
                            : `Получить награду — день ${reward.day}`}
                  </button>
                </div>
              </div>
              )}

              {tab === "partners" && user?.role !== "media" && user?.role !== "tester" && (
              <div className="mb-12">
                {partnerStage === "list" ? (
                  <>
                    <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
                      <div>
                        <h3 className="text-3xl font-bold mb-1">Система Партнерства</h3>
                        <p className="text-white/40">
                          Медиапартнёрство с Stellar делится на несколько уровней. В зависимости от уровня партнёрства вы будете получать разное вознаграждение.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => { setPartnerPlatform("youtube"); setPartnerStage("info"); }}
                          className="px-5 py-3 rounded-2xl font-medium bg-purple-600 hover:bg-purple-700 transition whitespace-nowrap"
                        >
                          Стать партнёром (YouTube)
                        </button>
                        <button
                          onClick={() => { setPartnerPlatform("tiktok"); setPartnerStage("info"); }}
                          className="px-5 py-3 rounded-2xl font-medium bg-white/10 hover:bg-white/15 border border-white/10 transition whitespace-nowrap"
                        >
                          Стать партнёром (TikTok)
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setPartnerStage("list")}
                      className="inline-flex items-center gap-2 text-white/50 hover:text-white transition text-sm mb-6"
                    >
                      <ArrowLeft size={16} weight="bold" />Назад
                    </button>

                    <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
                      <div>
                        <h3 className="text-3xl font-bold mb-1">Виды партнёрства</h3>
                        <p className="text-white/40">
                          Медиапартнёрство с Stellar делится на несколько уровней. В зависимости от уровня партнёрства вы будете получать разное вознаграждение.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setPartnerStage("list")}
                          className="px-5 py-3 rounded-2xl font-medium bg-white/10 hover:bg-white/15 border border-white/10 transition whitespace-nowrap"
                        >
                          Закрыть
                        </button>
                        <button
                          onClick={() => router.push(`/dashboard/partner?platform=${partnerPlatform}`)}
                          className="px-5 py-3 rounded-2xl font-medium bg-purple-600 hover:bg-purple-700 transition whitespace-nowrap"
                        >
                          Подать заявку на партнёра
                        </button>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6">
                        <h4 className="text-xl font-bold mb-3">Младший партнер</h4>
                        <ul className="space-y-2 text-white/70 text-sm leading-relaxed">
                          <li>
                            •{" "}
                            {partnerPlatform === "youtube"
                              ? "До 100 просмотров на ролике в среднем"
                              : "До 300 просмотров на ролике в среднем"}
                          </li>
                          <li>
                            •{" "}
                            {partnerPlatform === "youtube"
                              ? "Менее 300 рублей выручка за просмотры"
                              : "Менее 500 рублей выручка за просмотры"}
                          </li>
                          <li>• Съемка с оплатой</li>
                          <li>• Возможность получить подписку бесплатно</li>
                          <li>• Количество видеороликов заранее обговаривается</li>
                        </ul>
                      </div>

                      <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6">
                        <h4 className="text-xl font-bold mb-3">Партнер</h4>
                        <ul className="space-y-2 text-white/70 text-sm leading-relaxed">
                          <li>
                            •{" "}
                            {partnerPlatform === "youtube"
                              ? "7 видео по 250 просмотров"
                              : "10 видео по 1000 просмотров"}
                          </li>
                          <li>
                            •{" "}
                            {partnerPlatform === "youtube"
                              ? "Менее 1000 рублей выручка за просмотры"
                              : "Менее 2000 рублей выручка за просмотры"}
                          </li>
                          <li>• Съемка с оплатой</li>
                          <li>• Возможность получить подписку бесплатно</li>
                          <li>• Количество видеороликов заранее обговаривается</li>
                        </ul>
                      </div>

                      <p className="text-white/30 text-xs">
                        Другие уровни партнёрства скоро появятся.
                      </p>
                    </div>
                  </>
                )}
              </div>
              )}

              {tab === "media" && user?.role === "media" && (
              <div className="mb-12">
                <h3 className="text-3xl font-bold mb-1">Медиа Отдел</h3>
                <p className="text-white/40 mb-6">
                  Твой ранг партнёрства и отправка видео на проверку.
                </p>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  <InfoTile
                    icon={<ShieldCheck size={18} />}
                    label="Ранг партнёрства"
                    value={mediaRank || user?.partner_rank || "Младший партнёр"}
                  />
                  <InfoTile
                    icon={<VideoCamera size={18} />}
                    label="Соцсеть"
                    value={mediaPlatformLabel}
                  />
                  <InfoTile
                    icon={<Eye size={18} />}
                    label="Всего просмотров"
                    value={formatNum(mediaTotalViews)}
                  />
                  <InfoTile
                    icon={<CheckCircle size={18} />}
                    label="Одобрено видео"
                    value={`${mediaApprovedCount} / ${mediaVideoThreshold}`}
                  />
                  <InfoTile
                    icon={<Wallet size={18} />}
                    label="Заработано"
                    value={`${formatNum(mediaEarned)} ₽`}
                  />
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 mb-8">
                  <p className="font-semibold mb-4">
                    {mediaPromoted ? "Максимальный ранг — Партнёр" : "До ранга «Партнёр»"}
                  </p>

                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-white/60">Одобренных видео</span>
                      <span className="text-white/80">{mediaApprovedCount} / {mediaVideoThreshold}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-black/40 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500 transition-all"
                        style={{ width: `${mediaPromoted ? 100 : mediaVideoPct}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-white/60">Просмотров суммарно</span>
                      <span className="text-white/80">{formatNum(mediaTotalViews)} / {formatNum(mediaViewsThreshold)}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-black/40 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-500 transition-all"
                        style={{ width: `${mediaPromoted ? 100 : mediaViewsPct}%` }}
                      />
                    </div>
                  </div>

                  <p className="text-white/30 text-xs mt-4">
                    {mediaPromoted
                      ? "Ты на максимальном ранге партнёрства."
                      : `Нужно одновременно: ${mediaVideoThreshold} одобренных видео и ${formatNum(mediaViewsThreshold)} просмотров.`}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7 mb-8">
                  <h4 className="text-xl font-bold mb-4">Отправить видео</h4>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="url"
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                      placeholder="https://youtube.com/watch?v=..."
                      className="flex-1 bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
                    />
                    <button
                      onClick={submitMedia}
                      disabled={mediaLoading || !mediaUrl.trim()}
                      className="px-6 py-3 rounded-xl font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition whitespace-nowrap"
                    >
                      {mediaLoading ? "..." : "Отправить"}
                    </button>
                  </div>
                  {mediaMsg && (
                    <p className={`mt-3 text-sm ${mediaMsg.includes("✓") ? "text-green-400" : "text-red-400"}`}>{mediaMsg}</p>
                  )}
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7">
                  <h4 className="text-xl font-bold mb-4">Мои заявки</h4>
                  {mediaSubs.length === 0 ? (
                    <p className="text-white/30 text-center py-6">Нет заявок</p>
                  ) : (
                    <div className="space-y-3">
                      {mediaSubs.map((s) => (
                        <div key={s.id} className="bg-black/30 rounded-xl p-4 border border-white/5 flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <a href={s.video_url} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 text-sm truncate block">
                              {s.video_url}
                            </a>
                            <p className="text-white/30 text-xs mt-1">{new Date(s.created_at).toLocaleDateString("ru-RU")}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {s.status === "approved" && s.views > 0 && (
                              <span className="text-white/40 text-xs">{formatNum(s.views)} просм.</span>
                            )}
                            {s.status === "approved" && s.reward > 0 && (
                              <span className="text-green-400 text-sm font-semibold">+{s.reward} ₽</span>
                            )}
                            <span className="flex items-center gap-1 text-xs">
                              {s.status === "approved" ? (
                                <CheckCircle size={16} className="text-green-400" />
                              ) : s.status === "rejected" ? (
                                <XCircle size={16} className="text-red-400" />
                              ) : (
                                <Clock size={16} className="text-yellow-400" />
                              )}
                              <span className="text-white/50">
                                {s.status === "approved" ? "Одобрено" : s.status === "rejected" ? "Отклонено" : "На рассмотрении"}
                              </span>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              )}

              {tab === "tester" && user?.role === "tester" && (
              <div className="mb-12">
                <h3 className="text-3xl font-bold mb-1">Тестовый отдел</h3>
                <p className="text-white/40 mb-6">Сообщайте о найденных багах.</p>

                <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7 mb-8">
                  <h4 className="text-xl font-bold mb-4">Новый баг-репорт</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-white/50 text-sm mb-2">Введите айпи сервера где произошел баг:</label>
                      <input
                        type="text"
                        value={bugIp}
                        onChange={(e) => setBugIp(e.target.value)}
                        placeholder="192.168.1.1"
                        className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-white/50 text-sm mb-2">Какая функция с багом:</label>
                      <input
                        type="text"
                        value={bugFunction}
                        onChange={(e) => setBugFunction(e.target.value)}
                        placeholder="Например: aimbot, ESP, лаунчер..."
                        className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-white/50 text-sm mb-2">Когда происходит баг: редко, часто</label>
                      <select
                        value={bugFrequency}
                        onChange={(e) => setBugFrequency(e.target.value)}
                        className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-white"
                      >
                        <option value="редко">Редко</option>
                        <option value="часто">Часто</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-white/50 text-sm mb-2">Опишите проблему:</label>
                      <textarea
                        value={bugDescription}
                        onChange={(e) => setBugDescription(e.target.value)}
                        rows={4}
                        placeholder="Подробное описание проблемы, шаги для воспроизведения..."
                        className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none resize-none"
                      />
                    </div>
                    <button
                      onClick={submitBugReport}
                      disabled={bugLoading}
                      className="px-6 py-3 rounded-xl font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition"
                    >
                      {bugLoading ? "..." : "Отправить баг-репорт"}
                    </button>
                    {bugMsg && (
                      <p className={`text-sm ${bugMsg.includes("✓") ? "text-green-400" : "text-red-400"}`}>{bugMsg}</p>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7">
                  <h4 className="text-xl font-bold mb-4">Мои баг-репорты</h4>
                  {bugReports.length === 0 ? (
                    <p className="text-white/30 text-center py-6">Нет репортов</p>
                  ) : (
                    <div className="space-y-3">
                      {bugReports.map((r) => (
                        <div key={r.id} className="bg-black/30 rounded-xl p-4 border border-white/5">
                          <div className="flex items-center justify-between gap-4 mb-2">
                            <p className="font-semibold text-sm">{r.function_name} — {r.server_ip}</p>
                            <span className="flex items-center gap-1 text-xs shrink-0">
                              {r.status === "fixed" ? (
                                <CheckCircle size={16} className="text-green-400" />
                              ) : r.status === "in_progress" ? (
                                <Clock size={16} className="text-yellow-400" />
                              ) : (
                                <XCircle size={16} className="text-red-400" />
                              )}
                              <span className="text-white/50">
                                {r.status === "fixed" ? "Исправлено" : r.status === "in_progress" ? "В работе" : "Новый"}
                              </span>
                            </span>
                          </div>
                          <p className="text-white/40 text-sm">{r.description}</p>
                          <p className="text-white/25 text-xs mt-2">
                            Частота: {r.frequency} · {new Date(r.created_at).toLocaleDateString("ru-RU")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              )}

              {tab === "actions" && (
              <div>
                <h3 className="text-3xl font-bold mb-1">Действия</h3>
                <p className="text-white/40 mb-6">Быстрые переходы в нужные разделы.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ActionCard
                    href="/pricing"
                    icon={<ShoppingCartSimple size={22} />}
                    title="Продукты"
                    desc="Подписки и товары"
                  />
                  <ActionCard
                    href="/dashboard/addons"
                    icon={<Cube size={22} />}
                    title="Дополнения"
                    desc="Ключ и смена пароля"
                  />
                  {hasSub ? (
                    <ActionCard
                      href="https://drive.google.com/uc?export=download&id=1aTDsNJiaJVAYsJ7WYJUnR6PUQ0I7oMZV"
                      icon={<DownloadSimple size={22} />}
                      title="Скачать лаунчер"
                      desc="Загрузить последнюю версию"
                    />
                  ) : (
                    <ActionCard
                      href="/pricing"
                      icon={<ShoppingCartSimple size={22} />}
                      title="Скачать лаунчер"
                      desc="Требуется подписка"
                    />
                  )}
                  {user?.role === "admin" && (
                    <ActionCard
                      href="/dashboard/admin"
                      icon={<Shield size={22} />}
                      title="Админ панель"
                      desc="Управление пользователями и ключами"
                    />
                  )}
                </div>
              </div>
              )}
                </div>
              </div>
            </div>
          </main>

          <Footer />
        </>
      )}
    </>
  );
}

function InfoTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 grid place-items-center mb-4 text-white/70">
        {icon}
      </div>
      <p className="text-white/40 text-sm mb-1">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function ActionCard({
  href,
  icon,
  title,
  desc,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
    >
      <Link
        href={href}
        className="group relative flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition p-6 overflow-hidden"
      >
        <div className="relative flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 grid place-items-center text-white/70 group-hover:text-purple-300 transition">
            {icon}
          </div>
          <div>
            <p className="font-semibold">{title}</p>
            <p className="text-white/40 text-sm">{desc}</p>
          </div>
        </div>
        <ArrowUpRight
          size={20}
          className="relative text-white/30 group-hover:text-white/70 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
        />
      </Link>
    </motion.div>
  );
}
