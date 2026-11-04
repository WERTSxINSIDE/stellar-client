"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  ArrowLeft,
  Key,
  Fingerprint,
  Users,
  Copy,
  Check,
  ShieldCheck,
  Trash,
  Prohibit,
  WarningCircle,
  Minus,
  Plus,
  User,
  Coin,
  Headset,
  Star,
  Sparkle,
  FileText,
  DownloadSimple,
  ChatCircleText,
  Pulse,
  Bank,
} from "@phosphor-icons/react";
import {
  SUPPORT_CATEGORIES,
  isImageAttachment,
  supportCategoryLabel,
} from "@/lib/support";

type Me = {
  id: number;
  username: string;
  email: string;
  is_admin: number;
} | null;

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<Me>(null);
  const [loading, setLoading] = useState(true);

  // Генерация ключей подписки
  const [subDays, setSubDays] = useState(30);
  const [subCount, setSubCount] = useState(1);
  const [subKeys, setSubKeys] = useState<string[]>([]);
  const [subMsg, setSubMsg] = useState("");
  const [subLoading, setSubLoading] = useState(false);

  // Генерация ключей сброса HWID
  const [hwidCount, setHwidCount] = useState(1);
  const [hwidKeys, setHwidKeys] = useState<string[]>([]);
  const [hwidMsg, setHwidMsg] = useState("");
  const [hwidLoading, setHwidLoading] = useState(false);

  // Все ключи
  const [allKeys, setAllKeys] = useState<any[]>([]);
  const [keysTab, setKeysTab] = useState<"generate" | "list" | "users" | "news" | "media" | "support" | "bugs" | "reviews" | "promo">("generate");

  // Пользователи
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // Заявки на выплату видео
  const [mediaSubmissions, setMediaSubmissions] = useState<any[]>([]);
  const [mediaRewards, setMediaRewards] = useState<Record<number, number>>({});
  const [mediaNotes, setMediaNotes] = useState<Record<number, string>>({});
  const [mediaViews, setMediaViews] = useState<Record<number, number>>({});
  const [partnerApps, setPartnerApps] = useState<any[]>([]);

  // Поддержка
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [supportReplies, setSupportReplies] = useState<Record<number, string>>({});
  const [supportCsat, setSupportCsat] = useState<{ avg: number; count: number } | null>(null);
  const [supportCategoryFilter, setSupportCategoryFilter] = useState("all");
  const [supportStatusFilter, setSupportStatusFilter] = useState("all");
  const [supportTemplates, setSupportTemplates] = useState<any[]>([]);
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [templateMsg, setTemplateMsg] = useState("");
  const [templateBusy, setTemplateBusy] = useState(false);

  // Заявки на медиа-партнёрство
  const [partnerRejectNote, setPartnerRejectNote] = useState<string>("");
  const [rejectId, setRejectId] = useState<number | null>(null);

  // Новости
  const [allNews, setAllNews] = useState<any[]>([]);
  const [newsTitle, setNewsTitle] = useState("");
  const [newsContent, setNewsContent] = useState("");
  const [newsTag, setNewsTag] = useState("Обновление");
  const [newsMsg, setNewsMsg] = useState("");
  const [newsLoading, setNewsLoading] = useState(false);

  // Баг-репорты тестеров
  const [bugReports, setBugReports] = useState<any[]>([]);

  // Статистика
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Отзывы
  const [reviewsList, setReviewsList] = useState<any[]>([]);
  const [reviewBusy, setReviewBusy] = useState(false);

  // Промокоды
  const [promos, setPromos] = useState<any[]>([]);
  const [promoSummary, setPromoSummary] = useState<any[]>([]);
  const [promoFilter, setPromoFilter] = useState(0);
  const [promoCode, setPromoCode] = useState("");
  const [promoAmount, setPromoAmount] = useState(50);
  const [promoMaxUses, setPromoMaxUses] = useState(0);
  const [promoMsg, setPromoMsg] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);

  async function loadPromos(amount = promoFilter) {
    try {
      const res = await fetch(`/api/admin-promo${amount ? `?amount=${amount}` : ""}`);
      const data = await res.json();
      if (data.ok) {
        setPromos(data.promos || []);
        if (Array.isArray(data.summary)) setPromoSummary(data.summary);
      }
    } catch {}
  }

  async function createPromo() {
    setPromoMsg("");
    setPromoLoading(true);
    try {
      const res = await fetch("/api/admin-promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: promoCode,
          amount: promoAmount,
          max_uses: promoMaxUses,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPromoMsg(data.error || "Не удалось создать промокод");
        return;
      }
      setPromoMsg("Промокод создан ✓");
      setPromoCode("");
      setPromoAmount(50);
      setPromoMaxUses(0);
      await loadPromos(promoFilter);
    } catch {
      setPromoMsg("Ошибка сети");
    } finally {
      setPromoLoading(false);
    }
  }

  async function disablePromo(id: number) {
    if (!confirm("Отключить промокод?")) return;
    try {
      await fetch("/api/admin-promo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await loadPromos(promoFilter);
    } catch {}
  }

  async function loadStats() {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/admin/stats");
      const data = await res.json();
      if (data.ok) setStats(data);
    } catch {} finally { setStatsLoading(false); }
  }

  async function loadReviews() {
    try {
      const res = await fetch("/api/reviews?all=1");
      const data = await res.json();
      if (data.ok) setReviewsList(data.reviews || []);
    } catch {}
  }

  async function reviewAction(id: number, action: "approve" | "reject") {
    setReviewBusy(true);
    try {
      await fetch("/api/reviews", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, id }) });
      await loadReviews();
    } finally { setReviewBusy(false); }
  }

  async function deleteReview(id: number) {
    if (!confirm("Удалить отзыв?")) return;
    setReviewBusy(true);
    try {
      await fetch("/api/reviews", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      await loadReviews();
    } finally { setReviewBusy(false); }
  }

  async function loadBugs() {
    try {
      const res = await fetch("/api/bug-report");
      const data = await res.json();
      if (data.ok) setBugReports(data.reports || []);
    } catch {}
  }

  async function setBugStatus(id: number, status: string) {
    try {
      await fetch("/api/bug-report", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_id: id, status }),
      });
      setBugReports((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
    } catch {}
  }

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.user) {
          router.replace("/login");
          return;
        }
        if (!data.user.is_admin) {
          router.replace("/dashboard");
          return;
        }
        setUser(data.user);
        setLoading(false);
      });
  }, [router]);

  useEffect(() => {
    if ((keysTab as any) === "stats") loadStats();
  }, [keysTab]);

  async function loadKeys() {
    try {
      const res = await fetch("/api/admin-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.keys) setAllKeys(data.keys);
    } catch {}
  }

  async function loadMedia() {
    try {
      const res = await fetch("/api/media-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      });
      const data = await res.json();
      if (data.submissions) setMediaSubmissions(data.submissions);
    } catch {}
  }

  async function loadPartnerApps() {
    try {
      const res = await fetch("/api/partner-apply");
      const data = await res.json();
      if (data.applications) setPartnerApps(data.applications);
    } catch {}
  }

  async function approvePartner(id: number) {
    try {
      await fetch("/api/partner-apply", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", application_id: id }),
      });
      loadPartnerApps();
      loadUsers();
    } catch {}
  }

  async function rejectPartner(id: number) {
    if (!partnerRejectNote.trim()) {
      alert("Укажите причину отклонения");
      return;
    }
    try {
      const res = await fetch("/api/partner-apply", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", application_id: id, admin_note: partnerRejectNote.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Не удалось отклонить заявку");
        return;
      }
      setRejectId(null);
      setPartnerRejectNote("");
      loadPartnerApps();
    } catch {
      alert("Ошибка сервера");
    }
  }

  async function approveMedia(id: number) {
    try {
      await fetch("/api/media-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve", submission_id: id, reward: mediaRewards[id] || 0, views: mediaViews[id] || 0, admin_note: mediaNotes[id]?.trim() || undefined }),
      });
      loadMedia();
      loadUsers();
    } catch {}
  }

  async function rejectMedia(id: number) {
    try {
      await fetch("/api/media-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject", submission_id: id, admin_note: mediaNotes[id]?.trim() || undefined }),
      });
      loadMedia();
    } catch {}
  }

  async function loadSupport() {
    try {
      const res = await fetch("/api/support?all=1");
      const data = await res.json();
      if (data.tickets) setSupportTickets(data.tickets);
      if (data.csat) setSupportCsat(data.csat);
    } catch {}
  }

  async function loadTemplates() {
    try {
      const res = await fetch("/api/support-templates");
      const data = await res.json();
      if (data.ok) setSupportTemplates(Array.isArray(data.templates) ? data.templates : []);
    } catch {}
  }

  function insertTemplate(ticketId: number, body: string) {
    setSupportReplies((prev) => ({
      ...prev,
      [ticketId]: prev[ticketId] ? `${prev[ticketId]} ${body}` : body,
    }));
  }

  async function saveTemplate() {
    if (templateTitle.trim().length < 2 || templateBody.trim().length < 2) {
      setTemplateMsg("Заполните название и текст шаблона");
      return;
    }
    setTemplateBusy(true);
    setTemplateMsg("");
    try {
      const res = await fetch("/api/support-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: templateTitle.trim(), body: templateBody.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTemplateMsg(data.error || "Не удалось сохранить шаблон");
        return;
      }
      setTemplateTitle("");
      setTemplateBody("");
      setTemplateMsg("Шаблон сохранён ✓");
      loadTemplates();
    } catch {
      setTemplateMsg("Ошибка сервера");
    } finally {
      setTemplateBusy(false);
    }
  }

  async function deleteTemplate(id: number) {
    try {
      await fetch("/api/support-templates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      loadTemplates();
    } catch {}
  }

  async function replySupport(id: number) {
    const body = supportReplies[id]?.trim();
    if (!body) return;
    try {
      await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reply", ticket_id: id, body }),
      });
      setSupportReplies((prev) => ({ ...prev, [id]: "" }));
      loadSupport();
    } catch {}
  }

  async function setSupportStatus(id: number, action: "close" | "reopen") {
    try {
      await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ticket_id: id }),
      });
      loadSupport();
    } catch {}
  }

  useEffect(() => {
    if (user) {
      loadKeys();
      loadUsers();
      loadNews();
      loadMedia();
      loadPartnerApps();
      loadSupport();
      loadTemplates();
    }
  }, [user]);

  async function loadNews() {
    try {
      const res = await fetch("/api/news");
      const data = await res.json();
      setAllNews(data.news || []);
    } catch {}
  }

  async function createNews() {
    if (!newsTitle.trim() || !newsContent.trim()) return;
    setNewsMsg("");
    setNewsLoading(true);
    try {
      const res = await fetch("/api/admin-news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          title: newsTitle,
          content: newsContent,
          tag: newsTag,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNewsMsg(data.error || "Ошибка");
        return;
      }
      setNewsMsg("Новость создана ✓");
      setNewsTitle("");
      setNewsContent("");
      setNewsTag("Обновление");
      loadNews();
    } catch {
      setNewsMsg("Ошибка сервера");
    } finally {
      setNewsLoading(false);
    }
  }

  async function deleteNews(id: number) {
    if (!confirm("Удалить новость?")) return;
    try {
      const res = await fetch("/api/admin-news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          id,
        }),
      });
      const data = await res.json();
      if (data.ok) loadNews();
    } catch {}
  }

  async function loadUsers() {
    try {
      const res = await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      });
      const data = await res.json();
      if (data.users) setAllUsers(data.users);
    } catch {}
  }

  async function setRole(userId: number, role: string) {
    try {
      await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set-role",
          user_id: userId,
          role,
        }),
      });
      loadUsers();
    } catch {}
  }

  async function deleteUser(userId: number) {
    if (!confirm("Удалить пользователя?")) return;
    try {
      await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          user_id: userId,
        }),
      });
      loadUsers();
    } catch {}
  }

  async function banUser(userId: number) {
    const reason = prompt("Причина бана (необязательно):");
    if (reason === null) return;
    try {
      await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ban",
          user_id: userId,
          ban_reason: reason || undefined,
        }),
      });
      loadUsers();
    } catch {}
  }

  async function unbanUser(userId: number) {
    try {
      await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unban",
          user_id: userId,
        }),
      });
      loadUsers();
    } catch {}
  }

  async function reduceSubscription(userId: number) {
    const days = prompt("Сколько дней убрать?");
    if (!days || isNaN(Number(days)) || Number(days) < 1) return;
    try {
      const res = await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reduce-subscription",
          user_id: userId,
          days: Number(days),
        }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Ошибка");
      loadUsers();
    } catch {}
  }

  async function addSubscription(userId: number) {
    const days = prompt("Сколько дней добавить?");
    if (!days || isNaN(Number(days)) || Number(days) < 1) return;
    try {
      const res = await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-subscription",
          user_id: userId,
          days: Number(days),
        }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Ошибка");
      loadUsers();
    } catch {}
  }

  async function addBalance(userId: number) {
    const amount = prompt("Сумма начисления (можно отрицательную для списания):");
    if (!amount || isNaN(Number(amount)) || Number(amount) === 0) return;
    try {
      const res = await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-balance",
          user_id: userId,
          days: Number(amount),
        }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Ошибка");
      loadUsers();
    } catch {}
  }

  async function changePassword(userId: number) {
    const pw = prompt("Новый пароль (минимум 6 символов):");
    if (!pw || pw.length < 6) return;
    try {
      const res = await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change-password",
          user_id: userId,
          new_password: pw,
        }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Ошибка");
      else alert("Пароль изменён ✓");
    } catch {}
  }

  async function changeUsername(userId: number) {
    const nick = prompt("Новый ник:");
    if (!nick || nick.length < 2) return;
    try {
      const res = await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change-username",
          user_id: userId,
          new_username: nick,
        }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Ошибка");
      else {
        alert("Ник изменён ✓");
        loadUsers();
      }
    } catch {}
  }

  async function deleteKey(keyId: number) {
    if (!confirm("Удалить ключ?")) return;
    try {
      const res = await fetch("/api/admin-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          key_id: keyId,
        }),
      });
      const data = await res.json();
      if (data.ok) loadKeys();
    } catch {}
  }

  async function generateSubKeys() {
    setSubMsg("");
    setSubLoading(true);
    try {
      const res = await fetch("/api/generate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duration_days: subDays,
          count: subCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubMsg(data.error || "Ошибка");
        return;
      }
      setSubKeys(data.keys);
      setSubMsg(`Создано ${data.keys.length} ключей ✓`);
      loadKeys();
    } catch {
      setSubMsg("Ошибка сервера");
    } finally {
      setSubLoading(false);
    }
  }

  async function generateHwidKeys() {
    setHwidMsg("");
    setHwidLoading(true);
    try {
      const res = await fetch("/api/generate-hwid-reset-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: hwidCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setHwidMsg(data.error || "Ошибка");
        return;
      }
      setHwidKeys(data.keys);
      setHwidMsg(`Создано ${data.keys.length} ключей ✓`);
      loadKeys();
    } catch {
      setHwidMsg("Ошибка сервера");
    } finally {
      setHwidLoading(false);
    }
  }

  function copyAll(keys: string[]) {
    navigator.clipboard.writeText(keys.join("\n"));
  }

  const visibleSupportTickets = supportTickets.filter((ticket: any) => {
    if (supportCategoryFilter !== "all" && supportCategoryLabel(ticket.category) !== supportCategoryFilter) {
      return false;
    }
    if (supportStatusFilter !== "all" && ticket.status !== supportStatusFilter) return false;
    return true;
  });

  if (loading) return null;

  return (
    <>
      <Header />
      <main className="relative min-h-screen text-white overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-40 pointer-events-none">
          <Image src="/fluid2.png" alt="" fill className="object-cover" priority />
        </div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/60 via-black/70 to-black pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 pt-36 pb-24">
          <div className="flex flex-wrap items-center gap-3 mb-8">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 text-white/50 hover:text-white transition text-sm"
            >
              <ArrowLeft size={16} weight="bold" />В кабинет
            </Link>
            <Link
              href="/dashboard/admin/logs"
              className="inline-flex items-center gap-2 text-purple-300 hover:text-purple-200 transition text-sm px-4 py-2 rounded-xl bg-white/5 border border-white/10"
            >
              <ShieldCheck size={16} /> Журнал действий
            </Link>
            <Link
              href="/dashboard/admin/risk"
              className="inline-flex items-center gap-2 text-red-300 hover:text-red-200 transition text-sm px-4 py-2 rounded-xl bg-red-500/10 border border-red-400/20"
            >
              <WarningCircle size={16} /> Риск-скор
            </Link>
            <Link
              href="/dashboard/admin/showcase"
              className="inline-flex items-center gap-2 text-purple-300 hover:text-purple-200 transition text-sm px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-400/20"
            >
              <Sparkle size={16} /> Витрина
            </Link>
            <Link
              href="/dashboard/admin/payments"
              className="inline-flex items-center gap-2 text-emerald-300 hover:text-emerald-200 transition text-sm px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-400/20"
            >
              <Coin size={16} /> Пополнения
            </Link>
            <Link
              href="/dashboard/admin/payouts"
              className="inline-flex items-center gap-2 text-sky-300 hover:text-sky-200 transition text-sm px-4 py-2 rounded-xl bg-sky-500/10 border border-sky-400/20"
            >
              <Bank size={16} /> Выплаты авторам
            </Link>
            <Link
              href="/dashboard/admin/status"
              className="inline-flex items-center gap-2 text-purple-300 hover:text-purple-200 transition text-sm px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-400/20"
            >
              <Pulse size={16} /> Статус
            </Link>
          </div>

          <p className="text-white/40 text-xs tracking-widest uppercase mb-2">
            Управление
          </p>
          <h1 className="text-5xl font-extrabold mb-12">
            <span className="bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
              Админ панель
            </span>
          </h1>

          {/* Переключатель */}
          <div className="flex flex-wrap gap-2 p-1.5 rounded-2xl bg-white/[0.04] border border-white/10 mb-8 max-w-2xl">
            <button
              onClick={() => setKeysTab("generate")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                keysTab === "generate"
                  ? "bg-purple-600/80 text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Генерация ключей
            </button>
            <button
              onClick={() => setKeysTab("list")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                keysTab === "list"
                  ? "bg-purple-600/80 text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Все ключи
            </button>
            <button
              onClick={() => setKeysTab("users")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                keysTab === "users"
                  ? "bg-purple-600/80 text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Пользователи
            </button>
            <button
              onClick={() => setKeysTab("news")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                keysTab === "news"
                  ? "bg-purple-600/80 text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Новости
            </button>
            <button
              onClick={() => setKeysTab("media")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                keysTab === "media"
                  ? "bg-purple-600/80 text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Медиа
            </button>
            <button
              onClick={() => setKeysTab("support")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                keysTab === "support"
                  ? "bg-purple-600/80 text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Поддержка
            </button>
            <button
              onClick={() => { setKeysTab("bugs"); loadBugs(); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                keysTab === "bugs"
                  ? "bg-purple-600/80 text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Баги
            </button>
            <button
              onClick={() => { setKeysTab("reviews"); loadReviews(); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                keysTab === "reviews"
                  ? "bg-purple-600/80 text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Отзывы
            </button>
            <button
              onClick={() => { setKeysTab("promo"); setPromoFilter(0); loadPromos(0); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                keysTab === "promo"
                  ? "bg-purple-600/80 text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Промокоды
            </button>
            <button
              onClick={() => { setKeysTab("stats" as any); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                keysTab === ("stats" as any)
                  ? "bg-purple-600/80 text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Статистика
            </button>
          </div>

          {keysTab === "generate" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Ключи подписки */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7">
                <div className="flex items-center gap-2 mb-1">
                  <Key size={22} className="text-white/70" />
                  <h2 className="text-2xl font-bold">Ключи подписки</h2>
                </div>
                <p className="text-white/40 mb-5">Генерация ключей для активации подписки.</p>

                <div className="flex gap-3 mb-4">
                  <div className="flex-1">
                    <label className="text-white/40 text-xs mb-1 block">Дней</label>
                    <select
                      value={subDays}
                      onChange={(e) => setSubDays(Number(e.target.value))}
                      className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
                    >
                      <option value={1}>1 день</option>
                      <option value={3}>3 дня</option>
                      <option value={7}>7 дней</option>
                      <option value={30}>30 дней</option>
                      <option value={90}>90 дней</option>
                      <option value={180}>180 дней</option>
                      <option value={9999}>Навсегда</option>
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="text-white/40 text-xs mb-1 block">Кол-во</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={subCount}
                      onChange={(e) => setSubCount(Number(e.target.value))}
                      className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
                    />
                  </div>
                </div>

                {subMsg && (
                  <p className={`text-sm mb-3 ${subMsg.includes("✓") ? "text-green-400" : "text-red-400"}`}>
                    {subMsg}
                  </p>
                )}

                {subKeys.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white/40 text-xs">Ключи:</span>
                      <button
                        onClick={() => copyAll(subKeys)}
                        className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
                      >
                        <Copy size={12} /> Копировать все
                      </button>
                    </div>
                    <div className="bg-black/40 rounded-xl p-3 max-h-40 overflow-y-auto font-mono text-sm text-white/80 whitespace-pre">{subKeys.join("\n")}</div>
                  </div>
                )}

                <button
                  onClick={generateSubKeys}
                  disabled={subLoading}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold transition bg-purple-600 hover:bg-purple-700 disabled:opacity-60"
                >
                  <Key size={18} weight="bold" />
                  {subLoading ? "Генерация..." : "Сгенерировать"}
                </button>
              </div>

              {/* Ключи сброса HWID */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7">
                <div className="flex items-center gap-2 mb-1">
                  <Fingerprint size={22} className="text-white/70" />
                  <h2 className="text-2xl font-bold">Ключи сброса HWID</h2>
                </div>
                <p className="text-white/40 mb-5">Генерация ключей для сброса привязки железа (150 ₽).</p>

                <div className="mb-4">
                  <label className="text-white/40 text-xs mb-1 block">Кол-во</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={hwidCount}
                    onChange={(e) => setHwidCount(Number(e.target.value))}
                    className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
                  />
                </div>

                {hwidMsg && (
                  <p className={`text-sm mb-3 ${hwidMsg.includes("✓") ? "text-green-400" : "text-red-400"}`}>
                    {hwidMsg}
                  </p>
                )}

                {hwidKeys.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white/40 text-xs">Ключи:</span>
                      <button
                        onClick={() => copyAll(hwidKeys)}
                        className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
                      >
                        <Copy size={12} /> Копировать все
                      </button>
                    </div>
                    <div className="bg-black/40 rounded-xl p-3 max-h-40 overflow-y-auto font-mono text-sm text-white/80 whitespace-pre">{hwidKeys.join("\n")}</div>
                  </div>
                )}

                <button
                  onClick={generateHwidKeys}
                  disabled={hwidLoading}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold transition bg-purple-600 hover:bg-purple-700 disabled:opacity-60"
                >
                  <Fingerprint size={18} weight="bold" />
                  {hwidLoading ? "Генерация..." : "Сгенерировать"}
                </button>
              </div>
            </div>
          )}

          {keysTab === "list" && (
            /* Список всех ключей */
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Users size={22} className="text-white/70" />
                  <h2 className="text-2xl font-bold">Все ключи ({allKeys.length})</h2>
                </div>
                <button
                  onClick={loadKeys}
                  className="text-sm text-purple-400 hover:text-purple-300"
                >
                  Обновить
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/40 border-b border-white/10">
                      <th className="text-left py-3 px-2">Ключ</th>
                      <th className="text-left py-3 px-2">Тип</th>
                      <th className="text-left py-3 px-2">Дней</th>
                      <th className="text-left py-3 px-2">Статус</th>
                       <th className="text-left py-3 px-2">Создан</th>
                      <th className="text-left py-3 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {allKeys.map((k: any) => (
                      <tr key={k.id} className="border-b border-white/5">
                        <td className="py-3 px-2 font-mono text-white/80">{k.key}</td>
                        <td className="py-3 px-2">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            k.duration_days === 0
                              ? "bg-orange-500/20 text-orange-300"
                              : "bg-purple-500/20 text-purple-300"
                          }`}>
                            {k.duration_days === 0 ? "HWID Reset" : "Подписка"}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-white/60">{k.duration_days === 0 ? "—" : k.duration_days}</td>
                        <td className="py-3 px-2">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            k.activated_by
                              ? "bg-red-500/20 text-red-300"
                              : "bg-green-500/20 text-green-300"
                          }`}>
                            {k.activated_by ? `Использован (UID ${k.activated_by})` : "Активен"}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-white/40">{k.created_at}</td>
                        <td className="py-3 px-2">
                          <button
                            onClick={() => deleteKey(k.id)}
                            className="text-red-400 hover:text-red-300 transition"
                            title="Удалить"
                          >
                            <Trash size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {allKeys.length === 0 && (
                  <p className="text-white/30 text-center py-8">Нет ключей</p>
                )}
              </div>
            </div>
          )}

          {keysTab === "users" && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={22} className="text-white/70" />
                  <h2 className="text-2xl font-bold">Пользователи ({allUsers.length})</h2>
                </div>
                <button
                  onClick={loadUsers}
                  className="text-sm text-purple-400 hover:text-purple-300"
                >
                  Обновить
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[1200px]">
                  <thead>
                    <tr className="text-white/40 border-b border-white/10">
                      <th className="text-left py-3 px-2">UID</th>
                      <th className="text-left py-3 px-2">Имя</th>
                      <th className="text-left py-3 px-2">Email</th>
                      <th className="text-left py-3 px-2">Роль</th>
                      <th className="text-left py-3 px-2">Подписка</th>
                      <th className="text-left py-3 px-2">Баланс</th>
                      <th className="text-left py-3 px-2">HWID</th>
                      <th className="text-left py-3 px-2">Статус</th>
                      <th className="text-left py-3 px-2">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.map((u: any) => (
                      <tr key={u.id} className="border-b border-white/5">
                        <td className="py-3 px-2 text-white/60">{u.id}</td>
                        <td className="py-3 px-2 font-semibold text-white/90">{u.username}</td>
                        <td className="py-3 px-2 text-white/60">{u.email}</td>
                        <td className="py-3 px-2">
                          <select
                            value={u.role || "user"}
                            onChange={(e) => setRole(u.id, e.target.value)}
                            className="bg-black/40 px-2 py-1 rounded-lg border border-white/10 text-xs focus:border-purple-500 outline-none"
                          >
                            <option value="user">User</option>
                            <option value="media">Media</option>
                            <option value="tester">Tester</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="py-3 px-2 text-white/60">
                          {u.subscription_end
                            ? new Date(u.subscription_end.replace(" ", "T")) > new Date()
                              ? u.subscription_end
                              : "Истекла"
                            : "Нет"}
                        </td>
                        <td className="py-3 px-2 text-white/60">{u.balance ?? 0} ₽</td>
                        <td className="py-3 px-2 text-white/40 font-mono text-xs max-w-[120px] truncate">
                          {u.hwid || "—"}
                        </td>
                        <td className="py-3 px-2">
                          {u.banned ? (
                            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-300" title={u.ban_reason || ""}>
                              <Prohibit size={12} />
                              Забанен
                            </span>
                          ) : (
                            <span className="text-green-400 text-xs">Активен</span>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            {u.id !== 1 && (
                              <>
                                {u.subscription_end && (
                                  <button
                                    onClick={() => reduceSubscription(u.id)}
                                    className="text-yellow-400 hover:text-yellow-300 transition"
                                    title="Убрать дни подписки"
                                  >
                                    <Minus size={16} />
                                  </button>
                                )}
                                <button
                                  onClick={() => addSubscription(u.id)}
                                  className="text-green-400 hover:text-green-300 transition"
                                  title="Добавить дни подписки"
                                >
                                  <Plus size={16} />
                                </button>
                                <button
                                  onClick={() => addBalance(u.id)}
                                  className="text-amber-400 hover:text-amber-300 transition"
                                  title="Начислить/списать баланс"
                                >
                                  <Coin size={16} />
                                </button>
                                {u.banned ? (
                                  <button
                                    onClick={() => unbanUser(u.id)}
                                    className="text-green-400 hover:text-green-300 transition"
                                    title="Разбанить"
                                  >
                                    <Check size={16} weight="bold" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => banUser(u.id)}
                                    className="text-orange-400 hover:text-orange-300 transition"
                                    title="Забанить"
                                  >
                                    <Prohibit size={16} />
                                  </button>
                                )}
                                <button
                                  onClick={() => deleteUser(u.id)}
                                  className="text-red-400 hover:text-red-300 transition"
                                  title="Удалить"
                                >
                                  <Trash size={16} />
                                </button>
                                <button
                                  onClick={() => changePassword(u.id)}
                                  className="text-blue-400 hover:text-blue-300 transition"
                                  title="Сменить пароль"
                                >
                                  <Key size={16} />
                                </button>
                                <button
                                  onClick={() => changeUsername(u.id)}
                                  className="text-cyan-400 hover:text-cyan-300 transition"
                                  title="Сменить ник"
                                >
                                  <User size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {allUsers.length === 0 && (
                  <p className="text-white/30 text-center py-8">Нет пользователей</p>
                )}
              </div>
            </div>
          )}

          {keysTab === "news" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Создать новость */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7">
                <div className="flex items-center gap-2 mb-1">
                  <Key size={22} className="text-white/70" />
                  <h2 className="text-2xl font-bold">Новая новость</h2>
                </div>
                <p className="text-white/40 mb-5">Добавление новости на главную страницу.</p>

                <div className="mb-4">
                  <label className="text-white/40 text-xs mb-1 block">Тег</label>
                  <select
                    value={newsTag}
                    onChange={(e) => setNewsTag(e.target.value)}
                    className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
                  >
                    <option value="Обновление">Обновление</option>
                    <option value="Ивент">Ивент</option>
                    <option value="Важно">Важно</option>
                    <option value="Исправление">Исправление</option>
                    <option value="Анонс">Анонс</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="text-white/40 text-xs mb-1 block">Заголовок</label>
                  <input
                    type="text"
                    value={newsTitle}
                    onChange={(e) => setNewsTitle(e.target.value)}
                    placeholder="Название новости"
                    className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
                  />
                </div>

                <div className="mb-4">
                  <label className="text-white/40 text-xs mb-1 block">Содержание</label>
                  <textarea
                    value={newsContent}
                    onChange={(e) => setNewsContent(e.target.value)}
                    placeholder="Текст новости..."
                    rows={4}
                    className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none resize-none"
                  />
                </div>

                {newsMsg && (
                  <p className={`text-sm mb-3 ${newsMsg.includes("✓") ? "text-green-400" : "text-red-400"}`}>
                    {newsMsg}
                  </p>
                )}

                <button
                  onClick={createNews}
                  disabled={newsLoading || !newsTitle.trim() || !newsContent.trim()}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold transition bg-purple-600 hover:bg-purple-700 disabled:opacity-60"
                >
                  {newsLoading ? "Публикация..." : "Опубликовать"}
                </button>
              </div>

              {/* Список новостей */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Users size={22} className="text-white/70" />
                    <h2 className="text-2xl font-bold">Все новости ({allNews.length})</h2>
                  </div>
                  <button
                    onClick={loadNews}
                    className="text-sm text-purple-400 hover:text-purple-300"
                  >
                    Обновить
                  </button>
                </div>

                <div className="flex flex-col gap-4 max-h-96 overflow-y-auto">
                  {allNews.map((n: any) => (
                    <div key={n.id} className="bg-black/30 rounded-xl p-4 border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300">
                            {n.tag}
                          </span>
                          <span className="text-white/30 text-xs">{n.created_at?.slice(0, 10)}</span>
                        </div>
                        <button
                          onClick={() => deleteNews(n.id)}
                          className="text-red-400 hover:text-red-300 transition"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                      <h3 className="font-bold text-white/90 mb-1">{n.title}</h3>
                      <p className="text-white/50 text-sm">{n.content}</p>
                    </div>
                  ))}
                  {allNews.length === 0 && (
                    <p className="text-white/30 text-center py-8">Нет новостей</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {keysTab === "media" && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users size={22} className="text-white/70" />
                  <h2 className="text-2xl font-bold">Заявки на партнёрство ({partnerApps.length})</h2>
                </div>
                <button
                  onClick={() => { loadMedia(); loadPartnerApps(); }}
                  className="text-sm text-purple-400 hover:text-purple-300"
                >
                  Обновить
                </button>
              </div>

              <div className="flex flex-col gap-4 mb-8 max-h-[400px] overflow-y-auto">
                {partnerApps.map((a: any) => (
                  <div key={a.id} className="bg-black/30 rounded-xl p-4 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white/90 text-sm">{a.username}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          a.platform === "youtube"
                            ? "bg-red-500/20 text-red-300"
                            : "bg-white/10 text-white/80"
                        }`}>
                          {a.platform === "youtube" ? "YouTube" : "TikTok"}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          a.status === "approved" ? "bg-green-500/20 text-green-300" :
                          a.status === "rejected" ? "bg-red-500/20 text-red-300" :
                          "bg-yellow-500/20 text-yellow-300"
                        }`}>
                          {a.status === "approved" ? "Одобрено" : a.status === "rejected" ? "Отклонено" : "На рассмотрении"}
                        </span>
                      </div>
                      <span className="text-white/30 text-xs">{a.created_at?.slice(0, 10)}</span>
                    </div>

                    <a href={a.channel_link} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 text-sm truncate block mb-1">
                      {a.channel_link}
                    </a>
                    <p className="text-white/50 text-xs mb-1">Telegram: {a.telegram} · Средние просмотры: {a.views}</p>
                    {a.experience && <p className="text-white/50 text-xs mb-1">Опыт: {a.experience}</p>}
                    <p className="text-white/60 text-xs">Мотивация: {a.reason}</p>
                    {a.status === "rejected" && a.admin_note && (
                      <p className="text-red-300/80 text-xs mt-1">Причина отклонения: {a.admin_note}</p>
                    )}

                    {a.status === "pending" && (
                      <div className="flex flex-col gap-2 mt-3">
                        <button
                          onClick={() => approvePartner(a.id)}
                          className="self-start px-4 py-2 rounded-xl text-xs font-semibold bg-green-600 hover:bg-green-700 transition"
                        >
                          Одобрить и выдать медиа
                        </button>
                        {rejectId === a.id ? (
                          <div className="flex flex-col gap-2">
                            <input
                              type="text"
                              value={partnerRejectNote}
                              onChange={(e) => setPartnerRejectNote(e.target.value)}
                              placeholder="Причина отклонения"
                              className="w-full bg-black/40 px-3 py-2 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-xs"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => rejectPartner(a.id)}
                                className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 transition"
                              >
                                Подтвердить отклонение
                              </button>
                              <button
                                onClick={() => { setRejectId(null); setPartnerRejectNote(""); }}
                                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 border border-white/10 transition text-xs"
                              >
                                Отмена
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setRejectId(a.id); setPartnerRejectNote(""); }}
                            className="self-start px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 transition"
                          >
                            Отклонить
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {partnerApps.length === 0 && (
                  <p className="text-white/30 text-center py-6">Нет заявок</p>
                )}
              </div>

              <div className="border-t border-white/10 pt-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Users size={22} className="text-white/70" />
                    <h2 className="text-2xl font-bold">Заявки на выплату видео ({mediaSubmissions.length})</h2>
                  </div>
                  <button
                    onClick={loadMedia}
                    className="text-sm text-purple-400 hover:text-purple-300"
                  >
                    Обновить
                  </button>
                </div>

              <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto">
                {mediaSubmissions.map((s: any) => (
                  <div key={s.id} className="bg-black/30 rounded-xl p-4 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white/90 text-sm">{s.username}</span>
                        {s.platform && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            s.platform === "youtube"
                              ? "bg-red-500/20 text-red-300"
                              : "bg-white/10 text-white/80"
                          }`}>
                            {s.platform === "youtube" ? "YouTube" : "TikTok"}
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          s.status === "approved" ? "bg-green-500/20 text-green-300" :
                          s.status === "rejected" ? "bg-red-500/20 text-red-300" :
                          "bg-yellow-500/20 text-yellow-300"
                        }`}>
                          {s.status === "approved" ? "Одобрено" : s.status === "rejected" ? "Отклонено" : "На рассмотрении"}
                        </span>
                        {s.reward > 0 && <span className="text-green-400 text-sm">+{s.reward} ₽</span>}
                      </div>
                      <span className="text-white/30 text-xs">{s.created_at?.slice(0, 10)}</span>
                    </div>

                    <a href={s.video_url} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 text-sm truncate block mb-3">
                      {s.video_url}
                    </a>

                    {s.status === "approved" && Number(s.views) > 0 && (
                      <p className="text-white/40 text-xs mb-2">Просмотров на момент одобрения: {Number(s.views).toLocaleString("ru-RU")}</p>
                    )}

                    {s.admin_note && (
                      <p className="text-white/30 text-xs mb-2">Примечание: {s.admin_note}</p>
                    )}

                    {s.status === "pending" && (
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2">
                          <label className="text-white/40 text-xs whitespace-nowrap">Награда (₽):</label>
                          <input
                            type="number"
                            min={0}
                            value={mediaRewards[s.id] ?? ""}
                            onChange={(e) => setMediaRewards((prev) => ({ ...prev, [s.id]: Number(e.target.value) }))}
                            placeholder="0"
                            className="w-24 bg-black/40 px-3 py-2 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-xs"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-white/40 text-xs whitespace-nowrap">Просмотры:</label>
                          <input
                            type="number"
                            min={0}
                            value={mediaViews[s.id] ?? ""}
                            onChange={(e) => setMediaViews((prev) => ({ ...prev, [s.id]: Number(e.target.value) }))}
                            placeholder="0"
                            className="w-28 bg-black/40 px-3 py-2 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-xs"
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Примечание (необязательно)"
                          value={mediaNotes[s.id] ?? ""}
                          onChange={(e) => setMediaNotes((prev) => ({ ...prev, [s.id]: e.target.value }))}
                          className="flex-1 min-w-[160px] bg-black/40 px-3 py-2 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-xs"
                        />
                        <button
                          onClick={() => approveMedia(s.id)}
                          className="px-4 py-2 rounded-xl text-xs font-semibold bg-green-600 hover:bg-green-700 transition"
                        >
                          Одобрить
                        </button>
                        <button
                          onClick={() => rejectMedia(s.id)}
                          className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 transition"
                        >
                          Отклонить
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {mediaSubmissions.length === 0 && (
                  <p className="text-white/30 text-center py-8">Нет заявок</p>
                )}
              </div>
              </div>
            </div>
          )}

          {keysTab === "support" && (
          <div>
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <Headset size={22} className="text-white/70" />
                <h2 className="text-2xl font-bold">Тикеты ({visibleSupportTickets.length})</h2>
                {supportCsat && supportCsat.count > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-yellow-500/10 border border-yellow-400/25 text-yellow-200">
                    <Star size={12} weight="fill" /> CSAT {supportCsat.avg.toFixed(1)}/5 ·{" "}
                    {supportCsat.count}
                  </span>
                )}
              </div>
              <button
                onClick={loadSupport}
                className="text-sm text-purple-400 hover:text-purple-300"
              >
                Обновить
              </button>
            </div>

            <div className="flex flex-wrap gap-2 mb-5">
              <select
                value={supportCategoryFilter}
                onChange={(e) => setSupportCategoryFilter(e.target.value)}
                className="bg-black/40 px-3 py-2 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-sm text-white/75"
              >
                <option value="all">Все категории</option>
                {SUPPORT_CATEGORIES.map((entry) => (
                  <option key={entry.id} value={entry.label}>
                    {entry.label}
                  </option>
                ))}
              </select>
              <select
                value={supportStatusFilter}
                onChange={(e) => setSupportStatusFilter(e.target.value)}
                className="bg-black/40 px-3 py-2 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-sm text-white/75"
              >
                <option value="all">Все статусы</option>
                <option value="open">Открыт</option>
                <option value="pending">Ждёт игрока</option>
                <option value="closed">Закрыт</option>
              </select>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 mb-5">
              <div className="flex items-center gap-2 mb-3">
                <ChatCircleText size={18} className="text-purple-300" />
                <p className="text-sm font-semibold">Шаблоны ответов</p>
              </div>

              {supportTemplates.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {supportTemplates.map((tpl: any) => (
                    <span
                      key={tpl.id}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/60"
                    >
                      {tpl.title}
                      <button
                        type="button"
                        onClick={() => deleteTemplate(tpl.id)}
                        aria-label="Удалить шаблон"
                        className="text-white/30 hover:text-red-300 transition"
                      >
                        <Trash size={13} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="grid md:grid-cols-[220px_1fr_auto] gap-2">
                <input
                  value={templateTitle}
                  onChange={(e) => setTemplateTitle(e.target.value)}
                  maxLength={80}
                  placeholder="Название шаблона"
                  className="bg-black/40 px-3 py-2 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-sm"
                />
                <input
                  value={templateBody}
                  onChange={(e) => setTemplateBody(e.target.value)}
                  maxLength={3000}
                  placeholder="Текст ответа"
                  className="bg-black/40 px-3 py-2 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-sm"
                />
                <button
                  type="button"
                  onClick={saveTemplate}
                  disabled={templateBusy}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition"
                >
                  <Plus size={14} /> Добавить
                </button>
              </div>
              {templateMsg && (
                <p
                  className={`text-xs mt-2 ${
                    templateMsg.includes("✓") ? "text-emerald-300" : "text-red-300"
                  }`}
                >
                  {templateMsg}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-4 max-h-[600px] overflow-y-auto">
              {visibleSupportTickets.map((t: any) => (
                <div key={t.id} className="bg-black/30 rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white/90 text-sm">{t.subject}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        t.status === "closed"
                          ? "bg-white/10 text-white/50"
                          : t.status === "pending"
                            ? "bg-amber-500/15 text-amber-300"
                            : "bg-green-500/20 text-green-300"
                      }`}>
                        {t.status === "closed"
                          ? "Закрыт"
                          : t.status === "pending"
                            ? "Ждёт ответа игрока"
                            : "Открыт"}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/50">
                        {supportCategoryLabel(t.category)}
                      </span>
                      <span className="text-white/40 text-xs">{t.username}</span>
                      {t.csat_rating ? (
                        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-400/20 text-yellow-200">
                          <Star size={10} weight="fill" /> {t.csat_rating}/5
                        </span>
                      ) : t.status === "closed" ? (
                        <span className="text-[11px] text-white/25">без оценки</span>
                      ) : null}
                    </div>
                    <span className="text-white/30 text-xs">#{t.id} · {t.created_at?.slice(0, 10)}</span>
                  </div>

                  <div className="flex flex-col gap-2 mb-3">
                    {t.messages.map((m: any) => (
                      <div key={m.id} className={`rounded-xl p-3 border ${
                        m.is_admin ? "bg-purple-600/10 border-purple-500/20" : "bg-white/[0.03] border-white/5"
                      }`}>
                        <p className={`text-xs font-semibold mb-1 ${m.is_admin ? "text-purple-300" : "text-white/60"}`}>
                          {m.is_admin ? "Поддержка" : "Пользователь"}
                        </p>
                        <p className="text-white/80 text-sm whitespace-pre-wrap break-words">{m.body}</p>
                        {m.attachment_url && (
                          isImageAttachment(m.attachment_url) ? (
                            <a
                              href={m.attachment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block mt-2 max-w-xs rounded-lg overflow-hidden border border-white/10 hover:border-purple-400/40 transition"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={m.attachment_url}
                                alt={m.attachment_name || "Вложение"}
                                className="w-full max-h-56 object-contain bg-black/40"
                                loading="lazy"
                              />
                            </a>
                          ) : (
                            <a
                              href={m.attachment_url}
                              download={m.attachment_name || undefined}
                              className="mt-2 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/60 hover:text-white hover:border-purple-400/40 transition"
                            >
                              <FileText size={15} className="text-purple-300" />
                              <span className="max-w-[200px] truncate">
                                {m.attachment_name || "Файл"}
                              </span>
                              <DownloadSimple size={13} />
                            </a>
                          )
                        )}
                      </div>
                    ))}
                  </div>

                  {t.csat_comment && (
                    <p className="text-xs text-white/40 mb-2">
                      Комментарий к оценке: {t.csat_comment}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {supportTemplates.length > 0 && (
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const tpl = supportTemplates.find(
                            (entry: any) => String(entry.id) === e.target.value
                          );
                          if (tpl) insertTemplate(t.id, tpl.body);
                          e.currentTarget.value = "";
                        }}
                        className="bg-black/40 px-3 py-2 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-xs text-white/60"
                      >
                        <option value="">Шаблон…</option>
                        {supportTemplates.map((tpl: any) => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.title}
                          </option>
                        ))}
                      </select>
                    )}
                    <input
                      value={supportReplies[t.id] ?? ""}
                      onChange={(e) => setSupportReplies((prev) => ({ ...prev, [t.id]: e.target.value }))}
                      placeholder="Ответ..."
                      className="flex-1 min-w-[180px] bg-black/40 px-3 py-2 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-sm"
                    />
                    <button
                      onClick={() => replySupport(t.id)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 transition"
                    >
                      Ответить
                    </button>
                    {t.status === "closed" ? (
                      <button
                        onClick={() => setSupportStatus(t.id, "reopen")}
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 transition"
                      >
                        Открыть
                      </button>
                    ) : (
                      <button
                        onClick={() => setSupportStatus(t.id, "close")}
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 transition"
                      >
                        Закрыть
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {visibleSupportTickets.length === 0 && (
                <p className="text-white/30 text-center py-8">Тикетов нет</p>
              )}
            </div>
          </div>
          )}

          {keysTab === "bugs" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <WarningCircle size={22} className="text-white/70" />
                <h2 className="text-2xl font-bold">Баг-репорты ({bugReports.length})</h2>
              </div>
              <button
                onClick={loadBugs}
                className="text-sm text-purple-400 hover:text-purple-300"
              >
                Обновить
              </button>
            </div>

            <div className="flex flex-col gap-4 max-h-[600px] overflow-y-auto">
              {bugReports.map((b: any) => (
                <div key={b.id} className="bg-black/30 rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white/90 text-sm">{b.function_name}</span>
                      <span className="text-white/50 text-xs">{b.server_ip}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        b.frequency === "часто" ? "bg-red-500/20 text-red-300" : "bg-yellow-500/20 text-yellow-300"
                      }`}>
                        {b.frequency}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        b.status === "fixed" ? "bg-green-500/20 text-green-300"
                        : b.status === "in_progress" ? "bg-blue-500/20 text-blue-300"
                        : "bg-white/10 text-white/50"
                      }`}>
                        {b.status === "fixed" ? "Исправлено" : b.status === "in_progress" ? "В работе" : "Новый"}
                      </span>
                      <span className="text-white/40 text-xs">{b.username}</span>
                    </div>
                    <span className="text-white/30 text-xs">#{b.id} · {b.created_at?.slice(0, 10)}</span>
                  </div>

                  <p className="text-white/80 text-sm whitespace-pre-wrap break-words mb-3">{b.description}</p>

                  <div className="flex flex-wrap gap-2">
                    {b.status !== "in_progress" && (
                      <button
                        onClick={() => setBugStatus(b.id, "in_progress")}
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 transition"
                      >
                        В работу
                      </button>
                    )}
                    {b.status !== "fixed" && (
                      <button
                        onClick={() => setBugStatus(b.id, "fixed")}
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-green-600 hover:bg-green-700 transition"
                      >
                        Исправлено
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {bugReports.length === 0 && (
                <p className="text-white/30 text-center py-8">Баг-репортов нет</p>
              )}
            </div>
          </div>
          )}

          {keysTab === "reviews" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Star size={22} className="text-white/70" />
                <h2 className="text-2xl font-bold">Отзывы ({reviewsList.length})</h2>
              </div>
              <button onClick={loadReviews} className="text-sm text-purple-400 hover:text-purple-300">Обновить</button>
            </div>
            <div className="flex flex-col gap-4 max-h-[600px] overflow-y-auto">
              {reviewsList.map((r: any) => (
                <div key={r.id} className="bg-black/30 rounded-xl p-4 border border-white/5">
                  <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white/90 text-sm">{r.username}</span>
                      <span className="flex items-center gap-0.5">{[1,2,3,4,5].map(i=><Star key={i} size={13} weight={i<=r.rating?"fill":"regular"} className={i<=r.rating?"text-yellow-400":"text-white/20"}/>)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${r.status==="approved"?"bg-green-500/20 text-green-300":r.status==="rejected"?"bg-red-500/20 text-red-300":"bg-white/10 text-white/50"}`}>{r.status==="approved"?"Одобрен":r.status==="rejected"?"Отклонён":"На проверке"}</span>
                    </div>
                    <span className="text-white/30 text-xs">#{r.id} · {String(r.created_at).slice(0,10)}</span>
                  </div>
                  <p className="text-white/80 text-sm whitespace-pre-wrap break-words mb-3">{r.body}</p>
                  <div className="flex flex-wrap gap-2">
                    {r.status !== "approved" && <button onClick={()=>reviewAction(r.id,"approve")} disabled={reviewBusy} className="px-4 py-2 rounded-xl text-xs font-semibold bg-green-600 hover:bg-green-700 disabled:opacity-50 transition">Одобрить</button>}
                    {r.status !== "rejected" && <button onClick={()=>reviewAction(r.id,"reject")} disabled={reviewBusy} className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 disabled:opacity-50 transition">Отклонить</button>}
                    <button onClick={()=>deleteReview(r.id)} disabled={reviewBusy} className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600/80 hover:bg-red-700 disabled:opacity-50 transition">Удалить</button>
                  </div>
                </div>
              ))}
              {reviewsList.length === 0 && <p className="text-white/30 text-center py-8">Отзывов нет</p>}
            </div>
          </div>
          )}

          {keysTab === "promo" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Coin size={22} className="text-white/70" />
                <h2 className="text-2xl font-bold">
                  Промокоды ({promoFilter
                    ? `${promos.length} из ${promoSummary.reduce((n, s) => n + Number(s.total), 0)}`
                    : promoSummary.reduce((n, s) => n + Number(s.total), 0)})
                </h2>
              </div>
              <button onClick={() => loadPromos(promoFilter)} className="text-sm text-purple-400 hover:text-purple-300">Обновить</button>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              <button
                onClick={() => { setPromoFilter(0); loadPromos(0); }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                  promoFilter === 0
                    ? "bg-purple-600/80 border-purple-400/30 text-white"
                    : "bg-white/[0.03] border-white/10 text-white/60 hover:text-white"
                }`}
              >
                Все ({promoSummary.reduce((n, s) => n + Number(s.total), 0)})
              </button>
              {promoSummary.map((s: any) => {
                const amount = Number(s.amount);
                return (
                  <button
                    key={amount}
                    onClick={() => { setPromoFilter(amount); loadPromos(amount); }}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                      promoFilter === amount
                        ? "bg-purple-600/80 border-purple-400/30 text-white"
                        : "bg-white/[0.03] border-white/10 text-white/60 hover:text-white"
                    }`}
                  >
                    {amount} ₽ ({s.total})
                  </button>
                );
              })}
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 mb-6">
              <h3 className="text-xl font-bold mb-1">Создать промокод</h3>
              <p className="text-white/40 text-sm mb-4">
                Промокод начисляет только бонус на баланс. Подписку и её срок он не продлевает.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="text-white/40 text-xs mb-1 block">Код</label>
                  <input
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="STELLAR50"
                    className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none uppercase"
                  />
                </div>
                <div>
                  <label className="text-white/40 text-xs mb-1 block">Бонус, ₽</label>
                  <input
                    type="number"
                    min={1}
                    value={promoAmount || ""}
                    onChange={(e) => setPromoAmount(Number(e.target.value))}
                    className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-white/40 text-xs mb-1 block">Лимит активаций (0 — без лимита)</label>
                  <input
                    type="number"
                    min={0}
                    value={promoMaxUses || ""}
                    onChange={(e) => setPromoMaxUses(Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
                  />
                </div>
              </div>
              {promoMsg && (
                <p className={`text-sm mb-3 ${promoMsg.includes("✓") ? "text-green-400" : "text-red-400"}`}>{promoMsg}</p>
              )}
              <button
                onClick={createPromo}
                disabled={promoLoading || !promoCode.trim() || promoAmount < 1}
                className="px-6 py-3 rounded-xl font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition"
              >
                {promoLoading ? "Создание..." : "Создать"}
              </button>
            </div>

            <div className="space-y-3">
              {promos.map((p: any) => (
                <div key={p.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex items-center justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-white/90">{p.code}</span>
                      <span className="font-semibold text-green-300">+{p.amount} ₽</span>
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        p.active
                          ? "bg-green-500/15 border-green-400/30 text-green-300"
                          : "bg-white/5 border-white/10 text-white/40"
                      }`}>
                        {p.active ? "Активен" : "Отключён"}
                      </span>
                    </div>
                    <p className="text-xs text-white/40 mt-1">
                      Использовано: {p.used_count}{Number(p.max_uses) > 0 ? ` / ${p.max_uses}` : " (без лимита)"}
                      {p.expires_at ? ` · до ${String(p.expires_at).slice(0, 10)}` : ""}
                      {` · создан ${String(p.created_at).slice(0, 10)}`}
                    </p>
                  </div>
                  {p.active ? (
                    <button
                      onClick={() => disablePromo(p.id)}
                      className="shrink-0 px-4 py-2 rounded-xl text-xs font-semibold bg-red-500/15 border border-red-400/30 text-red-300 hover:bg-red-500/25 transition"
                    >
                      Отключить
                    </button>
                  ) : null}
                </div>
              ))}
              {promos.length === 0 && <p className="text-white/30 text-center py-8">Промокодов нет</p>}
            </div>
          </div>
          )}

          {(keysTab as any) === "stats" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Статистика</h2>
              <button onClick={loadStats} disabled={statsLoading} className="text-sm text-purple-400 hover:text-purple-300 disabled:opacity-50">{statsLoading?"Обновление...":"Обновить"}</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-black/30 rounded-2xl p-4 border border-white/5"><p className="text-white/40 text-sm">Пользователей</p><p className="text-2xl font-bold mt-1">{stats?.totalUsers ?? "—"}</p></div>
              <div className="bg-black/30 rounded-2xl p-4 border border-white/5"><p className="text-white/40 text-sm">Регистраций за 7д</p><p className="text-2xl font-bold mt-1">{stats?.regs7d ?? "—"}</p></div>
              <div className="bg-black/30 rounded-2xl p-4 border border-white/5"><p className="text-white/40 text-sm">Регистраций за 30д</p><p className="text-2xl font-bold mt-1">{stats?.regs30d ?? "—"}</p></div>
              <div className="bg-black/30 rounded-2xl p-4 border border-white/5"><p className="text-white/40 text-sm">Активных подписок</p><p className="text-2xl font-bold mt-1">{stats?.activeSubs ?? "—"}</p></div>
              <div className="bg-black/30 rounded-2xl p-4 border border-white/5"><p className="text-white/40 text-sm">Ключей выдано</p><p className="text-2xl font-bold mt-1">{stats?.keysTotal ?? "—"}</p></div>
              <div className="bg-black/30 rounded-2xl p-4 border border-white/5"><p className="text-white/40 text-sm">Ключей активировано</p><p className="text-2xl font-bold mt-1">{stats?.keysUsed ?? "—"}</p></div>
            </div>
            <div className="bg-black/30 rounded-2xl p-5 border border-white/5">
              <h3 className="font-semibold mb-3">Регистрации по дням (30д)</h3>
              {(stats?.byDay?.length ?? 0) === 0 ? (
                <p className="text-white/30 text-center py-8">Нет данных</p>
              ) : (
                <div className="flex items-end gap-1 h-40">
                  {stats.byDay.map((d:any,i:number)=>{
                    const max = Math.max(1,...stats.byDay.map((x:any)=>x.c));
                    return <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1"><div className="w-full bg-purple-500/60 rounded-t" style={{height:`${Math.max(4,(d.c/max)*100)}%`}} title={`${d.c} — ${d.day}`}></div><span className="text-[9px] text-white/30">{d.day.slice(5)}</span></div>;
                  })}
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
