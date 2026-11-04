"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import PricingCard from "@/components/PricingCard";
import { useI18n } from "@/lib/i18n";

type Product = {
  title: string;
  price: string;
  rub: number;
  href: string;
  days?: number;
  hwid?: boolean;
};

export default function PricingPage() {
  const { t } = useI18n();
  const products: Product[] = [
    { title: t("pricing.30days"), price: "130", rub: 130, days: 30, href: "https://funpay.com/lots/offer?id=73168850" },
    { title: t("pricing.90days"), price: "250", rub: 250, days: 90, href: "https://funpay.com/lots/offer?id=73168970" },
    { title: t("pricing.180days"), price: "400", rub: 400, days: 180, href: "https://funpay.com/lots/offer?id=73169053" },
    { title: t("pricing.forever"), price: "300", rub: 300, days: 999999, href: "https://funpay.com/lots/offer?id=73169094" },
    { title: t("pricing.hwidReset"), price: "150", rub: 150, hwid: true, href: "https://funpay.com/lots/offer?id=73169217" },
  ];
  const [selected, setSelected] = useState<Product | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [topupLinks, setTopupLinks] = useState<Record<string, string>>({});
  const [topupAmounts, setTopupAmounts] = useState<number[]>([5, 10, 20, 50, 150, 200, 300, 400]);

  useEffect(() => {
    fetch("/api/topup", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          if (d.links) setTopupLinks(d.links);
          if (Array.isArray(d.amounts) && d.amounts.length) setTopupAmounts(d.amounts);
        }
      })
      .catch(() => {});
  }, []);

  function openModal(p: Product) {
    setSelected(p);
    setMsg("");
    setBalance(null);
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setBalance(d.user.balance ?? 0);
      })
      .catch(() => {});
  }

  function closeModal() {
    if (loading) return;
    setSelected(null);
  }

  async function buyWithBalance() {
    if (!selected) return;
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/balance-buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selected.hwid ? { hwid: true } : { days: selected.days }),
      });
      const data = await res.json();
      if (res.status === 401) {
        setMsg(t("pricing.loginToPay"));
        return;
      }
      if (!res.ok) {
        setMsg(data.error || t("common.error"));
        return;
      }
      setMsg(t("pricing.buySuccess", { balance: data.balance }));
      setBalance(data.balance);
    } catch {
      setMsg(t("common.serverError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header />

      <main className="text-white min-h-screen relative overflow-hidden">
        <section className="relative z-10 pt-32 sm:pt-40 lg:pt-48 pb-20 sm:pb-32 lg:pb-40 flex flex-col items-center px-4 sm:px-6">
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-10 sm:mb-16 lg:mb-20 text-center"
          >
            {t("pricing.title")}
          </motion.h1>

          <div className="flex flex-wrap gap-6 sm:gap-10 lg:gap-14 justify-center w-full">
            {products.map((p) => (
              <PricingCard
                key={p.title}
                title={p.title}
                price={p.price}
                image="/pricing.jpg"
                onClick={() => openModal(p)}
              />
            ))}
          </div>
        </section>

        <section id="topup" className="relative z-10 px-6 pb-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45 }}
            className="mx-auto max-w-6xl rounded-3xl border border-white/10 bg-white/[0.035] backdrop-blur-xl p-7 md:p-9"
          >
            <h2 className="text-3xl font-bold mb-1">{t("pricing.topupTitle")}</h2>
            <p className="text-white/45 text-sm max-w-2xl">{t("pricing.topupSubtitle")}</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-7">
              {topupAmounts.map((amount) => {
                const url = topupLinks[`topup_${amount}_url`];
                return url ? (
                  <a
                    key={amount}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group rounded-2xl border border-purple-400/25 bg-purple-500/10 hover:bg-purple-500/20 px-4 py-6 text-center transition"
                  >
                    <p className="text-2xl font-bold">{amount} ₽</p>
                    <p className="text-[11px] text-purple-200/70 mt-1">
                      {t("pricing.topupPay")}
                    </p>
                  </a>
                ) : (
                  <div
                    key={amount}
                    className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-6 text-center opacity-60"
                    title={t("pricing.topupSoon")}
                  >
                    <p className="text-2xl font-bold">{amount} ₽</p>
                    <p className="text-[11px] text-white/30 mt-1">
                      {t("pricing.topupSoon")}
                    </p>
                  </div>
                );
              })}
            </div>

            <p className="text-[11px] text-white/30 mt-4">{t("pricing.topupHint")}</p>
          </motion.div>
        </section>
      </main>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-6"
            onClick={closeModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-md rounded-3xl border border-white/10 bg-[#1a1a1a]/95 backdrop-blur-xl p-7 shadow-2xl shadow-black/60"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-2xl font-bold mb-1">{selected.title}</h3>
              <p className="text-white/50 mb-5">{t("pricing.price", { price: selected.rub })}</p>

              {balance !== null && (
                <p className="text-white/50 text-sm mb-4">
                  {t("pricing.yourBalance")} <span className="text-white font-semibold">{balance}₽</span>
                </p>
              )}

              <div className="flex flex-col gap-3">
                <a
                  href={selected.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 rounded-xl font-semibold bg-purple-600 hover:bg-purple-500 transition text-center"
                >
                  FunPay
                </a>
                <button
                  onClick={buyWithBalance}
                  disabled={loading}
                  className="w-full py-3 rounded-xl font-semibold bg-white/10 hover:bg-white/15 border border-white/10 disabled:opacity-50 transition"
                >
                  {loading ? t("pricing.paying") : t("pricing.payWithBalance", { price: selected.rub })}
                </button>
              </div>

              {msg && (
                <p className={`text-sm mt-4 ${msg.includes("✓") ? "text-green-400" : "text-red-400"}`}>{msg}</p>
              )}

              <button
                onClick={closeModal}
                disabled={loading}
                className="w-full mt-4 text-sm text-white/40 hover:text-white/70 transition disabled:opacity-50"
              >
                {t("pricing.close")}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </>
  );
}
