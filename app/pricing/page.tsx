"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import PricingCard from "@/components/PricingCard";

type Product = {
  title: string;
  price: string;
  rub: number;
  href: string;
  days?: number;
  hwid?: boolean;
};

const products: Product[] = [
  { title: "1 день", price: "10 rubles", rub: 10, days: 1, href: "https://funpay.com/lots/offer?id=73168336" },
  { title: "3 дня", price: "20 rubles", rub: 20, days: 3, href: "https://funpay.com/lots/offer?id=73168722" },
  { title: "7 дней", price: "55 rubles", rub: 55, days: 7, href: "https://funpay.com/lots/offer?id=73168775" },
  { title: "30 дней", price: "130 rubles", rub: 130, days: 30, href: "https://funpay.com/lots/offer?id=73168850" },
  { title: "90 дней", price: "250 rubles", rub: 250, days: 90, href: "https://funpay.com/lots/offer?id=73168970" },
  { title: "180 дней", price: "400 rubles", rub: 400, days: 180, href: "https://funpay.com/lots/offer?id=73169053" },
  { title: "Навсегда", price: "300 rubles", rub: 300, days: 999999, href: "https://funpay.com/lots/offer?id=73169094" },
  { title: "Сброс HWID", price: "150 rubles", rub: 150, hwid: true, href: "https://funpay.com/lots/offer?id=73169217" },
];

export default function PricingPage() {
  const [selected, setSelected] = useState<Product | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

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
        setMsg("Войдите в аккаунт, чтобы оплатить с баланса");
        return;
      }
      if (!res.ok) {
        setMsg(data.error || "Ошибка");
        return;
      }
      setMsg(`Покупка успешна ✓ Новый баланс: ${data.balance}₽`);
      setBalance(data.balance);
    } catch {
      setMsg("Ошибка сервера");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header />

      <main className="text-white min-h-screen relative overflow-hidden">
        <section className="relative z-10 pt-48 pb-40 flex flex-col items-center px-6">
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-6xl font-extrabold mb-20 text-center"
          >
            Купить
          </motion.h1>

          <div className="flex flex-wrap gap-14 justify-center">
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
              <p className="text-white/50 mb-5">Цена: {selected.rub}₽</p>

              {balance !== null && (
                <p className="text-white/50 text-sm mb-4">
                  Ваш баланс: <span className="text-white font-semibold">{balance}₽</span>
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
                  {loading ? "Оплата..." : `Оплата с баланса — ${selected.rub}₽`}
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
                Закрыть
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </>
  );
}
