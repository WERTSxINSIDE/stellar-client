"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useI18n, type Lang } from "@/lib/i18n";
import {
  ArrowLeft,
  ArrowUpRight,
  ClockCounterClockwise,
  DownloadSimple,
  Package,
  ShoppingCartSimple,
  Ticket,
  Wallet,
} from "@phosphor-icons/react";

type Purchase = {
  id: number;
  title: string;
  description: string | null;
  type: string;
  status: string;
  price: number;
  paid_price: number;
  purchased_at: string;
  author_id: number;
  author_username: string;
  latest_version: string | null;
  latest_changelog: string | null;
  latest_version_at: string | null;
  has_file: boolean;
  url: string | null;
};

type Bundle = {
  id: number;
  bundle_id: number;
  title: string;
  description: string | null;
  price: number;
  purchased_at: string;
  items: { bundle_id: number; id: number; title: string; price: number }[];
};

type Promo = { amount: number; code: string; created_at: string };

type LibraryData = {
  purchases: Purchase[];
  bundles: Bundle[];
  promos: Promo[];
  totals: { purchases: number; spent: number; topped_up: number };
};

function fmtDate(value: string, lang: Lang) {
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(lang === "en" ? "en-GB" : "ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function LibraryPage() {
  const { lang } = useI18n();
  const tr = (ru: string, en: string) => (lang === "en" ? en : ru);
  const router = useRouter();
  const [data, setData] = useState<LibraryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) {
          router.replace("/login");
          return null;
        }
        return fetch("/api/library").then((r) => r.json());
      })
      .then((d) => {
        if (d?.ok) setData(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) return null;
  if (!data) return null;

  const hasAnything =
    data.purchases.length > 0 || data.bundles.length > 0 || data.promos.length > 0;

  return (
    <>
      <Header />
      <main className="relative min-h-screen pt-28 pb-24 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition mb-6"
          >
            <ArrowLeft size={18} />
            {tr("Назад в кабинет", "Back to dashboard")}
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold">
                {tr("Мои покупки", "My purchases")}
              </h1>
              <p className="text-white/45 mt-2 max-w-2xl">
                {tr(
                  "Купленные конфиги, наборы и история пополнений. Всё, что уже приобретено, хранится здесь.",
                  "Purchased configs, bundles and top-up history. Everything you bought is stored here."
                )}
              </p>
            </div>
            <Link
              href="/community"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-sm font-semibold transition"
            >
              <ShoppingCartSimple size={18} />
              {tr("В витрину", "Browse showcase")}
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            <StatCard
              icon={<Package size={20} />}
              label={tr("Куплено конфигов", "Configs purchased")}
              value={data.totals.purchases}
            />
            <StatCard
              icon={<Wallet size={20} />}
              label={tr("Потрачено", "Spent")}
              value={`${data.totals.spent} ₽`}
            />
            <StatCard
              icon={<Ticket size={20} />}
              label={tr("Пополнено промокодами", "Topped up with codes")}
              value={`${data.totals.topped_up} ₽`}
            />
          </div>

          {!hasAnything && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center">
              <Package size={34} className="mx-auto text-white/30 mb-4" />
              <h2 className="text-xl font-bold mb-2">
                {tr("Здесь пока пусто", "Nothing here yet")}
              </h2>
              <p className="text-white/40 text-sm mb-6">
                {tr(
                  "Купите первый конфиг в витрине или активируйте промокод — покупки появятся в библиотеке.",
                  "Buy your first config or activate a promo code — purchases will appear here."
                )}
              </p>
              <Link
                href="/community"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-sm font-semibold transition"
              >
                {tr("Открыть витрину", "Open showcase")}
                <ArrowUpRight size={16} />
              </Link>
            </div>
          )}

          {data.purchases.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-bold mb-4">
                {tr("Купленные конфиги", "Purchased configs")}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.purchases.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 flex flex-col"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold leading-snug">{item.title}</h3>
                        <Link
                          href={`/u/${encodeURIComponent(item.author_username)}`}
                          className="text-sm text-purple-300 hover:text-purple-200 transition"
                        >
                          @{item.author_username}
                        </Link>
                      </div>
                      <span className="shrink-0 text-xs px-2.5 py-1 rounded-full border border-green-400/30 bg-green-500/10 text-green-300">
                        {tr("Куплено", "Purchased")}
                      </span>
                    </div>

                    {item.description && (
                      <p className="text-white/40 text-sm leading-relaxed mb-4 line-clamp-3">
                        {item.description}
                      </p>
                    )}

                    <div className="text-xs text-white/40 space-y-1 mb-5">
                      <p>
                        {tr("Покупка", "Purchased")}: {fmtDate(item.purchased_at, lang)} ·{" "}
                        {item.paid_price} ₽
                      </p>
                      <p>
                        {tr("Версия", "Version")}:{" "}
                        <span className="text-white/70">
                          {item.latest_version || "1.0"}
                        </span>
                        {item.latest_version_at
                          ? ` · ${fmtDate(item.latest_version_at, lang)}`
                          : ""}
                      </p>
                      {item.latest_changelog && (
                        <p className="text-white/35">
                          {tr("Что нового", "What's new")}: {item.latest_changelog}
                        </p>
                      )}
                      {item.status !== "approved" && (
                        <p className="text-amber-300/80">
                          {tr(
                            "Материал временно скрыт автором или модератором.",
                            "This item is temporarily hidden by the author or moderator."
                          )}
                        </p>
                      )}
                    </div>

                    <div className="mt-auto flex flex-wrap gap-2">
                      {item.has_file && item.status === "approved" ? (
                        <a
                          href={`/api/showcase/${item.id}/download`}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-sm font-semibold transition"
                        >
                          <DownloadSimple size={17} />
                          {tr("Скачать", "Download")}
                        </a>
                      ) : item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-sm font-semibold transition"
                        >
                          <ArrowUpRight size={17} />
                          {tr("Открыть", "Open")}
                        </a>
                      ) : null}
                      <Link
                        href={`/community/config/${item.id}`}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-semibold transition"
                      >
                        {tr("Страница конфига", "Config page")}
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {data.bundles.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-bold mb-4">{tr("Купленные наборы", "Purchased bundles")}</h2>
              <div className="space-y-4">
                {data.bundles.map((bundle) => (
                  <article
                    key={bundle.id}
                    className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div>
                        <h3 className="text-lg font-bold">{bundle.title}</h3>
                        <p className="text-xs text-white/40 mt-1">
                          {fmtDate(bundle.purchased_at, lang)} · {bundle.price} ₽
                        </p>
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded-full border border-purple-400/30 bg-purple-500/10 text-purple-200">
                        {bundle.items.length} {tr("конфигов", "configs")}
                      </span>
                    </div>
                    {bundle.description && (
                      <p className="text-white/40 text-sm mb-4">{bundle.description}</p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {bundle.items.map((item) => (
                        <Link
                          key={item.id}
                          href={`/community/config/${item.id}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm hover:bg-white/[0.06] transition"
                        >
                          <span className="truncate">{item.title}</span>
                          <ArrowUpRight size={16} className="shrink-0 text-white/40" />
                        </Link>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {data.promos.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <ClockCounterClockwise size={22} className="text-white/60" />
                <h2 className="text-2xl font-bold">{tr("Пополнения и промокоды", "Top-ups and promo codes")}</h2>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white/[0.04] text-white/40 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="text-left font-medium px-5 py-3">{tr("Промокод", "Promo code")}</th>
                        <th className="text-right font-medium px-5 py-3">{tr("Сумма", "Amount")}</th>
                        <th className="text-right font-medium px-5 py-3">{tr("Дата", "Date")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {data.promos.map((promo, index) => (
                        <tr key={`${promo.code}-${index}`} className="hover:bg-white/[0.03] transition">
                          <td className="px-5 py-3 font-mono text-white/80">{promo.code}</td>
                          <td className="px-5 py-3 text-right text-green-300 font-semibold">
                            +{promo.amount} ₽
                          </td>
                          <td className="px-5 py-3 text-right text-white/40">
                            {fmtDate(promo.created_at, lang)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center gap-2 text-white/40 text-sm">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </div>
  );
}
