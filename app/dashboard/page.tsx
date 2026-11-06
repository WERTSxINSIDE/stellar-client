"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Loader from "@/components/Loader";
import DailyQuests from "@/components/DailyQuests";
import Exchange from "@/components/Exchange";
import { useI18n, type Lang } from "@/lib/i18n";
import { achievementEn } from "@/lib/achievements";
import { localizeApiError } from "@/lib/api-error";
import { LAUNCHER_DOWNLOAD_PATH } from "@/lib/launcher";
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
  Trophy,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  CircleNotch,
  Copy,
  Check,
  LinkSimple,
  Devices,
  Trash,
  Bell,
  Sparkle,
  Books,
  TelegramLogo,
  Coins,
  Megaphone,
  ArrowsLeftRight,
  ChatCircleDots,
  Crosshair,
} from "@phosphor-icons/react";

function tx(lang: Lang, ru: string, en: string) {
  return lang === "en" ? en : ru;
}

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
  sc_coins?: number;
  platform?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  banner_url?: string | null;
  accent_color?: string | null;
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
  type: "balance" | "spin";
  amount?: number;
  spins?: number;
  label: string;
};

type AchievementItem = {
  key: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  unit: "count" | "rub" | "seconds" | "days";
  target: number;
  progress: number;
  unlocked: boolean;
  unlocked_at: string | null;
  hidden?: boolean;
  season?: string | null;
  available?: boolean;
};

const RARITY_STYLES: Record<string, string> = {
  common: "border-white/15 bg-white/[0.04]",
  rare: "border-sky-400/30 bg-sky-500/10",
  epic: "border-purple-400/30 bg-purple-500/10",
  legendary: "border-amber-400/40 bg-amber-500/10",
};

function formatAchievementValue(
  value: number,
  unit: AchievementItem["unit"],
  lang: Lang
) {
  const locale = lang === "en" ? "en-US" : "ru-RU";
  if (unit === "rub") return `${value.toLocaleString(locale)} ₽`;
  if (unit === "days") return `${value.toLocaleString(locale)} ${tx(lang, "дн.", "days")}`;
  if (unit === "seconds") {
    if (value >= 3600)
      return `${Math.floor(value / 3600).toLocaleString(locale)} ${tx(lang, "ч", "h")}`;
    return `${Math.max(1, Math.round(value / 60)).toLocaleString(locale)} ${tx(lang, "мин", "min")}`;
  }
  return value.toLocaleString(locale);
}

function formatUnlockDate(value: string, lang: Lang) {
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(lang === "en" ? "en-GB" : "ru-RU");
}

/** Обрезает фото в квадрат и сжимает в JPEG, чтобы аватар влезал в БД. */
function resizeAvatarFile(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();

    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("canvas");

        const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        ctx.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);

        URL.revokeObjectURL(objectUrl);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("image"));
    };

    image.src = objectUrl;
  });
}

/** Обрезает баннер в пропорции 3:1 (1200×400) и сжимает в JPEG. */
function resizeBannerFile(file: File, width = 1200, height = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();

    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("canvas");

        const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
        const drawWidth = image.naturalWidth * scale;
        const drawHeight = image.naturalHeight * scale;
        ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);

        URL.revokeObjectURL(objectUrl);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("image"));
    };

    image.src = objectUrl;
  });
}

export default function Dashboard() {
  const { lang } = useI18n();
  const tr = (ru: string, en: string) => tx(lang, ru, en);
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<Me>(null);
  const [transferUser, setTransferUser] = useState("");
  const [transferAmount, setTransferAmount] = useState(0);
  const [transferMsg, setTransferMsg] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);
  const [giftUser, setGiftUser] = useState("");
  const [giftDays, setGiftDays] = useState(7);
  const [giftMsg, setGiftMsg] = useState("");
  const [giftLoading, setGiftLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [playStats, setPlayStats] = useState<{ seconds: number; launches: number } | null>(null);
  const [reward, setReward] = useState<{ day: number; claimedToday: boolean; finished: boolean; claimsLeft: number; limit: number; rewards: RewardInfo[] } | null>(null);
  const [wheel, setWheel] = useState<{ canSpin: boolean; hoursLeft: number; spins: number; cooldownHours: number; prizes: { key: string; label: string; chance: number }[] } | null>(null);
  const [wheelSpin, setWheelSpin] = useState(false);
  const [wheelRot, setWheelRot] = useState(0);
  const [wheelResult, setWheelResult] = useState<string | null>(null);
  const [wheelMsg, setWheelMsg] = useState("");
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
  const [achievements, setAchievements] = useState<{ items: AchievementItem[]; unlocked: number; total: number } | null>(null);
  const [newAchievements, setNewAchievements] = useState<AchievementItem[]>([]);

  type ReferralData = {
    link: string;
    rules: {
      signup_bonus: number;
      key_percent: number;
      milestone_step: number;
      milestone_bonus: number;
      signup_sc: number;
      key_sc_percent: number;
      milestone_sc: number;
    };
    stats: {
      invited: number;
      valid_invited: number;
      fraud_invited: number;
      signup_total: number;
      key_total: number;
      milestone_total: number;
      total: number;
      sc_signup_total: number;
      sc_key_total: number;
      sc_milestone_total: number;
      sc_total: number;
      next_milestone_in: number;
    };
    invited: { username: string; created_at: string; referral_fraud: number }[];
  };
  type SessionItem = {
    id: string;
    created_at: string;
    user_agent: string | null;
    ip: string | null;
    current: boolean;
  };

  const [referral, setReferral] = useState<ReferralData | null>(null);
  const [refCopied, setRefCopied] = useState(false);
  const [sessions, setSessions] = useState<SessionItem[] | null>(null);
  const [sessionsMsg, setSessionsMsg] = useState("");
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [twofaEnabled, setTwofaEnabled] = useState<boolean | null>(null);
  const [twofaStep, setTwofaStep] = useState<"idle" | "code">("idle");
  const [twofaCode, setTwofaCode] = useState("");
  const [twofaPassword, setTwofaPassword] = useState("");
  const [twofaMsg, setTwofaMsg] = useState("");
  const [twofaLoading, setTwofaLoading] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoMsg, setPromoMsg] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);

  type NotificationData = {
    email: string;
    categories: {
      key: string;
      label: string;
      labelEn?: string;
      description: string;
      descriptionEn?: string;
    }[];
    settings: Record<string, boolean>;
  };

  const [notif, setNotif] = useState<NotificationData | null>(null);
  const [notifMsg, setNotifMsg] = useState("");
  const [notifLoading, setNotifLoading] = useState<string | null>(null);

  type MyClanCard = {
    id: number;
    name: string;
    tag: string;
    emblem: string;
    color: string;
    role: string;
    level: number;
    member_count: number;
    max_members: number;
    bonus_percent: number;
    xp: number;
    treasury: number;
  };
  const [myClan, setMyClan] = useState<MyClanCard | null>(null);

  type TelegramState = {
    enabled: boolean;
    linked: boolean;
    username: string | null;
  };

  const [telegram, setTelegram] = useState<TelegramState | null>(null);
  const [telegramMsg, setTelegramMsg] = useState("");
  const [telegramBusy, setTelegramBusy] = useState(false);
  const [avatarDraft, setAvatarDraft] = useState("");
  const [bioDraft, setBioDraft] = useState("");
  const [bannerDraft, setBannerDraft] = useState("");
  const [accentDraft, setAccentDraft] = useState("#a855f7");
  const [profileMsg, setProfileMsg] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [bannerBusy, setBannerBusy] = useState(false);
  const [bannerError, setBannerError] = useState("");
  const [bioBusy, setBioBusy] = useState(false);
  const [bioError, setBioError] = useState("");

  useEffect(() => {
    const tabParam = new URLSearchParams(window.location.search).get("tab");
    const allowed = [
      "account",
      "reward",
      "quests",
      "balance",
      "exchange",
      "stats",
      "achievements",
      "history",
      "referral",
      "security",
      "notifications",
      "partners",
      "media",
      "tester",
      "actions",
    ];
    if (tabParam && allowed.includes(tabParam)) setTab(tabParam);
  }, []);

  useEffect(() => {
    fetch("/api/me?profile=1")
      .then((r) => r.json())
      .then((data) => {
        if (!data.user) router.replace("/login");
        else {
          setUser(data.user);
          setAvatarDraft(data.user.avatar_url || "");
          setBioDraft(data.user.bio || "");
          setBannerDraft(data.user.banner_url || "");
          setAccentDraft(data.user.accent_color || "#a855f7");
        }
      });
    fetch("/api/balance-history")
      .then((r) => r.json())
      .then((d) => d.ok && setHistory(d.history));
    fetch("/api/play-session")
      .then((r) => r.json())
      .then((d) => d.ok && setPlayStats(d.stats));
    fetch("/api/daily-reward")
      .then((r) => r.json())
      .then((d) => d.ok && setReward({ day: d.day, claimedToday: d.claimedToday, finished: d.finished, claimsLeft: d.claims_left ?? 0, limit: d.limit ?? 7, rewards: d.rewards }));
    fetch("/api/wheel")
      .then((r) => r.json())
      .then((d) => d.ok && setWheel(d));
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
    fetch("/api/achievements")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) return;
        setAchievements({ items: d.achievements, unlocked: d.stats.unlocked, total: d.stats.total });
        if (Array.isArray(d.newlyUnlocked) && d.newlyUnlocked.length) {
          const keys = new Set<string>(d.newlyUnlocked);
          setNewAchievements(
            (d.achievements as AchievementItem[]).filter((a) => keys.has(a.key))
          );
        }
      });
    fetch("/api/referral")
      .then((r) => r.json())
      .then((d) => d.ok && setReferral(d))
      .catch(() => {});
    fetch("/api/clans")
      .then((r) => r.json())
      .then((d) => d.ok && setMyClan(d.my_clan || null))
      .catch(() => {});
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((d) => d.ok && setSessions(d.sessions))
      .catch(() => {});
    fetch("/api/2fa")
      .then((r) => r.json())
      .then((d) => d.ok && setTwofaEnabled(!!d.enabled))
      .catch(() => {});
    fetch("/api/notification-settings")
      .then((r) => r.json())
      .then((d) => d.ok && setNotif({ email: d.email, categories: d.categories, settings: d.settings }))
      .catch(() => {});
    fetch("/api/telegram/link")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setTelegram({ enabled: !!d.enabled, linked: !!d.linked, username: d.username ?? null });
      })
      .catch(() => {});
  }, [router]);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function copyReferral() {
    if (!referral) return;
    try {
      await navigator.clipboard.writeText(referral.link);
      setRefCopied(true);
      setTimeout(() => setRefCopied(false), 2000);
    } catch {
      setRefCopied(false);
    }
  }

  async function revokeSession(id: string) {
    setSessionsMsg("");
    setSessionsLoading(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSessionsMsg(localizeApiError(data.error, lang) || tr("Не удалось завершить сессию", "Could not end the session"));
        return;
      }
      setSessions((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
      setSessionsMsg(tr("Сессия завершена", "Session ended"));
    } catch {
      setSessionsMsg(tr("Ошибка сети", "Network error"));
    } finally {
      setSessionsLoading(false);
    }
  }

  async function revokeOtherSessions() {
    setSessionsMsg("");
    setSessionsLoading(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSessionsMsg(localizeApiError(data.error, lang) || tr("Не удалось завершить сессии", "Could not end other sessions"));
        return;
      }
      setSessions((prev) => (prev ? prev.filter((s) => s.current) : prev));
      setSessionsMsg(tr("Остальные устройства отключены", "Other devices disconnected"));
    } catch {
      setSessionsMsg(tr("Ошибка сети", "Network error"));
    } finally {
      setSessionsLoading(false);
    }
  }

  async function requestTwofaCode() {
    setTwofaMsg("");
    setTwofaLoading(true);
    try {
      const res = await fetch("/api/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTwofaMsg(localizeApiError(data.error, lang) || tr("Не удалось отправить код", "Could not send the code"));
        return;
      }
      setTwofaStep("code");
      setTwofaMsg(tr("Код отправлен на почту", "Code sent to your email"));
    } catch {
      setTwofaMsg(tr("Ошибка сети", "Network error"));
    } finally {
      setTwofaLoading(false);
    }
  }

  async function enableTwofa() {
    setTwofaMsg("");
    setTwofaLoading(true);
    try {
      const res = await fetch("/api/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enable", code: twofaCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTwofaMsg(localizeApiError(data.error, lang) || tr("Не удалось включить 2FA", "Could not enable 2FA"));
        return;
      }
      setTwofaEnabled(true);
      setTwofaStep("idle");
      setTwofaCode("");
      setTwofaMsg(tr("Двухфакторная защита включена", "Two-factor protection enabled"));
    } catch {
      setTwofaMsg(tr("Ошибка сети", "Network error"));
    } finally {
      setTwofaLoading(false);
    }
  }

  async function disableTwofa() {
    setTwofaMsg("");
    setTwofaLoading(true);
    try {
      const res = await fetch("/api/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable", password: twofaPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTwofaMsg(localizeApiError(data.error, lang) || tr("Не удалось отключить 2FA", "Could not disable 2FA"));
        return;
      }
      setTwofaEnabled(false);
      setTwofaPassword("");
      setTwofaMsg(tr("Двухфакторная защита отключена", "Two-factor protection disabled"));
    } catch {
      setTwofaMsg(tr("Ошибка сети", "Network error"));
    } finally {
      setTwofaLoading(false);
    }
  }

  async function activatePromo() {
    setPromoMsg("");
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    try {
      const res = await fetch("/api/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPromoMsg(localizeApiError(data.error, lang) || tr("Не удалось активировать промокод", "Could not activate the promo code"));
        return;
      }
      setPromoMsg(tr(`Промокод активирован ✓ +${data.amount} ₽`, `Promo code activated ✓ +${data.amount} ₽`));
      setPromoCode("");
      setUser((prev) => (prev ? { ...prev, balance: data.balance ?? prev.balance } : prev));
      fetch("/api/balance-history")
        .then((r) => r.json())
        .then((d) => d.ok && setHistory(d.history));
    } catch {
      setPromoMsg(tr("Ошибка сети", "Network error"));
    } finally {
      setPromoLoading(false);
    }
  }

  async function handleAvatarFile(file: File | null) {
    setAvatarError("");
    if (!file) return;

    if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) {
      setAvatarError(tr("Подойдут JPG, PNG, WebP или GIF", "JPG, PNG, WebP or GIF only"));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setAvatarError(tr("Файл больше 8 МБ — выберите изображение поменьше", "File is larger than 8 MB — choose a smaller image"));
      return;
    }

    setAvatarBusy(true);
    try {
      const dataUrl = await resizeAvatarFile(file);
      setAvatarDraft(dataUrl);
    } catch {
      setAvatarError(tr("Не удалось обработать изображение", "Could not process the image"));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleBannerFile(file: File | null) {
    setBannerError("");
    if (!file) return;

    if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) {
      setBannerError(tr("Подойдут JPG, PNG, WebP или GIF", "JPG, PNG, WebP or GIF only"));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setBannerError(tr("Файл больше 8 МБ — выберите изображение поменьше", "File is larger than 8 MB — choose a smaller image"));
      return;
    }

    setBannerBusy(true);
    try {
      const dataUrl = await resizeBannerFile(file);
      setBannerDraft(dataUrl);
    } catch {
      setBannerError(tr("Не удалось обработать изображение", "Could not process the image"));
    } finally {
      setBannerBusy(false);
    }
  }

  async function generateBio() {
    setBioError("");
    setBioBusy(true);
    try {
      const res = await fetch("/api/me/bio");
      const data = await res.json();
      if (!res.ok) {
        setBioError(localizeApiError(data.error, lang) || tr("Не удалось сгенерировать описание", "Could not generate the bio"));
        return;
      }
      setBioDraft(String(data.bio || "").slice(0, 300));
    } catch {
      setBioError(tr("Ошибка сети", "Network error"));
    } finally {
      setBioBusy(false);
    }
  }

  async function saveProfile() {
    setProfileMsg("");
    setProfileLoading(true);
    try {
      const res = await fetch("/api/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatar_url: avatarDraft,
          bio: bioDraft,
          banner_url: bannerDraft,
          accent_color: accentDraft,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfileMsg(localizeApiError(data.error, lang) || tr("Не удалось сохранить профиль", "Could not save the profile"));
        return;
      }
      setUser((prev) =>
        prev
          ? {
              ...prev,
              avatar_url: data.user?.avatar_url ?? null,
              bio: data.user?.bio ?? null,
              banner_url: data.user?.banner_url ?? null,
              accent_color: data.user?.accent_color ?? null,
            }
          : prev
      );
      setAvatarDraft(data.user?.avatar_url || "");
      setBioDraft(data.user?.bio || "");
      setBannerDraft(data.user?.banner_url || "");
      setAccentDraft(data.user?.accent_color || "#a855f7");
      setProfileMsg(tr("Профиль обновлён ✓", "Profile updated ✓"));
    } catch {
      setProfileMsg(tr("Ошибка сети", "Network error"));
    } finally {
      setProfileLoading(false);
    }
  }

  async function toggleNotification(category: string, value: boolean) {
    setNotifMsg("");
    setNotifLoading(category);
    setNotif((prev) =>
      prev
        ? { ...prev, settings: { ...prev.settings, [`email_${category}`]: value } }
        : prev
    );
    try {
      const res = await fetch("/api/notification-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [category]: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotif((prev) =>
          prev
            ? { ...prev, settings: { ...prev.settings, [`email_${category}`]: !value } }
            : prev
        );
        setNotifMsg(localizeApiError(data.error, lang) || tr("Не удалось сохранить настройку", "Could not save the setting"));
        return;
      }
      setNotif({ email: data.email, categories: data.categories, settings: data.settings });
    } catch {
      setNotif((prev) =>
        prev
          ? { ...prev, settings: { ...prev.settings, [`email_${category}`]: !value } }
          : prev
      );
      setNotifMsg(tr("Ошибка сети", "Network error"));
    } finally {
      setNotifLoading(null);
    }
  }

  async function refreshTelegram() {
    setTelegramMsg("");
    setTelegramBusy(true);
    try {
      const res = await fetch("/api/telegram/link", { cache: "no-store" });
      const data = await res.json();
      if (data.ok) {
        setTelegram({
          enabled: !!data.enabled,
          linked: !!data.linked,
          username: data.username ?? null,
        });
        setTelegramMsg(
          data.linked
            ? tr("Telegram привязан ✓", "Telegram linked ✓")
            : tr("Пока не привязан", "Not linked yet")
        );
      }
    } catch {
      setTelegramMsg(tr("Ошибка сети", "Network error"));
    } finally {
      setTelegramBusy(false);
    }
  }

  async function connectTelegram() {
    setTelegramMsg("");
    setTelegramBusy(true);
    try {
      const res = await fetch("/api/telegram/link", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setTelegramMsg(
          localizeApiError(data.error, lang) ||
            tr("Не удалось создать ссылку на бота", "Could not create the bot link")
        );
        return;
      }
      window.open(data.url, "_blank", "noopener,noreferrer");
      setTelegramMsg(
        tr(
          "Откройте Telegram, нажмите «Start», затем вернитесь и обновите статус.",
          "Open Telegram, press “Start”, then come back and refresh the status."
        )
      );
    } catch {
      setTelegramMsg(tr("Ошибка сети", "Network error"));
    } finally {
      setTelegramBusy(false);
    }
  }

  async function unlinkTelegram() {
    setTelegramMsg("");
    setTelegramBusy(true);
    try {
      const res = await fetch("/api/telegram/link", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setTelegramMsg(
          localizeApiError(data.error, lang) ||
            tr("Не удалось отвязать Telegram", "Could not unlink Telegram")
        );
        return;
      }
      setTelegram((prev) =>
        prev ? { ...prev, linked: false, username: null } : prev
      );
      setTelegramMsg(tr("Telegram отвязан.", "Telegram unlinked."));
    } catch {
      setTelegramMsg(tr("Ошибка сети", "Network error"));
    } finally {
      setTelegramBusy(false);
    }
  }

  function describeDevice(userAgent: string | null) {
    if (!userAgent) return tr("Неизвестное устройство", "Unknown device");
    const ua = userAgent.toLowerCase();
    const os = ua.includes("windows")
      ? "Windows"
      : ua.includes("android")
      ? "Android"
      : ua.includes("iphone") || ua.includes("ipad")
      ? "iOS"
      : ua.includes("mac os")
      ? "macOS"
      : ua.includes("linux")
      ? "Linux"
      : tr("Устройство", "Device");
    const browser = ua.includes("edg/")
      ? "Edge"
      : ua.includes("chrome") && !ua.includes("chromium")
      ? "Chrome"
      : ua.includes("firefox")
      ? "Firefox"
      : ua.includes("safari") && !ua.includes("chrome")
      ? "Safari"
      : tr("Браузер", "Browser");
    return `${os} · ${browser}`;
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
        setTransferMsg(localizeApiError(data.error, lang) || tr("Ошибка", "Error"));
        return;
      }
      setTransferMsg(tr(`Перевод выполнен ✓ Новый баланс: ${data.balance}₽`, `Transfer complete ✓ New balance: ${data.balance}₽`));
      setUser((prev) => prev ? { ...prev, balance: data.balance } : prev);
      setTransferUser("");
      setTransferAmount(0);
    } catch {
      setTransferMsg(tr("Ошибка сервера", "Server error"));
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
        setGiftMsg(localizeApiError(data.error, lang) || tr("Ошибка", "Error"));
        return;
      }
      setGiftMsg(tr(`Подарок отправлен ✓`, `Gift sent ✓`));
      fetch("/api/me?profile=1")
        .then((r) => r.json())
        .then((d) => d.user && setUser(d.user));
      setGiftUser("");
      setGiftDays(7);
    } catch {
      setGiftMsg(tr("Ошибка сервера", "Server error"));
    } finally {
      setGiftLoading(false);
    }
  }

  async function submitBugReport() {
    setBugMsg("");
    if (!bugIp.trim() || !bugFunction.trim() || !bugDescription.trim()) {
      setBugMsg(tr("Заполните все поля", "Fill in all fields"));
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
        setBugMsg(localizeApiError(data.error, lang) || tr("Ошибка", "Error"));
        return;
      }
      setBugMsg(tr("Баг-репорт отправлен ✓", "Bug report sent ✓"));
      setBugIp("");
      setBugFunction("");
      setBugFrequency("редко");
      setBugDescription("");
      const list = await fetch("/api/bug-report").then((r) => r.json());
      if (list.ok) setBugReports(list.reports || []);
    } catch {
      setBugMsg(tr("Ошибка сервера", "Server error"));
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
        setRewardMsg(localizeApiError(data.error, lang) || tr("Ошибка", "Error"));
        return;
      }
      setRewardMsg(tr(`Награда получена ✓ ${data.message}`, `Reward claimed ✓ ${data.message}`));
      setReward((prev) => prev ? { ...prev, claimedToday: true, finished: !!data.finished, claimsLeft: data.claims_left ?? Math.max(0, prev.claimsLeft - 1) } : prev);
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
      setRewardMsg(tr("Ошибка сервера", "Server error"));
    } finally {
      setRewardLoading(false);
    }
  }

  function refreshWheel() {
    fetch("/api/wheel")
      .then((r) => r.json())
      .then((d) => d.ok && setWheel(d));
  }

  async function spinWheel() {
    if (!wheel || wheelSpin) return;
    if (!(wheel.spins > 0 || wheel.hoursLeft === 0)) return;
    setWheelSpin(true);
    setWheelResult(null);
    setWheelMsg("");
    try {
      const res = await fetch("/api/wheel", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setWheelMsg(localizeApiError(data.error, lang) || tr("Ошибка", "Error"));
        setWheelSpin(false);
        refreshWheel();
        return;
      }
      const WSEG = 360 / 11;
      const center = (data.index ?? 0) * WSEG + WSEG / 2;
      const jitter = Math.random() * 24 - 12;
      const currentMod = ((wheelRot % 360) + 360) % 360;
      const desired = (360 - center + jitter + 360) % 360;
      const delta = (((desired - currentMod) % 360) + 360) % 360 + 360 * 5;
      setWheelRot(wheelRot + delta);
      setTimeout(() => {
        setWheelResult(data.prize.label);
        setWheelSpin(false);
        if (data.subscription_end) {
          setUser((prev) => (prev ? { ...prev, subscription_end: data.subscription_end } : prev));
        }
        refreshWheel();
      }, 4200);
    } catch {
      setWheelMsg(tr("Ошибка сервера", "Server error"));
      setWheelSpin(false);
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
        setMediaMsg(localizeApiError(data.error, lang) || tr("Ошибка", "Error"));
        return;
      }
      setMediaMsg(tr("Видео отправлено ✓", "Video submitted ✓"));
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
      setMediaMsg(tr("Ошибка сервера", "Server error"));
    } finally {
      setMediaLoading(false);
    }
  }

  function formatPlayTime(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h} ${tr("ч", "h")} ${m} ${tr("мин", "min")}`;
    return `${m} ${tr("мин", "min")}`;
  }

  const typeLabels: Record<string, string> = {
    subscription: tr("Подписка", "Subscription"),
    transfer: tr("Перевод", "Transfer"),
    media: tr("Видео", "Video"),
    topup: tr("Пополнение", "Top-up"),
    reward: tr("Ежедневная награда", "Daily reward"),
    hwid: tr("Сброс HWID", "HWID reset"),
    referral: tr("Реферальный бонус", "Referral bonus"),
    referral_key: tr("Реферальные 15%", "Referral 15%"),
    referral_milestone: tr("Бонус за приглашения", "Invite milestone bonus"),
    promo: tr("Промокод", "Promo code"),
    wheel: tr("Колесо фортуны", "Wheel of fortune"),
    showcase: tr("Награда за материал", "Material reward"),
    showcase_sale: tr("Продажа конфига", "Config sale"),
    showcase_purchase: tr("Покупка конфига", "Config purchase"),
  };

  // Производные данные аккаунта
  const reg = user ? new Date(user.created_at.replace(" ", "T")) : new Date();
  const regStr = user ? formatDate(reg) : "—";
  const subEnd = user?.subscription_end ? new Date(user.subscription_end.replace(" ", "T")) : null;
  const now = new Date();
  const hasSub = subEnd && subEnd > now;
  const subStr = user ? (hasSub ? formatDate(subEnd) : tr("Нет подписки", "No subscription")) : "—";
  const hwid = user?.hwid ?? "—";

  const roleLabels: Record<string, string> = {
    user: tr("Пользователь", "User"),
    media: tr("Медиа", "Media"),
    tester: tr("Тестер", "Tester"),
    admin: tr("Администратор", "Administrator"),
  };

  const mediaApprovedCount = mediaSubs.filter((s) => s.status === "approved").length;
  const mediaPromoted = mediaRank === "Партнёр" || mediaRank === "Partner";
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
  const formatNum = (n: number) => n.toLocaleString(lang === "en" ? "en-US" : "ru-RU");

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
                    {tr("Личный кабинет", "Dashboard")}
                  </p>
                  <h1 className="text-5xl font-extrabold">{tr("Профиль", "Profile")}</h1>
                </div>
                <button
                  onClick={logout}
                  className="flex items-center gap-2 text-sm font-medium px-5 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
                >
                  <SignOut size={18} weight="bold" />
                  {tr("Выйти", "Sign out")}
                </button>
              </div>

              <div className="flex flex-col lg:flex-row gap-8 items-start">
                {/* Боковое меню */}
                <aside className="w-full lg:w-72 shrink-0 lg:sticky lg:top-32">
                  <nav className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-3 flex lg:flex-col gap-1.5 overflow-x-auto">
                    {[
                      { id: "account", label: tr("Аккаунт", "Account"), icon: <User size={18} /> },
                      { id: "reward", label: tr("Ежедневная награда", "Daily reward"), icon: <Gift size={18} />, dot: !!reward && !reward.finished && !reward.claimedToday },
                      { id: "quests", label: tr("Квесты", "Quests"), icon: <CheckCircle size={18} /> },
                      { id: "balance", label: tr("Баланс", "Balance"), icon: <Wallet size={18} /> },
                      { id: "exchange", label: tr("Обменник", "Exchange"), icon: <ArrowsLeftRight size={18} /> },
                      { id: "stats", label: tr("Статистика", "Statistics"), icon: <ChartBar size={18} /> },
                      { id: "achievements", label: tr("Достижения", "Achievements"), icon: <Trophy size={18} />, dot: newAchievements.length > 0 },
                      { id: "history", label: tr("История операций", "Transaction history"), icon: <ClockCounterClockwise size={18} /> },
                      { id: "referral", label: tr("Рефералка", "Referrals"), icon: <LinkSimple size={18} /> },
                      { id: "security", label: tr("Безопасность", "Security"), icon: <Shield size={18} /> },
                      { id: "notifications", label: tr("Уведомления", "Notifications"), icon: <Bell size={18} /> },
                      {
                        id:
                          user?.role === "media"
                            ? "media"
                            : user?.role === "tester"
                            ? "tester"
                            : "partners",
                        label:
                          user?.role === "media"
                            ? tr("Медиа Отдел", "Media Department")
                            : user?.role === "tester"
                            ? tr("Тестовый отдел", "Testing Department")
                            : tr("Система Партнерства", "Partnership System"),
                        icon: user?.role === "media" ? <VideoCamera size={18} /> : <UsersThree size={18} />,
                      },
                      { id: "actions", label: tr("Действия", "Actions"), icon: <SquaresFour size={18} /> },
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

                  <Link
                    href="/dashboard/library"
                    className="mt-3 flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/10 bg-white/[0.04] text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.07] transition"
                  >
                    <Books size={18} />
                    {tr("Мои покупки", "My purchases")}
                  </Link>

                  <Link
                    href="/dashboard/cosmetics"
                    className="mt-2 flex items-center gap-3 px-4 py-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 text-sm font-medium text-amber-100/80 hover:text-amber-100 hover:bg-amber-500/15 transition"
                  >
                    <Coins size={18} />
                    <span className="flex-1">{tr("Косметика", "Cosmetics")}</span>
                    <span className="rounded-md border border-amber-400/25 bg-black/25 px-2 py-0.5 text-[11px] font-bold text-amber-200">
                      {Number(user?.sc_coins || 0)} SC
                    </span>
                  </Link>

                  <Link
                    href="/dashboard/partner-codes"
                    className="mt-2 flex items-center gap-3 px-4 py-3 rounded-2xl border border-purple-400/20 bg-purple-500/10 text-sm font-medium text-purple-100/80 hover:text-purple-100 hover:bg-purple-500/15 transition"
                  >
                    <Megaphone size={18} />
                    {tr("Коды стримера", "Streamer codes")}
                  </Link>

                  <Link
                    href="/dashboard/battle-pass"
                    className="mt-2 flex items-center gap-3 px-4 py-3 rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 text-sm font-medium text-fuchsia-100/80 hover:text-fuchsia-100 hover:bg-fuchsia-500/15 transition"
                  >
                    <Trophy size={18} />
                    {tr("Батл-пасс", "Battle pass")}
                  </Link>

                  <Link
                    href="/dashboard/friends"
                    className="mt-2 flex items-center gap-3 px-4 py-3 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-sm font-medium text-cyan-100/80 hover:text-cyan-100 hover:bg-cyan-500/15 transition"
                  >
                    <UsersThree size={18} />
                    {tr("Друзья", "Friends")}
                  </Link>

                  <Link
                    href="/dashboard/party"
                    className="mt-2 flex items-center gap-3 px-4 py-3 rounded-2xl border border-teal-400/20 bg-teal-500/10 text-sm font-medium text-teal-100/80 hover:text-teal-100 hover:bg-teal-500/15 transition"
                  >
                    <Crosshair size={18} />
                    {tr("Пати и метки", "Party and markers")}
                  </Link>

                  <Link
                    href="/dashboard/gifts"
                    className="mt-2 flex items-center gap-3 px-4 py-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 text-sm font-medium text-rose-100/80 hover:text-rose-100 hover:bg-rose-500/15 transition"
                  >
                    <Gift size={18} />
                    {tr("Подарки", "Gifts")}
                  </Link>

                  {/* Колесо фортуны */}
                  <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[11px] uppercase tracking-widest text-white/40">{tr("Колесо фортуны", "Wheel of fortune")}</p>
                      <Link href="/dashboard/wheel" className="text-xs text-purple-300 hover:text-purple-200 transition">
                        {tr("Шансы", "Odds")}
                      </Link>
                    </div>

                    <div className="relative w-40 h-40 mx-auto mb-4">
                      <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-10 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[14px] border-l-transparent border-r-transparent border-t-white drop-shadow" />
                      <div
                        className="w-full h-full rounded-full border-4 border-white/20 shadow-[0_0_30px_rgba(124,58,237,0.3)]"
                        style={{
                          background: `conic-gradient(from 0deg, ${Array.from({ length: 11 })
                            .map((_, i) => {
                              const s = 360 / 11;
                              return `${i % 2 ? "#4338ca" : "#7c3aed"} ${i * s}deg ${(i + 1) * s}deg`;
                            })
                            .join(", ")})`,
                          transform: `rotate(${wheelRot}deg)`,
                          transition: wheelSpin ? "transform 4.1s cubic-bezier(0.12, 0.6, 0.1, 1)" : "none",
                        }}
                      >
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#0b0b14] border-2 border-white/30 z-[1] grid place-items-center text-xs font-black">
                          SC
                        </div>
                      </div>
                    </div>

                    {wheelResult && (
                      <p className="text-center text-sm font-semibold text-purple-300 mb-2">{tr("Выпало:", "Result:")} {wheelResult}</p>
                    )}
                    {wheelMsg && <p className="text-center text-xs text-red-400 mb-2">{wheelMsg}</p>}

                    <button
                      onClick={spinWheel}
                      disabled={wheelSpin || !wheel || !(wheel.spins > 0 || wheel.hoursLeft === 0)}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
                    >
                      {wheelSpin ? (
                        <>
                          <CircleNotch size={16} className="animate-spin" /> {tr("Крутим...", "Spinning...")}
                        </>
                      ) : !wheel ? (
                        tr("Загрузка...", "Loading...")
                      ) : wheel.spins > 0 ? (
                        tr(`Крутить (круток: ${wheel.spins})`, `Spin (spins: ${wheel.spins})`)
                      ) : wheel.hoursLeft > 0 ? (
                        tr(`Крутка через ${wheel.hoursLeft} ч.`, `Next spin in ${wheel.hoursLeft} h.`)
                      ) : (
                        tr("Крутить бесплатно", "Spin for free")
                      )}
                    </button>
                    <p className="text-center text-[11px] text-white/30 mt-2">
                      {tr("Бесплатно раз в", "Free every")} {wheel?.cooldownHours ?? 72} {tr("часа", "hours")}
                    </p>
                  </div>
                </aside>

                {/* Основной контент */}
                <div className="flex-1 min-w-0">
              {/* Карточка пользователя */}
              <div className="relative rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7 mb-12 overflow-hidden">
                <div className="flex items-center justify-between gap-6 flex-wrap">
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-full overflow-hidden border border-white/15 shrink-0 bg-white/5">
                      {user?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={user.avatar_url}
                          alt={user.username}
                          className="w-16 h-16 object-cover"
                        />
                      ) : (
                        <Image
                          src="/icon.png"
                          alt="avatar"
                          width={64}
                          height={64}
                          className="object-cover"
                        />
                      )}
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
                      {tr("Подписка", "Subscription")}
                    </p>
                    <p className="text-xl font-semibold">{subStr}</p>
                  </div>
                </div>
              </div>

              {tab === "account" && (
              <div className="mb-12">
                <h3 className="text-3xl font-bold mb-1">{tr("Аккаунт", "Account")}</h3>
                <p className="text-white/40 mb-6">
                  {tr("Подписка, доступ и состояние защиты аккаунта.", "Subscription, access and account protection status.")}
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <InfoTile
                    icon={<ShoppingCartSimple size={18} />}
                    label={tr("Подписка", "Subscription")}
                    value={subStr}
                  />
                  <InfoTile
                    icon={<CalendarBlank size={18} />}
                    label={tr("Регистрация", "Registration")}
                    value={regStr}
                  />
                  <InfoTile
                    icon={<Key size={18} />}
                    label={tr("Доступ", "Access")}
                    value={tr("Активен", "Active")}
                  />
                  <InfoTile
                    icon={<Hash size={18} />}
                    label="UID"
                    value={String(user?.id ?? "—")}
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span
                        className="w-12 h-12 shrink-0 rounded-xl grid place-items-center text-xl border"
                        style={{
                          borderColor: myClan ? `${myClan.color}55` : "rgba(255,255,255,0.1)",
                          background: myClan ? `${myClan.color}22` : "rgba(255,255,255,0.04)",
                        }}
                      >
                        {myClan ? myClan.emblem : <Shield size={20} className="text-white/30" />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wider text-white/35">
                          {tr("Мой клан", "My clan")}
                        </p>
                        {myClan ? (
                          <>
                            <p className="font-semibold truncate">
                              {myClan.name}{" "}
                              <span className="text-xs font-mono text-purple-300">[{myClan.tag}]</span>
                            </p>
                            <p className="text-[11px] text-white/40">
                              {tr("уровень", "level")} {myClan.level} · {myClan.xp} XP ·{" "}
                              {myClan.member_count}/{myClan.max_members} {tr("участников", "members")} · +
                              {myClan.bonus_percent}% SC
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-white/50">
                            {tr("Вы пока не состоите в клане.", "You are not in a clan yet.")}
                          </p>
                        )}
                      </div>
                    </div>
                    <Link
                      href={myClan ? `/clans/${myClan.id}` : "/clans"}
                      className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl border border-purple-400/30 bg-purple-500/10 hover:bg-purple-500/20 px-4 py-2.5 text-sm font-semibold text-purple-100 transition"
                    >
                      {myClan ? tr("Открыть клан", "Open clan") : tr("Найти клан", "Find a clan")}
                      <ArrowUpRight size={15} />
                    </Link>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-center gap-2 text-white/40 text-sm mb-2">
                    <Fingerprint size={18} />
                    HWID
                  </div>
                  <p className="font-mono text-lg break-all">{hwid}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mt-4">
                  <div className="flex items-center gap-2 text-white/40 text-sm mb-4">
                    <User size={18} />
                    {tr("Публичный профиль", "Public profile")}
                  </div>
                  <p className="text-white/40 text-sm mb-4">
                    {tr("Аватар и био видны всем на странице", "Avatar and bio are visible to everyone on")}{" "}
                    <Link
                      href={`/u/${encodeURIComponent(user?.username || "")}`}
                      className="text-purple-300 hover:text-purple-200 transition"
                    >
                      /u/{user?.username}
                    </Link>
                    {tr(". Почта, баланс и HWID не показываются.", ". Email, balance and HWID are not shown.")}
                  </p>

                  <div className="mb-5">
                    <label className="text-white/40 text-xs mb-2 block">{tr("Баннер профиля", "Profile banner")}</label>
                    <div className="relative w-full aspect-[3/1] rounded-2xl overflow-hidden border border-white/10 bg-black/40 mb-3">
                      {bannerDraft.trim() ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={bannerDraft.trim()}
                          alt={tr("Баннер", "Banner")}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-full h-full"
                          style={{
                            background: `linear-gradient(135deg, ${accentDraft}66 0%, ${accentDraft}22 45%, rgba(10,10,10,0.9) 100%)`,
                          }}
                        />
                      )}
                      {bannerBusy && (
                        <div className="absolute inset-0 grid place-items-center bg-black/50 text-sm text-white/70">
                          {tr("Обработка...", "Processing...")}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label
                        className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition cursor-pointer ${
                          bannerBusy
                            ? "bg-white/5 border-white/10 text-white/40 cursor-wait"
                            : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                        }`}
                      >
                        {bannerBusy ? tr("Обработка...", "Processing...") : tr("Загрузить баннер", "Upload banner")}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          disabled={bannerBusy}
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            void handleBannerFile(file);
                            e.target.value = "";
                          }}
                          className="hidden"
                        />
                      </label>
                      {bannerDraft && (
                        <button
                          type="button"
                          onClick={() => {
                            setBannerDraft("");
                            setBannerError("");
                          }}
                          disabled={bannerBusy}
                          className="px-3 py-2.5 rounded-xl text-xs font-semibold text-red-300 bg-red-500/10 border border-red-400/25 hover:bg-red-500/20 transition"
                        >
                          {tr("Удалить баннер", "Remove banner")}
                        </button>
                      )}
                      <span className="text-[11px] text-white/30">
                        {tr("3:1, до 8 МБ — обрежется автоматически", "3:1, up to 8 MB — cropped automatically")}
                      </span>
                    </div>

                    <input
                      type="url"
                      value={bannerDraft.startsWith("http") ? bannerDraft : ""}
                      onChange={(e) => {
                        setBannerError("");
                        setBannerDraft(e.target.value.slice(0, 800));
                      }}
                      placeholder={tr("Или ссылка на баннер: https://...", "Or banner link: https://...")}
                      maxLength={800}
                      className="w-full mt-2 bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-sm"
                    />
                    {bannerError && <p className="text-sm text-red-400 mt-2">{bannerError}</p>}
                  </div>

                  <div className="mb-5">
                    <label className="text-white/40 text-xs mb-2 block">{tr("Цвет акцента", "Accent color")}</label>
                    <div className="flex flex-wrap items-center gap-2">
                      {["#a855f7", "#38bdf8", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6", "#eab308"].map(
                        (color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setAccentDraft(color)}
                            aria-label={tr(`Цвет ${color}`, `Color ${color}`)}
                            className={`w-8 h-8 rounded-full border-2 transition ${
                              accentDraft.toLowerCase() === color
                                ? "border-white scale-110"
                                : "border-white/20 hover:border-white/50"
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        )
                      )}
                      <label className="flex items-center gap-2 ml-1 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white/60 cursor-pointer">
                        {tr("Свой", "Custom")}
                        <input
                          type="color"
                          value={accentDraft}
                          onChange={(e) => setAccentDraft(e.target.value)}
                          className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 mb-4">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/15 bg-white/5 shrink-0 grid place-items-center">
                      {avatarDraft.trim() ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatarDraft.trim()}
                          alt={tr("Аватар", "Avatar")}
                          className="w-16 h-16 object-cover"
                        />
                      ) : (
                        <User size={26} className="text-white/30" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="text-white/40 text-xs mb-1 block">
                        {tr("Фото с устройства", "Photo from device")}
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        <label
                          className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition cursor-pointer ${
                            avatarBusy
                              ? "bg-white/5 border-white/10 text-white/40 cursor-wait"
                              : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                          }`}
                        >
                          {avatarBusy ? tr("Обработка...", "Processing...") : tr("Выбрать файл", "Choose file")}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            disabled={avatarBusy}
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              void handleAvatarFile(file);
                              e.target.value = "";
                            }}
                            className="hidden"
                          />
                        </label>
                        {avatarDraft && (
                          <button
                            type="button"
                            onClick={() => {
                              setAvatarDraft("");
                              setAvatarError("");
                            }}
                            disabled={avatarBusy}
                            className="px-3 py-2.5 rounded-xl text-xs font-semibold text-red-300 bg-red-500/10 border border-red-400/25 hover:bg-red-500/20 transition"
                          >
                            {tr("Удалить аватар", "Remove avatar")}
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-white/30 mt-2">
                        {tr("JPG, PNG, WebP или GIF до 8 МБ. Фото автоматически обрежется в квадрат", "JPG, PNG, WebP or GIF up to 8 MB. The photo is cropped to a square")}
                        {tr("и сожмётся до 256×256.", "and compressed to 256×256.")}
                      </p>

                      <label className="text-white/40 text-xs mb-1 mt-3 block">
                        {tr("Или прямая ссылка на изображение", "Or a direct image link")}
                      </label>
                      <input
                        type="url"
                        value={avatarDraft.startsWith("http") ? avatarDraft : ""}
                        onChange={(e) => {
                          setAvatarError("");
                          setAvatarDraft(e.target.value.slice(0, 500));
                        }}
                        placeholder="https://example.com/avatar.png"
                        maxLength={500}
                        className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-sm"
                      />

                      {avatarError && (
                        <p className="text-sm text-red-400 mt-2">{avatarError}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                    <label className="text-white/40 text-xs block">{tr("Био", "Bio")}</label>
                    <button
                      type="button"
                      onClick={generateBio}
                      disabled={bioBusy}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-500/15 text-purple-200 border border-purple-400/25 hover:bg-purple-500/25 disabled:opacity-50 transition"
                    >
                      {bioBusy ? tr("Генерация...", "Generating...") : tr("Сгенерировать из статистики", "Generate from stats")}
                    </button>
                  </div>
                  <textarea
                    value={bioDraft}
                    onChange={(e) => setBioDraft(e.target.value.slice(0, 300))}
                    rows={3}
                    maxLength={300}
                    placeholder={tr("Пара слов о себе", "A few words about yourself")}
                    className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-sm resize-none"
                  />
                  {bioError && <p className="text-sm text-red-400 mt-2">{bioError}</p>}
                  <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
                    <span className="text-xs text-white/30">{bioDraft.length} / 300</span>
                    <button
                      type="button"
                      onClick={saveProfile}
                      disabled={profileLoading}
                      className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition"
                    >
                      {profileLoading ? tr("Сохранение...", "Saving...") : tr("Сохранить профиль", "Save profile")}
                    </button>
                  </div>
                  {profileMsg && (
                    <p
                      className={`text-sm mt-3 ${
                        profileMsg.includes("✓") ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {profileMsg}
                    </p>
                  )}
                </div>
              </div>
              )}

              {tab === "balance" && (
              <div className="mb-12">
                <h3 className="text-3xl font-bold mb-1">{tr("Баланс", "Balance")}</h3>
                <p className="text-white/40 mb-6">
                  {tr("Перевод средств и подарки подписки.", "Transfer funds and gift subscriptions.")}
                </p>

                <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7 mb-6 flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/30 grid place-items-center text-purple-300 shrink-0">
                      <Wallet size={22} />
                    </div>
                    <div>
                      <p className="text-white/40 text-xs tracking-widest uppercase mb-1">{tr("Текущий баланс", "Current balance")}</p>
                      <p className="text-3xl font-bold">{user?.balance ?? 0} ₽</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7 mb-6 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h4 className="text-xl font-bold mb-1">{tr("Пополнить баланс", "Top up balance")}</h4>
                    <p className="text-white/40 text-sm">
                      {tr("Суммы 50–400 ₽. Оплата через FunPay, затем активируйте промокод ниже.", "Amounts 50–400 ₽. Pay via FunPay, then activate the promo code below.")}
                    </p>
                  </div>
                  <Link
                    href="/pricing#topup"
                    className="inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 px-5 py-3 text-sm font-semibold transition"
                  >
                    {tr("Перейти к пополнению", "Go to top-up")} <ArrowUpRight size={16} />
                  </Link>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7 mb-6">
                  <h4 className="text-xl font-bold mb-1">{tr("Промокод", "Promo code")}</h4>
                  <p className="text-white/40 text-sm mb-4">
                    {tr("Введите промокод — бонус сразу зачислится на баланс.", "Enter a promo code — the bonus is credited to your balance immediately.")}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 max-w-xl">
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      placeholder="STELLAR50"
                      className="flex-1 bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none uppercase tracking-wide"
                    />
                    <button
                      type="button"
                      onClick={activatePromo}
                      disabled={promoLoading || !promoCode.trim()}
                      className="shrink-0 px-6 py-3 rounded-xl font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition"
                    >
                      {promoLoading ? tr("Активация...", "Activating...") : tr("Активировать", "Activate")}
                    </button>
                  </div>
                  {promoMsg && (
                    <p className={`text-sm mt-3 ${promoMsg.includes("✓") ? "text-green-400" : "text-red-400"}`}>
                      {promoMsg}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Перевод баланса */}
                  <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7">
                    <h4 className="text-xl font-bold mb-4">{tr("Перевести баланс", "Transfer balance")}</h4>

                    <div className="mb-4">
                      <label className="text-white/40 text-xs mb-1 block">{tr("Получатель", "Recipient")}</label>
                      <input
                        type="text"
                        value={transferUser}
                        onChange={(e) => setTransferUser(e.target.value)}
                        placeholder={tr("Имя пользователя", "Username")}
                        className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
                      />
                    </div>

                    <div className="mb-4">
                      <label className="text-white/40 text-xs mb-1 block">{tr("Сумма (₽)", "Amount (₽)")}</label>
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
                      {transferLoading ? tr("Отправка...", "Sending...") : tr("Перевести", "Transfer")}
                    </button>
                  </div>

                  {/* Подарок подписки */}
                  <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7">
                    <h4 className="text-xl font-bold mb-4">{tr("Подарить подписку", "Gift a subscription")}</h4>
                    <p className="text-white/40 text-sm mb-4">
                      {tr("Обычная подписка: от 1 до 7 дней. Навсегда: до 30 дней.", "Regular subscription: 1 to 7 days. Forever: up to 30 days.")}
                      {tr("Отправка — раз в 3 месяца.", "Can be sent once every 3 months.")}
                    </p>

                    <div className="mb-4">
                      <label className="text-white/40 text-xs mb-1 block">{tr("Получатель", "Recipient")}</label>
                      <input
                        type="text"
                        value={giftUser}
                        onChange={(e) => setGiftUser(e.target.value)}
                        placeholder={tr("Имя пользователя", "Username")}
                        className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
                      />
                    </div>

                    <div className="mb-4">
                      <label className="text-white/40 text-xs mb-1 block">{tr("Дней", "Days")}</label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={giftDays || ""}
                        onChange={(e) => setGiftDays(Number(e.target.value))}
                        placeholder="7"
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
                      {giftLoading ? tr("Отправка...", "Sending...") : tr("Подарить", "Gift")}
                    </button>
                  </div>
                </div>
              </div>
              )}

              {tab === "exchange" && (
              <div className="mb-12">
                <h3 className="text-3xl font-bold mb-1">{tr("Обменник", "Exchange")}</h3>
                <p className="text-white/40 mb-6">
                  {tr("Меняйте рубли на SC и обратно. Курс фиксированный: 50 SC = 1 ₽.", "Swap rubles and SC. Fixed rate: 50 SC = 1 ₽.")}
                </p>
                <Exchange
                  onBalances={({ balance, sc_coins }) =>
                    setUser((prev) => (prev ? { ...prev, balance, sc_coins } : prev))
                  }
                />
              </div>
              )}

              {tab === "stats" && (
              <div className="mb-12">
                <h3 className="text-3xl font-bold mb-1">{tr("Статистика", "Statistics")}</h3>
                <p className="text-white/40 mb-6">
                  {tr("Твоя активность в клиенте.", "Your activity in the client.")}
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <InfoTile
                    icon={<VideoCamera size={18} />}
                    label={tr("Запусков", "Launches")}
                    value={String(playStats?.launches ?? 0)}
                  />
                  <InfoTile
                    icon={<Key size={18} />}
                    label={tr("Время в игре", "Time in game")}
                    value={formatPlayTime(playStats?.seconds ?? 0)}
                  />
                </div>
              </div>
              )}

              {tab === "achievements" && (
              <div className="mb-12">
                <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-3xl font-bold mb-1">{tr("Достижения", "Achievements")}</h3>
                    <p className="text-white/40">{tr("Награды за активность, покупки и вклад в сообщество.", "Rewards for activity, purchases and contributions to the community.")}</p>
                  </div>
                  {achievements && (
                    <div className="text-right">
                      <p className="text-3xl font-bold text-purple-300">
                        {achievements.unlocked}
                        <span className="text-xl text-white/30">/{achievements.total}</span>
                      </p>
                      <p className="text-[11px] uppercase tracking-widest text-white/40">{tr("открыто", "unlocked")}</p>
                    </div>
                  )}
                </div>

                {achievements && (
                  <div className="mb-6">
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-400 transition-all"
                        style={{
                          width: `${Math.round((achievements.unlocked / achievements.total) * 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-white/40 mt-2">
                      {Math.round((achievements.unlocked / achievements.total) * 100)}% {tr("коллекции собрано", "of the collection collected")}
                    </p>
                  </div>
                )}

                {achievements && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                    {[
                      { id: "start", label: tr("Старт", "Start"), icon: "🚀" },
                      { id: "money", label: tr("Покупки", "Purchases"), icon: "🛒" },
                      { id: "activity", label: tr("Активность", "Activity"), icon: "🎯" },
                      { id: "loyalty", label: tr("Лояльность", "Loyalty"), icon: "⭐" },
                      { id: "social", label: tr("Сообщество", "Community"), icon: "🤝" },
                      { id: "secret", label: tr("Секретки", "Secrets"), icon: "🔒" },
                    ].map((cat) => {
                      const items = achievements.items.filter((a) => a.category === cat.id);
                      const done = items.filter((a) => a.unlocked).length;
                      const percent = items.length ? Math.round((done / items.length) * 100) : 0;
                      return (
                        <div
                          key={cat.id}
                          className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                        >
                          <div className="flex items-center gap-2 mb-2 min-w-0">
                            <span className="text-base shrink-0">{cat.icon}</span>
                            <p className="text-sm font-medium leading-snug break-words min-w-0">
                              {cat.label}
                            </p>
                          </div>
                          <p className="text-lg font-bold">
                            {done}
                            <span className="text-sm text-white/30">/{items.length}</span>
                          </p>
                          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-2">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-400"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {newAchievements.length > 0 && (
                  <div className="mb-6 rounded-2xl border border-green-500/30 bg-green-500/10 p-4 flex items-start gap-3">
                    <Trophy size={20} weight="fill" className="text-green-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-green-300">{tr("Новые достижения!", "New achievements!")}</p>
                      <p className="text-xs text-white/60 mt-0.5">
                        {newAchievements
                          .map((a) => (lang === "en" ? achievementEn(a.key)?.title : null) ?? a.title)
                          .join(", ")}
                      </p>
                    </div>
                  </div>
                )}

                {!achievements ? (
                  <p className="text-white/40">{tr("Загрузка достижений...", "Loading achievements...")}</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {achievements.items.map((a) => {
                      const percent = Math.min(
                        100,
                        Math.round((a.progress / a.target) * 100)
                      );
                      const copy = lang === "en" ? achievementEn(a.key) : null;
                      const masked = !!a.hidden && !a.unlocked;
                      const title = masked
                        ? tr("Секретное достижение", "Secret achievement")
                        : copy?.title ?? a.title;
                      const description = masked
                        ? tr(
                            "Откроется, когда выполните скрытое условие.",
                            "Unlocks when you meet the hidden condition."
                          )
                        : copy?.description ?? a.description;
                      return (
                        <div
                          key={a.key}
                          className={`min-w-0 overflow-hidden rounded-2xl border p-5 transition ${
                            a.unlocked
                              ? RARITY_STYLES[a.rarity] || RARITY_STYLES.common
                              : "border-white/10 bg-white/[0.02]"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-11 h-11 rounded-xl grid place-items-center text-xl shrink-0 ${
                                a.unlocked ? "bg-white/10" : "bg-white/5 grayscale opacity-60"
                              }`}
                            >
                              {masked ? "🔒" : a.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start gap-2 min-w-0">
                                <p
                                  className={`font-semibold leading-snug break-words min-w-0 flex-1 ${
                                    a.unlocked ? "text-white" : "text-white/60"
                                  }`}
                                >
                                  {title}
                                </p>
                                {a.unlocked && (
                                  <CheckCircle
                                    size={16}
                                    weight="fill"
                                    className="text-green-400 shrink-0 mt-0.5"
                                  />
                                )}
                              </div>
                              <p className="text-xs text-white/40 leading-relaxed break-words">
                                {description}
                              </p>
                              {a.season && (
                                <span className="mt-2 inline-flex items-center rounded-md border border-sky-400/25 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-200">
                                  {a.season}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="mt-4">
                            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  a.unlocked ? "bg-green-400" : "bg-purple-500"
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between mt-1.5 text-[11px] text-white/40">
                              <span>
                                {a.unlocked
                                  ? tr("Получено", "Unlocked")
                                  : masked
                                    ? tr("Скрытое условие", "Hidden condition")
                                    : a.available === false
                                      ? tr("Не в сезоне", "Out of season")
                                      : `${formatAchievementValue(a.progress, a.unit, lang)} / ${formatAchievementValue(a.target, a.unit, lang)}`}
                              </span>
                              {a.unlocked && a.unlocked_at && (
                                <span>{formatUnlockDate(a.unlocked_at, lang)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              )}

              {tab === "history" && (
              <div className="mb-12">
                <h3 className="text-3xl font-bold mb-1">{tr("История операций", "Transaction history")}</h3>
                <p className="text-white/40 mb-6">
                  {tr("Все движения по балансу.", "All balance movements.")}
                </p>

                {history.length === 0 ? (
                  <p className="text-white/40">{tr("Пока нет операций.", "No transactions yet.")}</p>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-white/40 border-b border-white/10">
                          <th className="px-4 py-3">{tr("Операция", "Operation")}</th>
                          <th className="px-4 py-3">{tr("Сумма", "Amount")}</th>
                          <th className="px-4 py-3">{tr("Дата", "Date")}</th>
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
                              {new Date(h.created_at.replace(" ", "T")).toLocaleDateString(lang === "en" ? "en-GB" : "ru-RU")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              )}

              {tab === "referral" && (
              <div className="mb-12">
                <h3 className="text-3xl font-bold mb-1">{tr("Рефералка", "Referrals")}</h3>
                <p className="text-white/40 mb-6">
                  {tr("Приглашайте друзей и получайте бонусы на баланс.", "Invite friends and earn balance bonuses.")}
                </p>

                {!referral ? (
                  <p className="text-white/40">{tr("Загрузка...", "Loading...")}</p>
                ) : (
                  <>
                    <div className="rounded-2xl border border-purple-500/30 bg-purple-500/[0.08] p-5 mb-4">
                      <p className="text-[11px] uppercase tracking-widest text-purple-300/70 mb-2">
                        {tr("Ваша ссылка", "Your link")}
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          readOnly
                          value={referral.link}
                          onFocus={(e) => e.currentTarget.select()}
                          className="flex-1 min-w-0 bg-black/40 px-4 py-3 rounded-xl border border-white/10 text-sm text-white/80 outline-none"
                        />
                        <button
                          type="button"
                          onClick={copyReferral}
                          className="shrink-0 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 transition"
                        >
                          {refCopied ? <Check size={16} weight="bold" /> : <Copy size={16} />}
                          {refCopied ? tr("Скопировано", "Copied") : tr("Копировать", "Copy")}
                        </button>
                      </div>
                      <p className="text-xs text-white/40 mt-3">
                        {tr("За регистрацию по ссылке —", "For signing up via the link —")} <span className="text-white/70 font-medium">+{referral.rules.signup_bonus} ₽</span>{" "}
                        {tr("и", "and")} <span className="text-white/70 font-medium">+{referral.rules.signup_sc} SC</span>.
                        {tr("Плюс", "Plus")} <span className="text-white/70 font-medium">{referral.rules.key_percent}%</span> {tr("от стоимости ключа,", "of the key price,")}
                        {tr("который активирует приглашённый. За каждые", "which the invitee activates. For every")}{" "}
                        <span className="text-white/70 font-medium">{referral.rules.milestone_step}</span> {tr("друзей — ещё", "friends — another")}{" "}
                        <span className="text-white/70 font-medium">+{referral.rules.milestone_bonus} ₽</span>{" "}
                        {tr("и", "and")} <span className="text-white/70 font-medium">+{referral.rules.milestone_sc} SC</span>.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-3">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-white/40 text-xs mb-1">{tr("Приглашено", "Invited")}</p>
                        <p className="text-xl font-bold">{referral.stats.invited}</p>
                        {referral.stats.fraud_invited > 0 && (
                          <p className="text-[11px] text-yellow-300/70 mt-1">
                            {referral.stats.fraud_invited} {tr("не засчитано", "not counted")}
                          </p>
                        )}
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-white/40 text-xs mb-1">{tr("За регистрации", "For sign-ups")}</p>
                        <p className="text-xl font-bold text-green-300">{referral.stats.signup_total} ₽</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-white/40 text-xs mb-1">{tr("С ключей", "From keys")}</p>
                        <p className="text-xl font-bold text-green-300">{referral.stats.key_total} ₽</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-white/40 text-xs mb-1">{tr("За ступени", "For milestones")}</p>
                        <p className="text-xl font-bold text-green-300">{referral.stats.milestone_total} ₽</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-white/40 text-xs mb-1">{tr("Всего заработано", "Total earned")}</p>
                        <p className="text-xl font-bold text-purple-300">{referral.stats.total} ₽</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                      <div className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.05] p-4">
                        <p className="text-white/40 text-xs mb-1">{tr("SC за регистрации", "SC for sign-ups")}</p>
                        <p className="text-xl font-bold text-amber-200">+{referral.stats.sc_signup_total}</p>
                      </div>
                      <div className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.05] p-4">
                        <p className="text-white/40 text-xs mb-1">{tr("SC с ключей", "SC from keys")}</p>
                        <p className="text-xl font-bold text-amber-200">+{referral.stats.sc_key_total}</p>
                      </div>
                      <div className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.05] p-4">
                        <p className="text-white/40 text-xs mb-1">{tr("SC за ступени", "SC for milestones")}</p>
                        <p className="text-xl font-bold text-amber-200">+{referral.stats.sc_milestone_total}</p>
                      </div>
                      <div className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.05] p-4">
                        <p className="text-white/40 text-xs mb-1">{tr("Всего SC", "Total SC")}</p>
                        <p className="text-xl font-bold text-amber-200">+{referral.stats.sc_total}</p>
                      </div>
                    </div>

                    <p className="text-xs text-white/40 mb-6">
                      {referral.stats.next_milestone_in === 0
                        ? tr(`Следующий бонус +${referral.rules.milestone_bonus} ₽ и +${referral.rules.milestone_sc} SC — ещё за ${referral.rules.milestone_step} друзей.`, `Next bonus +${referral.rules.milestone_bonus} ₽ and +${referral.rules.milestone_sc} SC — for ${referral.rules.milestone_step} more friends.`)
                        : tr(`До следующего бонуса +${referral.rules.milestone_bonus} ₽ и +${referral.rules.milestone_sc} SC осталось пригласить: ${referral.stats.next_milestone_in}.`, `${referral.stats.next_milestone_in} more invites until the next +${referral.rules.milestone_bonus} ₽ and +${referral.rules.milestone_sc} SC bonus.`)}
                    </p>

                    <h4 className="text-lg font-semibold mb-3">{tr("Приглашённые", "Invited users")}</h4>
                    {referral.invited.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-white/40">
                        {tr("Пока никого. Отправьте ссылку другу — бонус придёт сразу после его регистрации.", "Nobody yet. Send the link to a friend — the bonus arrives right after they sign up.")}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-white/40 border-b border-white/10">
                              <th className="px-4 py-3">{tr("Игрок", "Player")}</th>
                              <th className="px-4 py-3">{tr("Дата регистрации", "Sign-up date")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {referral.invited.map((inv) => (
                              <tr key={`${inv.username}-${inv.created_at}`} className="border-b border-white/5">
                                <td className="px-4 py-3">
                                  <Link
                                    href={`/u/${encodeURIComponent(inv.username)}`}
                                    className="font-semibold hover:text-purple-300 transition"
                                  >
                                    {inv.username}
                                    {inv.referral_fraud ? (
                                      <span className="ml-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-400/30 text-yellow-300">
                                        {tr("не засчитан", "not counted")}
                                      </span>
                                    ) : null}
                                  </Link>
                                </td>
                                <td className="px-4 py-3 text-white/40">
                                  {new Date(String(inv.created_at).replace(" ", "T")).toLocaleDateString(lang === "en" ? "en-GB" : "ru-RU")}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
              )}

              {tab === "notifications" && (
              <div className="mb-12">
                <h3 className="text-3xl font-bold mb-1">{tr("Уведомления", "Notifications")}</h3>
                <p className="text-white/40 mb-6">
                  {tr("Выберите, какие события дублировать на почту. В колокольчике в шапке сайта", "Choose which events are also sent by email. Notifications in the bell icon in the site header")}
                  {tr("уведомления приходят всегда.", "are always delivered.")}
                </p>

                <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 mb-6">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <span className="w-10 h-10 rounded-2xl bg-sky-500/15 border border-sky-400/25 flex items-center justify-center text-sky-300">
                      <TelegramLogo size={22} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold">{tr("Telegram-уведомления", "Telegram notifications")}</p>
                      <p className="text-white/40 text-sm">
                        {tr(
                          "Ответы поддержки и новые конфиги авторов приходят в чат — быстрее, чем на почту.",
                          "Support replies and new author configs arrive in chat — faster than email."
                        )}
                      </p>
                    </div>
                    {telegram?.linked && (
                      <span className="ml-auto text-xs px-2.5 py-1 rounded-full border border-green-400/30 bg-green-500/10 text-green-300">
                        {tr("Привязан", "Linked")}
                        {telegram.username ? ` · @${telegram.username}` : ""}
                      </span>
                    )}
                  </div>

                  {telegram && !telegram.enabled ? (
                    <p className="text-sm text-amber-300/80 mt-4">
                      {tr(
                        "Telegram пока не настроен администратором. Уведомления в колокольчике и на почте продолжают работать.",
                        "Telegram is not configured by the administrator yet. Bell and email notifications keep working."
                      )}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {telegram?.linked ? (
                        <>
                          <button
                            onClick={refreshTelegram}
                            disabled={telegramBusy}
                            className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 transition"
                          >
                            {tr("Обновить статус", "Refresh status")}
                          </button>
                          <button
                            onClick={unlinkTelegram}
                            disabled={telegramBusy}
                            className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-500/15 border border-red-400/30 text-red-300 hover:bg-red-500/25 disabled:opacity-50 transition"
                          >
                            {tr("Отвязать", "Unlink")}
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={connectTelegram}
                          disabled={telegramBusy}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-sky-600 hover:bg-sky-500 disabled:opacity-50 transition"
                        >
                          <TelegramLogo size={18} />
                          {tr("Привязать Telegram", "Link Telegram")}
                        </button>
                      )}
                      {telegramBusy && (
                        <span className="inline-flex items-center text-xs text-white/40">
                          {tr("Подождите...", "Please wait...")}
                        </span>
                      )}
                    </div>
                  )}

                  {telegramMsg && (
                    <p className="text-sm text-white/50 mt-3">{telegramMsg}</p>
                  )}
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6">
                  <div className="flex items-center gap-2 text-white/40 text-sm mb-5">
                    <Bell size={18} />
                    {tr("Письма на", "Emails to")} {notif?.email || user?.email || tr("почту", "your email")}
                  </div>

                  {!notif ? (
                    <p className="text-white/40 text-sm">{tr("Загрузка настроек...", "Loading settings...")}</p>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {notif.categories.map((category) => {
                        const key = `email_${category.key}`;
                        const enabled = !!notif.settings[key];
                        const busy = notifLoading === category.key;
                        return (
                          <div
                            key={category.key}
                            className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-sm">
                                {lang === "en" ? category.labelEn || category.label : category.label}
                              </p>
                              <p className="text-white/40 text-xs leading-relaxed mt-0.5">
                                {lang === "en"
                                  ? category.descriptionEn || category.description
                                  : category.description}
                              </p>
                            </div>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={enabled}
                              aria-label={lang === "en" ? category.labelEn || category.label : category.label}
                              disabled={busy}
                              onClick={() => toggleNotification(category.key, !enabled)}
                              className={`relative shrink-0 w-11 h-6 rounded-full border transition ${
                                enabled
                                  ? "bg-purple-600 border-purple-500"
                                  : "bg-white/10 border-white/15"
                              } ${busy ? "opacity-50" : ""}`}
                            >
                              <span
                                className={`absolute top-0.5 left-0.5 rounded-full bg-white shadow transition-transform ${
                                  enabled ? "translate-x-5" : "translate-x-0"
                                }`}
                                style={{ width: 18, height: 18 }}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <p className="text-xs text-white/30 mt-4 leading-relaxed">
                  {tr("В каждом письме есть ссылка для отписки — можно отключить отдельную категорию", "Every email has an unsubscribe link — you can disable a specific category")}
                  {tr("или все письма сразу. Это не влияет на уведомления в колокольчике.", "or all emails at once. This does not affect notifications in the bell icon.")}
                </p>

                {notifMsg && <p className="text-sm text-red-400 mt-3">{notifMsg}</p>}
              </div>
              )}

              {tab === "security" && (
              <div className="mb-12">
                <h3 className="text-3xl font-bold mb-1">{tr("Безопасность", "Security")}</h3>
                <p className="text-white/40 mb-6">
                  {tr("Устройства, с которых выполнен вход в аккаунт.", "Devices signed in to your account.")}
                </p>

                <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 mb-6">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-purple-600/20 border border-purple-500/30 grid place-items-center text-purple-300 shrink-0">
                      <ShieldCheck size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-lg font-bold">{tr("Двухфакторная защита", "Two-factor protection")}</h4>
                        {twofaEnabled !== null && (
                          <span
                            className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                              twofaEnabled
                                ? "bg-green-500/15 border-green-400/30 text-green-300"
                                : "bg-white/5 border-white/10 text-white/50"
                            }`}
                          >
                            {twofaEnabled ? tr("Включена", "Enabled") : tr("Выключена", "Disabled")}
                          </span>
                        )}
                      </div>
                      <p className="text-white/40 text-sm mt-1 max-w-xl">
                        {tr("При входе потребуется код из письма на", "Signing in requires a code sent to")} {user?.email ?? tr("вашу почту", "your email")}. {tr("Так аккаунт", "This way the account")}
                        {tr("не получится открыть, даже если пароль утёк.", "cannot be opened even if the password leaks.")}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    {twofaEnabled === null ? (
                      <p className="text-white/30 text-sm">{tr("Загрузка...", "Loading...")}</p>
                    ) : twofaEnabled ? (
                      <div className="flex flex-col sm:flex-row gap-2 max-w-md">
                        <input
                          type="password"
                          value={twofaPassword}
                          onChange={(e) => setTwofaPassword(e.target.value)}
                          placeholder={tr("Текущий пароль", "Current password")}
                          className="flex-1 bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-sm"
                        />
                        <button
                          type="button"
                          onClick={disableTwofa}
                          disabled={twofaLoading || !twofaPassword}
                          className="shrink-0 px-5 py-3 rounded-xl text-sm font-semibold bg-red-500/15 border border-red-400/30 text-red-300 hover:bg-red-500/25 disabled:opacity-40 transition"
                        >
                          {tr("Отключить", "Disable")}
                        </button>
                      </div>
                    ) : twofaStep === "idle" ? (
                      <button
                        type="button"
                        onClick={requestTwofaCode}
                        disabled={twofaLoading}
                        className="px-5 py-3 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-40 transition"
                      >
                        {twofaLoading ? tr("Отправка...", "Sending...") : tr("Включить 2FA", "Enable 2FA")}
                      </button>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-2 max-w-md">
                        <input
                          inputMode="numeric"
                          value={twofaCode}
                          onChange={(e) => setTwofaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          placeholder={tr("Код из письма", "Code from email")}
                          className="flex-1 bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-sm tracking-[0.3em]"
                        />
                        <button
                          type="button"
                          onClick={enableTwofa}
                          disabled={twofaLoading || twofaCode.length < 6}
                          className="shrink-0 px-5 py-3 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-40 transition"
                        >
                          {tr("Подтвердить", "Confirm")}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setTwofaStep("idle"); setTwofaCode(""); setTwofaMsg(""); }}
                          className="shrink-0 px-4 py-3 rounded-xl text-sm font-semibold bg-white/5 border border-white/10 hover:bg-white/10 transition"
                        >
                          {tr("Отмена", "Cancel")}
                        </button>
                      </div>
                    )}
                    {twofaMsg && (
                      <p
                        className={`text-sm mt-3 ${
                          twofaMsg.includes("✓") || twofaMsg.includes("включена") || twofaMsg.includes("отключена") || twofaMsg.includes("отправлен") || twofaMsg.toLowerCase().includes("enabled") || twofaMsg.toLowerCase().includes("disabled") || twofaMsg.toLowerCase().includes("sent")
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {twofaMsg}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 mb-5">
                  <button
                    type="button"
                    onClick={revokeOtherSessions}
                    disabled={sessionsLoading || !sessions || sessions.filter((s) => !s.current).length === 0}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-red-500/15 border border-red-400/30 text-red-300 hover:bg-red-500/25 disabled:opacity-40 transition"
                  >
                    <Devices size={18} />
                    {tr("Выйти на всех других устройствах", "Sign out on all other devices")}
                  </button>
                  {sessionsMsg && (
                    <span className={`text-sm ${sessionsMsg.includes("завершена") || sessionsMsg.includes("отключены") || sessionsMsg.toLowerCase().includes("session ended") || sessionsMsg.toLowerCase().includes("devices disconnected") ? "text-green-400" : "text-red-400"}`}>
                      {sessionsMsg}
                    </span>
                  )}
                </div>

                {!sessions ? (
                  <p className="text-white/40">{tr("Загрузка сессий...", "Loading sessions...")}</p>
                ) : sessions.length === 0 ? (
                  <p className="text-white/40">{tr("Активных сессий нет.", "No active sessions.")}</p>
                ) : (
                  <div className="space-y-3">
                    {sessions.map((s) => (
                      <div
                        key={s.id}
                        className={`rounded-2xl border p-4 flex items-center justify-between gap-4 ${
                          s.current
                            ? "border-purple-500/30 bg-purple-500/[0.07]"
                            : "border-white/10 bg-white/[0.03]"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm">{describeDevice(s.user_agent)}</p>
                            {s.current && (
                              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30">
                                {tr("Это устройство", "This device")}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-white/40 mt-1 break-all">
                            {s.ip || tr("IP неизвестен", "IP unknown")}
                            {s.created_at &&
                              ` · ${new Date(String(s.created_at).replace(" ", "T")).toLocaleString(lang === "en" ? "en-GB" : "ru-RU", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}`}
                          </p>
                        </div>
                        {!s.current && (
                          <button
                            type="button"
                            onClick={() => revokeSession(s.id)}
                            disabled={sessionsLoading}
                            className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 hover:bg-red-500/15 hover:border-red-400/30 hover:text-red-300 disabled:opacity-40 transition"
                          >
                            <Trash size={14} />
                            {tr("Завершить", "End session")}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )}

              {tab === "reward" && (
              <div className="mb-12">
                <h3 className="text-3xl font-bold mb-1">{tr("Ежедневная награда", "Daily reward")}</h3>
                <p className="text-white/40 mb-2">
                  {tr("Цикл из 7 наград выдаётся один раз за аккаунт. Пропуск дня не сбрасывает прогресс.", "A cycle of 7 rewards is granted once per account. Skipping a day does not reset progress.")}
                </p>
                <p className="text-xs text-white/35 mb-6">
                  {tr(
                    `Осталось получений: ${reward?.claimsLeft ?? 0} из ${reward?.limit ?? 7}.`,
                    `Claims left: ${reward?.claimsLeft ?? 0} of ${reward?.limit ?? 7}.`
                  )}
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
                            {tr("День", "Day")} {r.day}
                          </p>
                          <p className={`text-xs font-semibold break-words hyphens-auto ${isCurrent ? "text-white" : "text-white/60"}`}>
                            {r.label}
                          </p>
                          {isPast && <p className="text-green-400 text-xs mt-1">{tr("Получено", "Claimed")}</p>}
                          {isCurrent && !reward?.claimedToday && (
                            <p className="text-purple-300 text-xs mt-1">{tr("Доступно", "Available")}</p>
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
                      ? tr("Получение...", "Claiming...")
                      : !reward
                        ? tr("Загрузка...", "Loading...")
                        : reward.finished
                          ? tr("Все награды получены ✓", "All rewards claimed ✓")
                          : reward.claimedToday
                            ? tr("Награда за сегодня получена", "Today's reward already claimed")
                            : tr(`Получить награду — день ${reward.day}`, `Claim reward — day ${reward.day}`)}
                  </button>
                </div>
              </div>
              )}

              {tab === "quests" && (
              <div className="mb-12">
                <DailyQuests
                  onBalance={(balance) =>
                    setUser((prev) => (prev ? { ...prev, sc_coins: balance } : prev))
                  }
                />
              </div>
              )}

              {tab === "partners" && user?.role !== "media" && user?.role !== "tester" && (
              <div className="mb-12">
                {partnerStage === "list" ? (
                  <>
                    <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
                      <div>
                        <h3 className="text-3xl font-bold mb-1">{tr("Система Партнерства", "Partnership System")}</h3>
                        <p className="text-white/40">
                          {tr("Медиапартнёрство с Stellar делится на несколько уровней. В зависимости от уровня партнёрства вы будете получать разное вознаграждение.", "Media partnership with Stellar has several tiers. Depending on your partnership tier you receive different rewards.")}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => { setPartnerPlatform("youtube"); setPartnerStage("info"); }}
                          className="px-5 py-3 rounded-2xl font-medium bg-purple-600 hover:bg-purple-700 transition whitespace-nowrap"
                        >
                          {tr("Стать партнёром (YouTube)", "Become a partner (YouTube)")}
                        </button>
                        <button
                          onClick={() => { setPartnerPlatform("tiktok"); setPartnerStage("info"); }}
                          className="px-5 py-3 rounded-2xl font-medium bg-white/10 hover:bg-white/15 border border-white/10 transition whitespace-nowrap"
                        >
                          {tr("Стать партнёром (TikTok)", "Become a partner (TikTok)")}
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
                      <ArrowLeft size={16} weight="bold" />{tr("Назад", "Back")}
                    </button>

                    <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
                      <div>
                        <h3 className="text-3xl font-bold mb-1">{tr("Виды партнёрства", "Partnership tiers")}</h3>
                        <p className="text-white/40">
                          {tr("Медиапартнёрство с Stellar делится на несколько уровней. В зависимости от уровня партнёрства вы будете получать разное вознаграждение.", "Media partnership with Stellar has several tiers. Depending on your partnership tier you receive different rewards.")}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setPartnerStage("list")}
                          className="px-5 py-3 rounded-2xl font-medium bg-white/10 hover:bg-white/15 border border-white/10 transition whitespace-nowrap"
                        >
                          {tr("Закрыть", "Close")}
                        </button>
                        <button
                          onClick={() => router.push(`/dashboard/partner?platform=${partnerPlatform}`)}
                          className="px-5 py-3 rounded-2xl font-medium bg-purple-600 hover:bg-purple-700 transition whitespace-nowrap"
                        >
                          {tr("Подать заявку на партнёра", "Apply for partnership")}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6">
                        <h4 className="text-xl font-bold mb-3">{tr("Младший партнер", "Junior partner")}</h4>
                        <ul className="space-y-2 text-white/70 text-sm leading-relaxed">
                          <li>
                            •{" "}
                            {partnerPlatform === "youtube"
                              ? tr("До 100 просмотров на ролике в среднем", "Up to 100 views per video on average")
                              : tr("До 300 просмотров на ролике в среднем", "Up to 300 views per video on average")}
                          </li>
                          <li>
                            •{" "}
                            {partnerPlatform === "youtube"
                              ? tr("Менее 300 рублей выручка за просмотры", "Less than 300 rubles revenue from views")
                              : tr("Менее 500 рублей выручка за просмотры", "Less than 500 rubles revenue from views")}
                          </li>
                          <li>• {tr("Съемка с оплатой", "Paid filming")}</li>
                          <li>• {tr("Возможность получить подписку бесплатно", "Chance to get a free subscription")}</li>
                          <li>• {tr("Количество видеороликов заранее обговаривается", "The number of videos is agreed in advance")}</li>
                        </ul>
                      </div>

                      <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6">
                        <h4 className="text-xl font-bold mb-3">{tr("Партнер", "Partner")}</h4>
                        <ul className="space-y-2 text-white/70 text-sm leading-relaxed">
                          <li>
                            •{" "}
                            {partnerPlatform === "youtube"
                              ? tr("7 видео по 250 просмотров", "7 videos with 250 views each")
                              : tr("10 видео по 1000 просмотров", "10 videos with 1000 views each")}
                          </li>
                          <li>
                            •{" "}
                            {partnerPlatform === "youtube"
                              ? tr("Менее 1000 рублей выручка за просмотры", "Less than 1000 rubles revenue from views")
                              : tr("Менее 2000 рублей выручка за просмотры", "Less than 2000 rubles revenue from views")}
                          </li>
                          <li>• {tr("Съемка с оплатой", "Paid filming")}</li>
                          <li>• {tr("Возможность получить подписку бесплатно", "Chance to get a free subscription")}</li>
                          <li>• {tr("Количество видеороликов заранее обговаривается", "The number of videos is agreed in advance")}</li>
                        </ul>
                      </div>

                      <p className="text-white/30 text-xs">
                        {tr("Другие уровни партнёрства скоро появятся.", "More partnership tiers are coming soon.")}
                      </p>
                    </div>
                  </>
                )}
              </div>
              )}

              {tab === "media" && user?.role === "media" && (
              <div className="mb-12">
                <h3 className="text-3xl font-bold mb-1">{tr("Медиа Отдел", "Media Department")}</h3>
                <p className="text-white/40 mb-6">
                  {tr("Твой ранг партнёрства и отправка видео на проверку.", "Your partnership rank and video submissions for review.")}
                </p>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  <InfoTile
                    icon={<ShieldCheck size={18} />}
                    label={tr("Ранг партнёрства", "Partnership rank")}
                    value={mediaRank || user?.partner_rank || tr("Младший партнёр", "Junior partner")}
                  />
                  <InfoTile
                    icon={<VideoCamera size={18} />}
                    label={tr("Соцсеть", "Social network")}
                    value={mediaPlatformLabel}
                  />
                  <InfoTile
                    icon={<Eye size={18} />}
                    label={tr("Всего просмотров", "Total views")}
                    value={formatNum(mediaTotalViews)}
                  />
                  <InfoTile
                    icon={<CheckCircle size={18} />}
                    label={tr("Одобрено видео", "Approved videos")}
                    value={`${mediaApprovedCount} / ${mediaVideoThreshold}`}
                  />
                  <InfoTile
                    icon={<Wallet size={18} />}
                    label={tr("Заработано", "Earned")}
                    value={`${formatNum(mediaEarned)} ₽`}
                  />
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 mb-8">
                  <p className="font-semibold mb-4">
                    {mediaPromoted ? tr("Максимальный ранг — Партнёр", "Maximum rank — Partner") : tr("До ранга «Партнёр»", "Until the “Partner” rank")}
                  </p>

                  <div className="mb-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-white/60">{tr("Одобренных видео", "Approved videos")}</span>
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
                      <span className="text-white/60">{tr("Просмотров суммарно", "Views in total")}</span>
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
                      ? tr("Ты на максимальном ранге партнёрства.", "You are at the maximum partnership rank.")
                      : tr(`Нужно одновременно: ${mediaVideoThreshold} одобренных видео и ${formatNum(mediaViewsThreshold)} просмотров.`, `Required at the same time: ${mediaVideoThreshold} approved videos and ${formatNum(mediaViewsThreshold)} views.`)}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7 mb-8">
                  <h4 className="text-xl font-bold mb-4">{tr("Отправить видео", "Submit a video")}</h4>
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
                      {mediaLoading ? "..." : tr("Отправить", "Submit")}
                    </button>
                  </div>
                  {mediaMsg && (
                    <p className={`mt-3 text-sm ${mediaMsg.includes("✓") ? "text-green-400" : "text-red-400"}`}>{mediaMsg}</p>
                  )}
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7">
                  <h4 className="text-xl font-bold mb-4">{tr("Мои заявки", "My submissions")}</h4>
                  {mediaSubs.length === 0 ? (
                    <p className="text-white/30 text-center py-6">{tr("Нет заявок", "No submissions")}</p>
                  ) : (
                    <div className="space-y-3">
                      {mediaSubs.map((s) => (
                        <div key={s.id} className="bg-black/30 rounded-xl p-4 border border-white/5 flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <a href={s.video_url} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 text-sm truncate block">
                              {s.video_url}
                            </a>
                            <p className="text-white/30 text-xs mt-1">{new Date(s.created_at).toLocaleDateString(lang === "en" ? "en-GB" : "ru-RU")}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {s.status === "approved" && s.views > 0 && (
                              <span className="text-white/40 text-xs">{formatNum(s.views)} {tr("просм.", "views")}</span>
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
                                {s.status === "approved" ? tr("Одобрено", "Approved") : s.status === "rejected" ? tr("Отклонено", "Rejected") : tr("На рассмотрении", "Under review")}
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
                <h3 className="text-3xl font-bold mb-1">{tr("Тестовый отдел", "Testing Department")}</h3>
                <p className="text-white/40 mb-6">{tr("Сообщайте о найденных багах.", "Report the bugs you find.")}</p>

                <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7 mb-8">
                  <h4 className="text-xl font-bold mb-4">{tr("Новый баг-репорт", "New bug report")}</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-white/50 text-sm mb-2">{tr("Введите айпи сервера где произошел баг:", "Enter the IP of the server where the bug occurred:")}</label>
                      <input
                        type="text"
                        value={bugIp}
                        onChange={(e) => setBugIp(e.target.value)}
                        placeholder="192.168.1.1"
                        className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-white/50 text-sm mb-2">{tr("Какая функция с багом:", "Which feature has the bug:")}</label>
                      <input
                        type="text"
                        value={bugFunction}
                        onChange={(e) => setBugFunction(e.target.value)}
                        placeholder={tr("Например: aimbot, ESP, лаунчер...", "For example: aimbot, ESP, launcher...")}
                        className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-white/50 text-sm mb-2">{tr("Когда происходит баг: редко, часто", "How often the bug occurs: rarely, often")}</label>
                      <select
                        value={bugFrequency}
                        onChange={(e) => setBugFrequency(e.target.value)}
                        className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-white"
                      >
                        <option value="редко">{tr("Редко", "Rarely")}</option>
                        <option value="часто">{tr("Часто", "Often")}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-white/50 text-sm mb-2">{tr("Опишите проблему:", "Describe the problem:")}</label>
                      <textarea
                        value={bugDescription}
                        onChange={(e) => setBugDescription(e.target.value)}
                        rows={4}
                        placeholder={tr("Подробное описание проблемы, шаги для воспроизведения...", "Detailed description of the problem, steps to reproduce...")}
                        className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none resize-none"
                      />
                    </div>
                    <button
                      onClick={submitBugReport}
                      disabled={bugLoading}
                      className="px-6 py-3 rounded-xl font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition"
                    >
                      {bugLoading ? "..." : tr("Отправить баг-репорт", "Submit bug report")}
                    </button>
                    {bugMsg && (
                      <p className={`text-sm ${bugMsg.includes("✓") ? "text-green-400" : "text-red-400"}`}>{bugMsg}</p>
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7">
                  <h4 className="text-xl font-bold mb-4">{tr("Мои баг-репорты", "My bug reports")}</h4>
                  {bugReports.length === 0 ? (
                    <p className="text-white/30 text-center py-6">{tr("Нет репортов", "No reports")}</p>
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
                                {r.status === "fixed" ? tr("Исправлено", "Fixed") : r.status === "in_progress" ? tr("В работе", "In progress") : tr("Новый", "New")}
                              </span>
                            </span>
                          </div>
                          <p className="text-white/40 text-sm">{r.description}</p>
                          <p className="text-white/25 text-xs mt-2">
                            {tr("Частота:", "Frequency:")} {r.frequency === "редко" ? tr("редко", "rarely") : r.frequency === "часто" ? tr("часто", "often") : r.frequency} · {new Date(r.created_at).toLocaleDateString(lang === "en" ? "en-GB" : "ru-RU")}
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
                <h3 className="text-3xl font-bold mb-1">{tr("Действия", "Actions")}</h3>
                <p className="text-white/40 mb-6">{tr("Быстрые переходы в нужные разделы.", "Quick links to the sections you need.")}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ActionCard
                    href="/pricing"
                    icon={<ShoppingCartSimple size={22} />}
                    title={tr("Продукты", "Products")}
                    desc={tr("Подписки и товары", "Subscriptions and products")}
                  />
                  <ActionCard
                    href="/dashboard/library"
                    icon={<Books size={22} />}
                    title={tr("Мои покупки", "My purchases")}
                    desc={tr("Конфиги, наборы и история пополнений", "Configs, bundles and top-up history")}
                  />
                  <ActionCard
                    href="/dashboard/addons"
                    icon={<Cube size={22} />}
                    title={tr("Дополнения", "Add-ons")}
                    desc={tr("Ключ и смена пароля", "Key and password change")}
                  />
                  <ActionCard
                    href="/dashboard/battle-pass"
                    icon={<Trophy size={22} />}
                    title={tr("Батл-пасс", "Battle pass")}
                    desc={tr("Уровни и сезонные награды", "Levels and seasonal rewards")}
                  />
                  <ActionCard
                    href="/dashboard/friends"
                    icon={<UsersThree size={22} />}
                    title={tr("Друзья", "Friends")}
                    desc={tr("Заявки, онлайн и статус «в игре»", "Requests, online and in-game status")}
                  />
                  <ActionCard
                    href="/dashboard/party"
                    icon={<Crosshair size={22} />}
                    title={tr("Пати и метки", "Party and markers")}
                    desc={tr("Группа друзей и координаты для меток", "Friend group and marker coordinates")}
                  />
                  <ActionCard
                    href="/dashboard/gifts"
                    icon={<Gift size={22} />}
                    title={tr("Подарки", "Gifts")}
                    desc={tr("Отправить SC или косметику", "Send SC or cosmetics")}
                  />
                  <ActionCard
                    href="/chat"
                    icon={<ChatCircleDots size={22} />}
                    title={tr("Общий чат", "Global chat")}
                    desc={tr("Каналы general и trade", "General and trade channels")}
                  />
                  <ActionCard
                    href="/dashboard/author"
                    icon={<Sparkle size={22} />}
                    title={tr("Кабинет автора", "Author cabinet")}
                    desc={tr("Продажи, заработок и модерация", "Sales, earnings and moderation")}
                  />
                  <ActionCard
                    href={`/u/${encodeURIComponent(user?.username || "")}`}
                    icon={<User size={22} />}
                    title={tr("Мой профиль", "My profile")}
                    desc={tr("Публичная страница с достижениями", "Public page with achievements")}
                  />
                  {hasSub ? (
                    <ActionCard
                      href={LAUNCHER_DOWNLOAD_PATH}
                      download
                      icon={<DownloadSimple size={22} />}
                      title={tr("Скачать лаунчер", "Download launcher")}
                      desc={tr("Загрузить последнюю версию", "Get the latest version")}
                    />
                  ) : (
                    <ActionCard
                      href="/pricing"
                      icon={<ShoppingCartSimple size={22} />}
                      title={tr("Скачать лаунчер", "Download launcher")}
                      desc={tr("Требуется подписка", "Subscription required")}
                    />
                  )}
                  {(user?.role === "admin" || user?.role === "support") && (
                    <ActionCard
                      href="/dashboard/admin"
                      icon={<Shield size={22} />}
                      title={
                        user?.role === "support"
                          ? tr("Панель поддержки", "Support panel")
                          : tr("Админ панель", "Admin panel")
                      }
                      desc={
                        user?.role === "support"
                          ? tr("Тикеты, блокировки и ответы игрокам", "Tickets, bans and player replies")
                          : tr("Управление пользователями и ключами", "Manage users and keys")
                      }
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
  download = false,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  download?: boolean;
}) {
  const className =
    "group relative flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition p-6 overflow-hidden";

  const body = (
    <>
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
    </>
  );

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
    >
      {download ? (
        <a href={href} download className={className}>
          {body}
        </a>
      ) : (
        <Link href={href} className={className}>
          {body}
        </Link>
      )}
    </motion.div>
  );
}
