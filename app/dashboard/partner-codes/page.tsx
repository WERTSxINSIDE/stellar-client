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
  Copy,
  LinkSimple,
  Megaphone,
  Sparkle,
  Tag,
  UsersThree,
  WarningCircle,
} from "@phosphor-icons/react";

type CodeRow = {
  id: number;
  kind: "author" | "partner";
  code: string;
  discount_percent: number;
  max_uses: number;
  used_count: number;
  clicks: number;
  signups: number;
  sales_count: number;
  sales_amount: number;
  active: number;
  expires_at: string | null;
  created_at: string;
};

export default function PartnerCodesPage() {
  const { lang } = useI18n();
  const tr = (ru: string, en: string) => (lang === "en" ? en : ru);
  const router = useRouter();

  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [isPartner, setIsPartner] = useState(false);
  const [platform, setPlatform] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [percent, setPercent] = useState("10");
  const [maxUses, setMaxUses] = useState("0");
  const [expires, setExpires] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  async function load() {
    const res = await fetch("/api/discount-codes", { cache: "no-store" });
    if (res.status === 401) {
      router.replace("/login");
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      setNotice({ ok: false, text: data.error || tr("Ошибка загрузки", "Failed to load") });
      return;
    }
    setCodes(Array.isArray(data.codes) ? data.codes : []);
    setIsPartner(!!data.is_partner);
    setPlatform(data.partner_platform || null);
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createCode(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    const value = Number(percent);
    if (!Number.isInteger(value) || value < 1 || value > 70) {
      setNotice({ ok: false, text: tr("Скидка от 1% до 70%", "Discount must be 1%–70%") });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/discount-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "partner",
          discount_percent: value,
          max_uses: Number(maxUses || 0),
          expires_at: expires || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ ok: false, text: data.error || tr("Не удалось создать код", "Could not create code") });
        return;
      }
      setCodes((prev) => [data.code, ...prev]);
      setNotice({ ok: true, text: tr(`Код ${data.code.code} создан`, `Code ${data.code.code} created`) });
      setExpires("");
    } catch {
      setNotice({ ok: false, text: tr("Ошибка сервера", "Server error") });
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setNotice({ ok: false, text: tr("Не удалось скопировать", "Could not copy") });
    }
  }

  const partnerCodes = codes.filter((code) => code.kind === "partner");
  const totals = partnerCodes.reduce(
    (acc, code) => {
      acc.clicks += Number(code.clicks) || 0;
      acc.sales += Number(code.sales_count) || 0;
      acc.amount += Number(code.sales_amount) || 0;
      acc.used += Number(code.used_count) || 0;
      return acc;
    },
    { clicks: 0, sales: 0, amount: 0, used: 0 }
  );

  return (
    <>
      <Header />
      <main className="relative min-h-screen bg-[#0a0710] text-white">
        <div className="max-w-5xl mx-auto px-6 pt-36 pb-24">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-white/50 hover:text-white transition text-sm mb-8"
          >
            <ArrowLeft size={16} weight="bold" /> {tr("В кабинет", "Back to dashboard")}
          </Link>

          <div className="flex items-center gap-3 mb-2">
            <Megaphone size={28} weight="fill" className="text-purple-400" />
            <p className="text-white/40 text-xs tracking-widest uppercase">
              {tr("Партнёрам", "Partners")}
            </p>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-3">
            {tr("Коды стримеров", "Streamer codes")}
          </h1>
          <p className="text-white/45 mb-8 max-w-2xl">
            {tr(
              "Персональный промокод даёт зрителям скидку на конфиги, а вам — статистику переходов и продаж. Скидку оплачивает площадка: автор получает полную цену.",
              "A personal promo code gives viewers a discount on configs and shows you clicks and sales. The platform covers the discount: authors receive the full price."
            )}
          </p>

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

          {loading ? (
            <p className="text-white/40">{tr("Загрузка...", "Loading...")}</p>
          ) : !isPartner ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center">
              <UsersThree size={32} className="mx-auto text-purple-300 mb-3" />
              <h2 className="text-xl font-bold mb-2">
                {tr("Нужен статус партнёра", "Partner status required")}
              </h2>
              <p className="text-white/45 text-sm max-w-xl mx-auto mb-5">
                {tr(
                  "Коды доступны после одобрения медиа-заявки: YouTube, TikTok или иная площадка. Подайте заявку — мы свяжемся с вами.",
                  "Codes unlock after a media application is approved: YouTube, TikTok or another platform. Apply and we will get in touch."
                )}
              </p>
              <Link
                href="/dashboard/partner"
                className="inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 px-5 py-3 text-sm font-semibold transition"
              >
                <Megaphone size={17} /> {tr("Подать заявку", "Apply")}
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                  <p className="text-white/40 text-sm mb-1">{tr("Переходы", "Clicks")}</p>
                  <p className="text-2xl font-bold">{totals.clicks}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                  <p className="text-white/40 text-sm mb-1">{tr("Применений", "Redemptions")}</p>
                  <p className="text-2xl font-bold">{totals.used}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                  <p className="text-white/40 text-sm mb-1">{tr("Продаж", "Sales")}</p>
                  <p className="text-2xl font-bold">{totals.sales}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                  <p className="text-white/40 text-sm mb-1">{tr("Сумма", "Amount")}</p>
                  <p className="text-2xl font-bold">{totals.amount} ₽</p>
                </div>
              </div>

              {platform && (
                <p className="text-xs text-white/35 mb-6">
                  {tr("Площадка:", "Platform:")} <span className="text-white/60">{platform}</span>
                </p>
              )}

              <div className="grid lg:grid-cols-[1fr_1.4fr] gap-5">
                <form onSubmit={createCode} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Sparkle size={18} className="text-purple-300" />
                    {tr("Новый код", "New code")}
                  </h2>
                  <label className="text-[11px] text-white/40 block">
                    {tr("Скидка для зрителей, %", "Viewer discount, %")}
                    <input
                      type="number"
                      min={1}
                      max={70}
                      value={percent}
                      onChange={(e) => setPercent(e.target.value)}
                      className="mt-1 w-full bg-black/40 px-3 py-2.5 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-sm"
                    />
                  </label>
                  <label className="text-[11px] text-white/40 block mt-3">
                    {tr("Лимит (0 = без лимита)", "Limit (0 = unlimited)")}
                    <input
                      type="number"
                      min={0}
                      value={maxUses}
                      onChange={(e) => setMaxUses(e.target.value)}
                      className="mt-1 w-full bg-black/40 px-3 py-2.5 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-sm"
                    />
                  </label>
                  <label className="text-[11px] text-white/40 block mt-3">
                    {tr("Действует до (необязательно)", "Valid until (optional)")}
                    <input
                      type="date"
                      value={expires}
                      onChange={(e) => setExpires(e.target.value)}
                      className="mt-1 w-full bg-black/40 px-3 py-2.5 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-sm text-white/80"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={busy}
                    className="mt-4 w-full rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 px-4 py-2.5 text-sm font-semibold transition"
                  >
                    {busy ? tr("Создание...", "Creating...") : tr("Создать код", "Create code")}
                  </button>
                </form>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Tag size={18} className="text-amber-300" />
                    {tr("Мои коды", "My codes")}
                  </h2>
                  {partnerCodes.length === 0 ? (
                    <p className="text-sm text-white/35">{tr("Кодов пока нет.", "No codes yet.")}</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {partnerCodes.map((code) => {
                        const link = origin
                          ? `${origin}/?ref=${encodeURIComponent(code.code)}`
                          : `/?ref=${code.code}`;
                        return (
                          <div key={code.id} className="rounded-xl border border-white/10 bg-black/25 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-mono text-base font-bold text-amber-200">
                                {code.code}
                              </span>
                              <span className="text-[11px] text-white/40">
                                −{code.discount_percent}%
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/40">
                              <span>{code.clicks} {tr("кликов", "clicks")}</span>
                              <span>{code.used_count}{code.max_uses > 0 ? ` / ${code.max_uses}` : ""} {tr("исп.", "uses")}</span>
                              <span>{code.sales_count} {tr("продаж", "sales")}</span>
                              <span>{code.sales_amount} ₽</span>
                            </div>
                            <div className="mt-3 flex flex-col gap-2">
                              <button
                                type="button"
                                onClick={() => copy(code.code)}
                                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs font-semibold transition"
                              >
                                {copied === code.code ? (
                                  <CheckCircle size={13} className="text-emerald-400" />
                                ) : (
                                  <Copy size={13} />
                                )}
                                {tr("Скопировать код", "Copy code")}
                              </button>
                              <button
                                type="button"
                                onClick={() => copy(link)}
                                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-purple-400/25 bg-purple-500/10 hover:bg-purple-500/20 px-3 py-2 text-xs font-semibold text-purple-200 transition"
                              >
                                {copied === link ? (
                                  <CheckCircle size={13} className="text-emerald-400" />
                                ) : (
                                  <LinkSimple size={13} />
                                )}
                                {tr("Скопировать ссылку", "Copy link")}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <h2 className="text-lg font-bold mb-3">{tr("Медиа-кит", "Media kit")}</h2>
                <ul className="text-sm text-white/55 space-y-2 list-disc list-inside">
                  <li>
                    {tr(
                      "Ссылка с кодом запоминает источник перехода и считает клики.",
                      "A link with your code remembers the traffic source and counts clicks."
                    )}
                  </li>
                  <li>
                    {tr(
                      "Скидка действует на платные конфиги; наборы тоже участвуют.",
                      "The discount applies to paid configs and bundles."
                    )}
                  </li>
                  <li>
                    {tr(
                      "Автор конфига получает полную цену — скидку берёт на себя Stellar Client.",
                      "The config author receives the full price — Stellar Client covers the discount."
                    )}
                  </li>
                  <li>
                    {tr(
                      "Статистика обновляется в реальном времени: клики, применения и сумма.",
                      "Stats update in real time: clicks, redemptions and amount."
                    )}
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
