"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, CheckCircle, Ticket } from "@phosphor-icons/react";

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

type PostPayKind = "topup" | "key" | "hwid";

type PostPay = {
  amount?: number;
  kind: PostPayKind;
};

export default function PricingPage() {
  const { t, lang } = useI18n();
  const tr = (ru: string, en: string) => (lang === "en" ? en : ru);
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
  const [topupAmounts, setTopupAmounts] = useState<number[]>([10, 20, 50, 150, 200, 300, 400]);
  const [postPay, setPostPay] = useState<PostPay | null>(null);

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") === "1") {
      const amount = Number(params.get("amount"));
      const kindParam = params.get("kind");
      const kind: PostPayKind =
        kindParam === "key" || kindParam === "hwid" ? kindParam : "topup";
      setPostPay({
        amount: Number.isFinite(amount) && amount > 0 ? amount : undefined,
        kind,
      });
    }
  }, []);

  const supportHref = (() => {
    const isHwid = postPay?.kind === "hwid";
    const subject = isHwid
      ? tr(
          "Не пришёл ключ сброса HWID после оплаты",
          "HWID reset key not received after payment"
        )
      : tr(
          "Не пришёл промокод после оплаты",
          "Promo code not received after payment"
        );
    const body = isHwid
      ? tr(
          `Оплатил ключ сброса HWID на FunPay${postPay?.amount ? ` ${postPay.amount} ₽` : ""}, но ключ не пришёл.\n\nСсылка на лот / номер заказа: \nВремя оплаты: \nСпособ оплаты: \n\nПрошу проверить оплату.`,
          `I paid for an HWID reset key on FunPay${postPay?.amount ? ` ${postPay.amount} ₽` : ""} but did not receive the key.\n\nLot link / order number: \nPayment time: \nPayment method: \n\nPlease check the payment.`
        )
      : tr(
          `Оплатил на FunPay${postPay?.amount ? ` ${postPay.amount} ₽` : ""}, но промокод не пришёл.\n\nСсылка на лот / номер заказа: \nВремя оплаты: \nСпособ оплаты: \n\nПрошу проверить оплату.`,
          `I paid on FunPay${postPay?.amount ? ` ${postPay.amount} ₽` : ""} but did not receive a promo code.\n\nLot link / order number: \nPayment time: \nPayment method: \n\nPlease check the payment.`
        );
    return `/support?category=payment&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  })();

  const postPaySteps = (() => {
    if (!postPay) return [];
    const paidStep = {
      title: tr("Оплатили на FunPay", "Paid on FunPay"),
      text: tr(
        "Выберите лот и оплатите удобным способом. Ссылка на оплату открывается в новой вкладке.",
        "Pick a lot and pay with any method. The payment link opens in a new tab."
      ),
    };

    if (postPay.kind === "hwid") {
      return [
        paidStep,
        {
          title: tr("Получили ключ сброса HWID", "Received the HWID reset key"),
          text: tr(
            "Продавец отправит ключ в чат FunPay — обычно в течение 1–5 минут. Не закрывайте заказ до получения ключа.",
            "The seller sends the key in the FunPay chat, usually within 1–5 minutes. Keep the order open until it arrives."
          ),
        },
        {
          title: tr("Сбросили HWID", "Reset the HWID"),
          text: tr(
            "Кабинет → «Действия» → «Дополнения» → блок «Сброс HWID». Вставьте ключ и нажмите «Сбросить HWID», затем запустите лаунчер заново.",
            "Dashboard → “Actions” → “Add-ons” → “HWID reset”. Paste the key, press “Reset HWID”, then relaunch the client."
          ),
        },
      ];
    }

    const codeStep = {
      title: tr("Получили промокод", "Received the promo code"),
      text: tr(
        "Продавец отправит код в чат FunPay — обычно в течение 1–5 минут. Не закрывайте заказ до получения кода.",
        "The seller sends the code in the FunPay chat, usually within 1–5 minutes. Keep the order open until it arrives."
      ),
    };

    if (postPay.kind === "key") {
      return [
        paidStep,
        codeStep,
        {
          title: tr("Активировали ключ", "Activated the key"),
          text: tr(
            "Кабинет → «Действия» → «Дополнения» → «Активировать ключ». Вставьте код, и подписка начнёт действовать сразу.",
            "Dashboard → “Actions” → “Add-ons” → “Activate a key”. Paste the code and the subscription starts right away."
          ),
        },
      ];
    }

    return [
      paidStep,
      codeStep,
      {
        title: tr("Пополнили баланс", "Topped up the balance"),
        text: tr(
          "Вставьте код в разделе «Баланс» в кабинете. Деньги зачислятся сразу — после этого подписку можно оплатить с баланса.",
          "Paste the code in the “Balance” section of your dashboard. The money is credited instantly, then you can pay for a subscription from your balance."
        ),
      },
    ];
  })();

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
        <section className="relative z-10 flex flex-col items-center px-4 pb-16 pt-28 sm:px-6 sm:pb-24 sm:pt-32">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-10 text-center text-3xl font-semibold sm:mb-14 sm:text-4xl lg:text-5xl"
          >
            {t("pricing.title")}
          </motion.h1>

          <div className="flex w-full flex-wrap justify-center gap-4 sm:gap-5">
            {products.map((p) => (
              <PricingCard
                key={p.title}
                title={p.title}
                price={p.price}
                onClick={() => openModal(p)}
              />
            ))}
          </div>
        </section>

        <section id="topup" className="relative z-10 px-5 pb-24 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.4 }}
            className="mx-auto max-w-5xl rounded-2xl border border-white/[0.08] bg-[#111114]/70 p-6 sm:p-8"
          >
            <h2 className="mb-1 text-2xl font-semibold sm:text-3xl">{t("pricing.topupTitle")}</h2>
            <p className="max-w-2xl text-sm text-white/45">{t("pricing.topupSubtitle")}</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-7">
              {topupAmounts.map((amount) => {
                const url = topupLinks[`topup_${amount}_url`];
                return url ? (
                  <a
                    key={amount}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setPostPay({ amount, kind: "topup" })}
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

            <button
              onClick={() => setPostPay({ kind: "topup" })}
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-purple-300 hover:text-purple-200 transition"
            >
              <CheckCircle size={18} />
              {tr("Оплатил — что делать дальше?", "Paid already? See what's next")}
              <ArrowRight size={15} />
            </button>
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
              className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#131316] p-6 shadow-2xl shadow-black/60 sm:p-7"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-1 text-xl font-semibold">{selected.title}</h3>
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
                  onClick={() => {
                    const amount = selected.rub;
                    const kind: PostPayKind = selected.hwid ? "hwid" : "key";
                    setSelected(null);
                    setPostPay({ amount, kind });
                  }}
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

      <AnimatePresence>
        {postPay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 py-6 overflow-y-auto"
            onClick={() => setPostPay(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.25 }}
              className="my-auto w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#131316] p-6 shadow-2xl shadow-black/60 sm:p-7"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-1">
                <span className="w-10 h-10 rounded-2xl bg-green-500/15 border border-green-400/30 flex items-center justify-center text-green-300">
                  <CheckCircle size={22} />
                </span>
                <h3 className="text-xl font-semibold">
                  {tr("Оплата прошла — что дальше?", "Payment sent — what's next?")}
                </h3>
              </div>
              <p className="text-white/45 text-sm mb-6">
                {postPay.kind === "hwid"
                  ? postPay.amount
                    ? tr(
                        `Ключ сброса HWID на ${postPay.amount} ₽ активируется в три шага.`,
                        `A ${postPay.amount} ₽ HWID reset key is activated in three steps.`
                      )
                    : tr(
                        "Ключ сброса HWID активируется в три шага.",
                        "An HWID reset key is activated in three steps."
                      )
                  : postPay.kind === "key"
                    ? postPay.amount
                      ? tr(
                          `Ключ на ${postPay.amount} ₽ активируется в три шага.`,
                          `A ${postPay.amount} ₽ key is activated in three steps.`
                        )
                      : tr(
                          "Ключ активируется в три шага.",
                          "A key is activated in three steps."
                        )
                    : postPay.amount
                      ? tr(
                          `Пополнение на ${postPay.amount} ₽ проходит в три шага.`,
                          `A ${postPay.amount} ₽ top-up takes three steps.`
                        )
                      : tr(
                          "Пополнение и покупка проходят в три шага.",
                          "Top-ups and purchases take three steps."
                        )}
              </p>

              <ol className="space-y-4 mb-7">
                {postPaySteps.map((step, index) => (
                  <li key={step.title} className="flex gap-4">
                    <span className="shrink-0 w-8 h-8 rounded-full bg-purple-600/20 border border-purple-400/30 text-purple-200 flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-semibold">{step.title}</p>
                      <p className="text-white/40 text-sm leading-relaxed mt-0.5">{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="flex flex-col gap-3">
                <Link
                  href={
                    postPay.kind === "topup"
                      ? "/dashboard?tab=balance"
                      : "/dashboard/addons"
                  }
                  className="w-full py-3 rounded-xl font-semibold bg-purple-600 hover:bg-purple-500 transition text-center inline-flex items-center justify-center gap-2"
                >
                  <Ticket size={18} />
                  {postPay.kind === "topup"
                    ? tr("Перейти в «Баланс»", "Go to “Balance”")
                    : postPay.kind === "hwid"
                      ? tr("Перейти к сбросу HWID", "Go to HWID reset")
                      : tr("Перейти к активации ключа", "Go to key activation")}
                </Link>
                <Link
                  href={supportHref}
                  className="w-full py-3 rounded-xl font-semibold bg-white/5 hover:bg-white/10 border border-white/10 transition text-center"
                >
                  {tr("Код не пришёл — написать в поддержку", "Code didn't arrive — contact support")}
                </Link>
                <button
                  onClick={() => setPostPay(null)}
                  className="w-full text-sm text-white/40 hover:text-white/70 transition py-1"
                >
                  {t("pricing.close")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </>
  );
}
