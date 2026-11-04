"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useI18n, type Lang } from "@/lib/i18n";
import {
  ArrowLeft,
  ArrowSquareOut,
  Bank,
  ChartLineUp,
  CheckCircle,
  Clock,
  Coins,
  Eye,
  Gift,
  Percent,
  Plus,
  Sparkle,
  StackSimple,
  Trash,
  UploadSimple,
  VideoCamera,
  WarningCircle,
} from "@phosphor-icons/react";

type AuthorItem = {
  id: number;
  type: string;
  title: string;
  price: number | null;
  status: string;
  admin_note: string | null;
  views: number | null;
  created_at: string;
  sales: number;
  earnings: number;
  ratings: number;
  avg_rating: number;
  conversion: number;
};

type Sale = {
  id: number;
  price: number;
  created_at: string;
  item_id: number;
  title: string;
  type: string;
  buyer: string;
};

type Totals = {
  views: number;
  sales: number;
  earnings: number;
  approved: number;
  pending: number;
  rejected: number;
  conversion: number;
  items: number;
};

type Me = { id: number; username: string } | null;

type PayoutRequest = {
  id: number;
  amount: number;
  method: string;
  details: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
};

type AuthorBundle = {
  id: number;
  title: string;
  description: string | null;
  discount_percent: number;
  status: string;
  created_at: string;
  items_count: number;
  base_price: number;
  final_price: number;
  items: { id: number; title: string; final_price: number; owned: boolean }[];
};

const MAX_FILE_BYTES = 1_500_000;
const ALLOWED_EXT = [".cfg", ".txt", ".json", ".ini", ".toml", ".yml", ".yaml", ".zip"];
const PAYOUT_STATUS: Record<string, { labelRu: string; labelEn: string; className: string }> = {
  pending: {
    labelRu: "На рассмотрении",
    labelEn: "Pending",
    className: "border-amber-400/25 bg-amber-500/10 text-amber-300",
  },
  approved: {
    labelRu: "Выплачено",
    labelEn: "Paid",
    className: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
  },
  rejected: {
    labelRu: "Отклонено",
    labelEn: "Rejected",
    className: "border-red-400/25 bg-red-500/10 text-red-300",
  },
};

const STATUS: Record<string, { labelRu: string; labelEn: string; className: string }> = {
  approved: {
    labelRu: "Одобрен",
    labelEn: "Approved",
    className: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
  },
  pending: {
    labelRu: "На модерации",
    labelEn: "Under review",
    className: "border-amber-400/25 bg-amber-500/10 text-amber-300",
  },
  rejected: {
    labelRu: "Отклонён",
    labelEn: "Rejected",
    className: "border-red-400/25 bg-red-500/10 text-red-300",
  },
  hidden: {
    labelRu: "Скрыт",
    labelEn: "Hidden",
    className: "border-white/10 bg-white/5 text-white/45",
  },
};

function statusLabel(status: { labelRu: string; labelEn: string }, lang: Lang) {
  return lang === "en" ? status.labelEn : status.labelRu;
}

function fmtDate(value: string, lang: Lang) {
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(lang === "en" ? "en-GB" : "ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-400/20 grid place-items-center mb-4 text-purple-300">
        {icon}
      </div>
      <p className="text-white/40 text-sm mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {hint && <p className="text-[11px] text-white/30 mt-1">{hint}</p>}
    </div>
  );
}

export default function AuthorPage() {
  const { lang } = useI18n();
  const tr = (ru: string, en: string) => (lang === "en" ? en : ru);
  const router = useRouter();
  const [me, setMe] = useState<Me>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AuthorItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [error, setError] = useState("");

  const [balance, setBalance] = useState(0);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [minPayout, setMinPayout] = useState(100);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("card");
  const [payoutDetails, setPayoutDetails] = useState("");
  const [payoutSending, setPayoutSending] = useState(false);
  const [payoutError, setPayoutError] = useState("");
  const [payoutDone, setPayoutDone] = useState("");

  const [bundles, setBundles] = useState<AuthorBundle[]>([]);
  const [bundleTitle, setBundleTitle] = useState("");
  const [bundleDescription, setBundleDescription] = useState("");
  const [bundleDiscount, setBundleDiscount] = useState("15");
  const [bundleItems, setBundleItems] = useState<number[]>([]);
  const [bundleSending, setBundleSending] = useState(false);
  const [bundleError, setBundleError] = useState("");
  const [bundleDone, setBundleDone] = useState("");

  const [versionFor, setVersionFor] = useState<number | null>(null);
  const [versionValue, setVersionValue] = useState("");
  const [versionChangelog, setVersionChangelog] = useState("");
  const [versionFile, setVersionFile] = useState<{ name: string; data: string } | null>(null);
  const [versionSending, setVersionSending] = useState(false);
  const [versionError, setVersionError] = useState("");
  const [versionDone, setVersionDone] = useState("");
  const versionInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) {
          router.replace("/login");
          return;
        }
        setMe(d.user);
        return fetch("/api/author/stats", { cache: "no-store" })
          .then((r) => r.json())
          .then((data) => {
            if (!data.ok) {
              setError(data.error || tr("Не удалось загрузить статистику", "Could not load statistics"));
              return;
            }
            setItems(Array.isArray(data.items) ? data.items : []);
            setSales(Array.isArray(data.sales) ? data.sales : []);
            setTotals(data.totals || null);
          });
      })
      .catch(() => setError(tr("Ошибка сервера", "Server error")))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!me) return;
    fetch("/api/author/payouts", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) return;
        setBalance(Number(data.balance || 0));
        setPayouts(Array.isArray(data.requests) ? data.requests : []);
        setMinPayout(Number(data.min_amount || 100));
        if (Array.isArray(data.methods) && data.methods.length > 0) {
          setPayoutMethod((current) => (data.methods.includes(current) ? current : data.methods[0]));
        }
      })
      .catch(() => {});

    fetch("/api/showcase/bundles?mine=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setBundles(Array.isArray(data.bundles) ? data.bundles : []);
      })
      .catch(() => {});
  }, [me]);

  async function submitPayout(e: React.FormEvent) {
    e.preventDefault();
    setPayoutError("");
    setPayoutDone("");
    const amount = Number(payoutAmount);
    if (!Number.isInteger(amount) || amount < minPayout) {
      setPayoutError(tr(`Минимальная сумма — ${minPayout} ₽`, `Minimum amount is ${minPayout} ₽`));
      return;
    }
    if (payoutDetails.trim().length < 3) {
      setPayoutError(tr("Укажите реквизиты для вывода", "Enter payout details"));
      return;
    }
    setPayoutSending(true);
    try {
      const res = await fetch("/api/author/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          method: payoutMethod,
          details: payoutDetails.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPayoutError(data.error || tr("Не удалось создать заявку", "Could not create request"));
        return;
      }
      setBalance(Number(data.balance || 0));
      setPayoutAmount("");
      setPayoutDetails("");
      setPayoutDone(tr("Заявка создана. Средства зарезервированы.", "Request created. Funds are reserved."));
      const refreshed = await fetch("/api/author/payouts", { cache: "no-store" }).then((r) => r.json());
      if (refreshed.ok) setPayouts(Array.isArray(refreshed.requests) ? refreshed.requests : []);
    } catch {
      setPayoutError(tr("Ошибка сервера", "Server error"));
    } finally {
      setPayoutSending(false);
    }
  }

  async function createBundle(e: React.FormEvent) {
    e.preventDefault();
    setBundleError("");
    setBundleDone("");
    if (bundleItems.length < 2) {
      setBundleError(tr("Выберите минимум 2 конфига", "Select at least 2 configs"));
      return;
    }
    setBundleSending(true);
    try {
      const res = await fetch("/api/showcase/bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: bundleTitle.trim(),
          description: bundleDescription.trim(),
          discount_percent: Number(bundleDiscount || 0),
          item_ids: bundleItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBundleError(data.error || tr("Не удалось создать набор", "Could not create bundle"));
        return;
      }
      setBundleTitle("");
      setBundleDescription("");
      setBundleItems([]);
      setBundleDone(tr("Набор создан", "Bundle created"));
      const refreshed = await fetch("/api/showcase/bundles?mine=1", {
        cache: "no-store",
      }).then((r) => r.json());
      if (refreshed.ok) setBundles(Array.isArray(refreshed.bundles) ? refreshed.bundles : []);
    } catch {
      setBundleError(tr("Ошибка сервера", "Server error"));
    } finally {
      setBundleSending(false);
    }
  }

  async function deleteBundle(id: number) {
    setBundleError("");
    try {
      const res = await fetch(`/api/showcase/bundles?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setBundleError(data.error || tr("Не удалось удалить набор", "Could not delete bundle"));
        return;
      }
      setBundles((prev) => prev.filter((bundle) => bundle.id !== id));
    } catch {
      setBundleError(tr("Ошибка сервера", "Server error"));
    }
  }

  function pickVersionFile(selected: File | null) {
    setVersionError("");
    setVersionFile(null);
    if (!selected) return;
    const lower = selected.name.toLowerCase();
    if (!ALLOWED_EXT.some((ext) => lower.endsWith(ext))) {
      setVersionError(
        tr(
          "Недопустимый файл. Разрешены cfg, txt, json, ini, toml, yml, zip.",
          "Unsupported file. Allowed: cfg, txt, json, ini, toml, yml, zip."
        )
      );
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      setVersionError(tr("Файл больше 1,5 МБ", "File is larger than 1.5 MB"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      setVersionFile({
        name: selected.name,
        data: result.includes(",") ? result.split(",").pop() || "" : result,
      });
    };
    reader.onerror = () => setVersionError(tr("Не удалось прочитать файл", "Could not read file"));
    reader.readAsDataURL(selected);
  }

  async function publishVersion(itemId: number) {
    setVersionError("");
    setVersionDone("");
    if (!versionValue.trim()) {
      setVersionError(tr("Укажите версию", "Enter a version"));
      return;
    }
    if (!versionFile) {
      setVersionError(tr("Выберите файл", "Choose a file"));
      return;
    }
    setVersionSending(true);
    try {
      const res = await fetch(`/api/showcase/${itemId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: versionValue.trim(),
          changelog: versionChangelog.trim(),
          file_name: versionFile.name,
          file_data: versionFile.data,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVersionError(data.error || tr("Не удалось опубликовать версию", "Could not publish version"));
        return;
      }
      setVersionDone(
        tr(
          "Версия опубликована. Покупатели и подписчики получили уведомление.",
          "Version published. Buyers and followers were notified."
        )
      );
      setVersionValue("");
      setVersionChangelog("");
      setVersionFile(null);
      if (versionInputRef.current) versionInputRef.current.value = "";
    } catch {
      setVersionError(tr("Ошибка сервера", "Server error"));
    } finally {
      setVersionSending(false);
    }
  }

  const configs = items.filter((item) => item.type === "config" && item.status === "approved");
  const methodLabels: Record<string, string> = {
    card: tr("Карта", "Card"),
    sbp: tr("СБП", "SBP"),
    crypto: tr("Криптовалюта", "Crypto"),
    funpay: tr("FunPay", "FunPay"),
  };

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

          <div className="flex items-center gap-3 mb-2">
            <Sparkle size={28} weight="fill" className="text-purple-400" />
            <p className="text-white/40 text-xs tracking-widest uppercase">{tr("Витрина", "Showcase")}</p>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-3">{tr("Кабинет автора", "Author cabinet")}</h1>
          <p className="text-white/45 mb-8">
            {tr("Продажи, заработок, конверсия и статус модерации ваших материалов.", "Sales, earnings, conversion and moderation status of your materials.")}
          </p>

          {loading ? (
            <p className="text-white/35 text-center py-16">{tr("Загрузка...", "Loading...")}</p>
          ) : error ? (
            <p className="text-red-300 flex items-center gap-2">
              <WarningCircle size={18} /> {error}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard
                  icon={<Coins size={18} />}
                  label={tr("Заработано", "Earned")}
                  value={`${(totals?.earnings ?? 0).toLocaleString(lang === "en" ? "en-US" : "ru-RU")} ₽`}
                  hint={tr("100% с каждой продажи", "100% of every sale")}
                />
                <StatCard
                  icon={<ChartLineUp size={18} />}
                  label={tr("Продаж", "Sales")}
                  value={String(totals?.sales ?? 0)}
                  hint={tr(`${totals?.items ?? 0} материалов`, `${totals?.items ?? 0} items`)}
                />
                <StatCard
                  icon={<Eye size={18} />}
                  label={tr("Просмотров", "Views")}
                  value={String(totals?.views ?? 0)}
                />
                <StatCard
                  icon={<Percent size={18} />}
                  label={tr("Конверсия", "Conversion")}
                  value={`${(totals?.conversion ?? 0).toFixed(1)}%`}
                  hint={tr("Просмотр → покупка", "View → purchase")}
                />
              </div>

              <div className="flex flex-wrap gap-2 mb-8">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
                  <CheckCircle size={14} /> {tr("Одобрено:", "Approved:")} {totals?.approved ?? 0}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
                  <Clock size={14} /> {tr("На модерации:", "Under review:")} {totals?.pending ?? 0}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-1.5 text-xs text-red-300">
                  <WarningCircle size={14} /> {tr("Отклонено:", "Rejected:")} {totals?.rejected ?? 0}
                </span>
                <Link
                  href="/community"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-purple-400/25 bg-purple-500/10 px-3 py-1.5 text-xs text-purple-200 hover:bg-purple-500/20 transition"
                >
                  <Sparkle size={14} /> {tr("Предложить материал", "Suggest material")}
                </Link>
              </div>

              <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 mb-6">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Bank size={20} className="text-emerald-300" />
                      {tr("Баланс и вывод", "Balance & payouts")}
                    </h2>
                    <p className="text-white/40 text-sm mt-1">
                      {tr(
                        "Заработок зачисляется на баланс. Вывести можно от",
                        "Earnings are credited to your balance. Minimum payout:"
                      )}{" "}
                      {minPayout} ₽.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-5 py-3">
                    <p className="text-[11px] text-emerald-200/70 uppercase tracking-wide">
                      {tr("Доступно", "Available")}
                    </p>
                    <p className="text-2xl font-bold text-emerald-200">{balance} ₽</p>
                  </div>
                </div>

                <div className="grid lg:grid-cols-2 gap-5">
                  <form onSubmit={submitPayout} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-sm font-semibold mb-3">{tr("Новая заявка", "New request")}</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <input
                        type="number"
                        min={minPayout}
                        step={1}
                        value={payoutAmount}
                        onChange={(e) => setPayoutAmount(e.target.value)}
                        placeholder={tr("Сумма, ₽", "Amount, ₽")}
                        className="w-full bg-black/40 px-3 py-2.5 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-sm"
                      />
                      <select
                        value={payoutMethod}
                        onChange={(e) => setPayoutMethod(e.target.value)}
                        className="w-full bg-black/40 px-3 py-2.5 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-sm text-white/80"
                      >
                        {Object.entries(methodLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      value={payoutDetails}
                      onChange={(e) => setPayoutDetails(e.target.value)}
                      maxLength={300}
                      placeholder={tr(
                        "Реквизиты: номер карты, телефон или кошелёк",
                        "Details: card number, phone or wallet"
                      )}
                      className="mt-3 w-full bg-black/40 px-3 py-2.5 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-sm"
                    />
                    {payoutError && (
                      <p className="text-xs text-red-300 mt-2 flex items-center gap-1.5">
                        <WarningCircle size={14} /> {payoutError}
                      </p>
                    )}
                    {payoutDone && (
                      <p className="text-xs text-emerald-300 mt-2 flex items-center gap-1.5">
                        <CheckCircle size={14} /> {payoutDone}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={payoutSending || balance < minPayout}
                      className="mt-3 w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-4 py-2.5 text-sm font-semibold transition"
                    >
                      {payoutSending
                        ? tr("Отправка...", "Sending...")
                        : tr("Создать заявку", "Create request")}
                    </button>
                  </form>

                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-sm font-semibold mb-3">{tr("История заявок", "Request history")}</p>
                    {payouts.length === 0 ? (
                      <p className="text-xs text-white/35 py-4">
                        {tr("Заявок пока нет.", "No requests yet.")}
                      </p>
                    ) : (
                      <div className="flex flex-col divide-y divide-white/[0.06] max-h-72 overflow-y-auto pr-1">
                        {payouts.map((request) => {
                          const status = PAYOUT_STATUS[request.status] || PAYOUT_STATUS.pending;
                          return (
                            <div key={request.id} className="py-2.5 first:pt-0 last:pb-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-white/80">
                                  #{request.id} · {request.amount} ₽
                                </span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${status.className}`}>
                                  {statusLabel(status, lang)}
                                </span>
                              </div>
                              <p className="text-[11px] text-white/35">
                                {methodLabels[request.method] || request.method} ·{" "}
                                {fmtDate(request.created_at, lang)}
                              </p>
                              {request.admin_note && (
                                <p className="text-[11px] text-white/45 mt-1">
                                  {tr("Комментарий:", "Note:")} {request.admin_note}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <div className="grid lg:grid-cols-2 gap-6">
                <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                  <h2 className="text-xl font-bold mb-4">{tr("Топ материалов", "Top materials")}</h2>

                  {items.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
                      <p className="text-white/40 text-sm mb-4">
                        {tr("У вас пока нет материалов на витрине.", "You have no materials on the showcase yet.")}
                      </p>
                      <Link
                        href="/community"
                        className="inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2.5 text-sm font-semibold transition"
                      >
                        <Sparkle size={16} /> {tr("Загрузить конфиг", "Upload a config")}
                      </Link>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {items.map((item) => {
                        const status = STATUS[item.status] || STATUS.pending;
                        return (
                          <div
                            key={item.id}
                            className="rounded-2xl border border-white/10 bg-black/25 p-4"
                          >
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex items-start gap-2 min-w-0">
                                <span className="mt-0.5 shrink-0 text-purple-300">
                                  {item.type === "config" ? (
                                    <StackSimple size={16} weight="fill" />
                                  ) : (
                                    <VideoCamera size={16} weight="fill" />
                                  )}
                                </span>
                                <Link
                                  href={`/community/${item.type}/${item.id}`}
                                  className="font-semibold text-sm text-white hover:text-purple-300 transition line-clamp-2"
                                >
                                  {item.title}
                                </Link>
                              </div>
                              <span
                                className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full border ${status.className}`}
                              >
                                {statusLabel(status, lang)}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/40">
                              {item.type === "config" && (
                                <span>{item.price ? `${item.price} ₽` : tr("Бесплатно", "Free")}</span>
                              )}
                              <span className="inline-flex items-center gap-1">
                                <Eye size={11} /> {item.views || 0}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Coins size={11} /> {item.sales} {tr("продаж", "sales")} · {item.earnings} ₽
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Percent size={11} /> {item.conversion.toFixed(1)}%
                              </span>
                              <span>
                                {item.avg_rating > 0
                                  ? `★ ${item.avg_rating.toFixed(1)} (${item.ratings})`
                                  : tr("без оценок", "no ratings")}
                              </span>
                            </div>

                            {item.type === "config" && item.status === "approved" && (
                              <div className="mt-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setVersionFor(versionFor === item.id ? null : item.id);
                                    setVersionError("");
                                    setVersionDone("");
                                    setVersionValue("");
                                    setVersionChangelog("");
                                    setVersionFile(null);
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-purple-400/25 bg-purple-500/10 px-2.5 py-1 text-[11px] font-semibold text-purple-200 hover:bg-purple-500/20 transition"
                                >
                                  <UploadSimple size={13} />
                                  {tr("Новая версия", "New version")}
                                </button>

                                {versionFor === item.id && (
                                  <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
                                    <div className="grid sm:grid-cols-2 gap-2">
                                      <input
                                        value={versionValue}
                                        onChange={(e) => setVersionValue(e.target.value)}
                                        maxLength={24}
                                        placeholder={tr("Версия, напр. 1.2.0", "Version, e.g. 1.2.0")}
                                        className="w-full bg-black/40 px-3 py-2 rounded-lg border border-white/10 focus:border-purple-500 outline-none text-xs"
                                      />
                                      <input
                                        ref={versionInputRef}
                                        type="file"
                                        accept={ALLOWED_EXT.join(",")}
                                        onChange={(e) => pickVersionFile(e.target.files?.[0] || null)}
                                        className="hidden"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => versionInputRef.current?.click()}
                                        className="rounded-lg border border-dashed border-white/20 bg-white/[0.03] hover:border-purple-400/40 px-3 py-2 text-xs text-white/60 text-left truncate transition"
                                      >
                                        {versionFile?.name || tr("Выбрать файл", "Choose file")}
                                      </button>
                                    </div>
                                    <textarea
                                      value={versionChangelog}
                                      onChange={(e) => setVersionChangelog(e.target.value)}
                                      rows={2}
                                      maxLength={1000}
                                      placeholder={tr("Что изменилось", "What changed")}
                                      className="mt-2 w-full bg-black/40 px-3 py-2 rounded-lg border border-white/10 focus:border-purple-500 outline-none resize-none text-xs"
                                    />
                                    {versionError && (
                                      <p className="text-[11px] text-red-300 mt-1.5 flex items-center gap-1">
                                        <WarningCircle size={12} /> {versionError}
                                      </p>
                                    )}
                                    {versionDone && (
                                      <p className="text-[11px] text-emerald-300 mt-1.5 flex items-center gap-1">
                                        <CheckCircle size={12} /> {versionDone}
                                      </p>
                                    )}
                                    <div className="flex gap-2 mt-2">
                                      <button
                                        type="button"
                                        onClick={() => publishVersion(item.id)}
                                        disabled={versionSending}
                                        className="rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-60 px-3 py-1.5 text-xs font-semibold transition"
                                      >
                                        {versionSending
                                          ? tr("Публикация...", "Publishing...")
                                          : tr("Опубликовать", "Publish")}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setVersionFor(null)}
                                        className="rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 text-xs transition"
                                      >
                                        {tr("Отмена", "Cancel")}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {item.status === "rejected" && (
                              <p className="mt-2 rounded-lg border border-red-400/20 bg-red-500/[0.07] px-3 py-2 text-xs text-red-200/80">
                                <span className="font-semibold">{tr("Причина отклонения:", "Rejection reason:")}</span>{" "}
                                {item.admin_note?.trim() || tr("не указана", "not specified")}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                  <h2 className="text-xl font-bold mb-4">{tr("История продаж", "Sales history")}</h2>

                  {sales.length === 0 ? (
                    <p className="text-white/35 text-sm text-center py-10">
                      {tr("Продаж пока нет. Опубликуйте платный конфиг — покупатели увидят его в", "No sales yet. Publish a paid config — buyers will see it in")}
                      {tr("витрине.", "the showcase.")}
                    </p>
                  ) : (
                    <div className="flex flex-col divide-y divide-white/[0.06]">
                      {sales.map((sale) => (
                        <div key={sale.id} className="flex items-center justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <Link
                              href={`/community/${sale.type}/${sale.item_id}`}
                              className="text-sm text-white/80 hover:text-purple-300 transition line-clamp-1"
                            >
                              {sale.title}
                            </Link>
                            <p className="text-[11px] text-white/35">
                              {tr("Покупатель:", "Buyer:")}{" "}
                              <Link
                                href={`/u/${encodeURIComponent(sale.buyer)}`}
                                className="hover:text-purple-300 transition"
                              >
                                {sale.buyer}
                              </Link>{" "}
                              · {fmtDate(sale.created_at, lang)}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-300">
                            +{sale.price} ₽
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Gift size={22} className="text-purple-300" />
                  <h2 className="text-xl font-bold">{tr("Наборы со скидкой", "Discounted bundles")}</h2>
                </div>
                <p className="text-white/40 text-sm mb-5">
                  {tr(
                    "Объедините от 2 до 20 своих одобренных конфигов и продавайте их дешевле.",
                    "Combine 2 to 20 of your approved configs and sell them at a discount."
                  )}
                </p>

                <div className="grid lg:grid-cols-2 gap-5">
                  <form onSubmit={createBundle} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="grid sm:grid-cols-[1fr_100px] gap-2">
                      <input
                        value={bundleTitle}
                        onChange={(e) => setBundleTitle(e.target.value)}
                        maxLength={80}
                        placeholder={tr("Название набора", "Bundle title")}
                        className="w-full bg-black/40 px-3 py-2.5 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-sm"
                      />
                      <input
                        type="number"
                        min={1}
                        max={90}
                        step={1}
                        value={bundleDiscount}
                        onChange={(e) => setBundleDiscount(e.target.value)}
                        placeholder="%"
                        className="w-full bg-black/40 px-3 py-2.5 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-sm"
                      />
                    </div>
                    <textarea
                      value={bundleDescription}
                      onChange={(e) => setBundleDescription(e.target.value)}
                      rows={2}
                      maxLength={500}
                      placeholder={tr("Описание (необязательно)", "Description (optional)")}
                      className="mt-2 w-full bg-black/40 px-3 py-2.5 rounded-xl border border-white/10 focus:border-purple-500 outline-none resize-none text-sm"
                    />

                    <p className="text-[11px] text-white/40 mt-3 mb-2">
                      {tr("Выберите конфиги", "Select configs")} ({bundleItems.length}/20)
                    </p>
                    {configs.length === 0 ? (
                      <p className="text-xs text-white/35">
                        {tr(
                          "Нет одобренных конфигов — сначала опубликуйте материал.",
                          "No approved configs yet — publish an item first."
                        )}
                      </p>
                    ) : (
                      <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                        {configs.map((config) => {
                          const checked = bundleItems.includes(config.id);
                          return (
                            <button
                              key={config.id}
                              type="button"
                              onClick={() =>
                                setBundleItems((prev) =>
                                  checked
                                    ? prev.filter((id) => id !== config.id)
                                    : prev.length >= 20
                                      ? prev
                                      : [...prev, config.id]
                                )
                              }
                              className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs text-left transition ${
                                checked
                                  ? "border-purple-400/40 bg-purple-500/15 text-purple-100"
                                  : "border-white/10 bg-white/[0.03] text-white/60 hover:text-white"
                              }`}
                            >
                              <span className="truncate">{config.title}</span>
                              <span className="shrink-0 text-white/35">
                                {config.price ? `${config.price} ₽` : tr("бесплатно", "free")}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {bundleError && (
                      <p className="text-xs text-red-300 mt-2 flex items-center gap-1.5">
                        <WarningCircle size={14} /> {bundleError}
                      </p>
                    )}
                    {bundleDone && (
                      <p className="text-xs text-emerald-300 mt-2 flex items-center gap-1.5">
                        <CheckCircle size={14} /> {bundleDone}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={bundleSending || configs.length < 2}
                      className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 px-4 py-2.5 text-sm font-semibold transition"
                    >
                      <Plus size={15} />
                      {bundleSending
                        ? tr("Создание...", "Creating...")
                        : tr("Создать набор", "Create bundle")}
                    </button>
                  </form>

                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-sm font-semibold mb-3">{tr("Мои наборы", "My bundles")}</p>
                    {bundles.length === 0 ? (
                      <p className="text-xs text-white/35 py-4">
                        {tr("Наборов пока нет.", "No bundles yet.")}
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
                        {bundles.map((bundle) => (
                          <div
                            key={bundle.id}
                            className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-white/85 line-clamp-1">
                                  {bundle.title}
                                </p>
                                <p className="text-[11px] text-white/35">
                                  {tr("Конфигов:", "Configs:")} {bundle.items_count} ·{" "}
                                  {tr("Скидка", "Discount")} {bundle.discount_percent}%
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => deleteBundle(bundle.id)}
                                aria-label={tr("Удалить набор", "Delete bundle")}
                                className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/40 hover:text-red-300 hover:border-red-400/30 transition"
                              >
                                <Trash size={14} />
                              </button>
                            </div>
                            <p className="text-[11px] text-emerald-300/80 mt-1">
                              {bundle.final_price} ₽{" "}
                              {bundle.base_price > bundle.final_price && (
                                <span className="text-white/30 line-through">
                                  {bundle.base_price} ₽
                                </span>
                              )}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {items.length > 0 && (
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-white/40 flex items-center justify-between gap-3 flex-wrap">
                  <span>
                    {tr("Покупателям показываются только имя пользователя и дата покупки — без", "Buyers only see the username and purchase date — no")}
                    {tr("email, баланса и HWID.", "email, balance or HWID.")}
                  </span>
                  <Link
                    href="/community"
                    className="inline-flex items-center gap-1 text-purple-300 hover:text-purple-200 transition"
                  >
                    {tr("Перейти в витрину", "Go to showcase")} <ArrowSquareOut size={13} />
                  </Link>
                </div>
              )}

              {me && (
                <p className="text-[11px] text-white/20 mt-4">
                  {tr("Вы вошли как", "Signed in as")} {me.username}. {tr("Данные обновляются при открытии страницы.", "Data refreshes when the page opens.")}
                </p>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
