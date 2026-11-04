"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  ArrowLeft,
  ArrowSquareOut,
  CheckCircle,
  Coin,
  FloppyDisk,
  WarningCircle,
} from "@phosphor-icons/react";

const AMOUNTS = [5, 10, 20, 50, 150, 200, 300, 400];

function keyFor(amount: number) {
  return `topup_${amount}_url`;
}

export default function AdminPaymentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) {
          router.replace("/login");
          return;
        }
        if (!(d.user.is_admin || d.user.role === "admin")) {
          router.replace("/dashboard");
          return;
        }
        setAllowed(true);
        return fetch("/api/admin-payments", { cache: "no-store" })
          .then((r) => r.json())
          .then((data) => {
            if (data.ok) {
              const next: Record<string, string> = {};
              for (const amount of AMOUNTS) {
                next[keyFor(amount)] = data.links?.[keyFor(amount)] || "";
              }
              setLinks(next);
            } else {
              setMsg(data.error || "Не удалось загрузить настройки");
            }
          });
      })
      .catch(() => setMsg("Ошибка сервера"))
      .finally(() => setLoading(false));
  }, [router]);

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Не удалось сохранить");
        return;
      }
      setMsg("Ссылки сохранены ✓");
    } catch {
      setMsg("Ошибка сервера");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header />
      <main className="relative min-h-screen bg-[#0a0710] text-white">
        <div className="max-w-3xl mx-auto px-6 pt-36 pb-24">
          <Link
            href="/dashboard/admin"
            className="inline-flex items-center gap-2 text-white/50 hover:text-white transition text-sm mb-8"
          >
            <ArrowLeft size={16} weight="bold" /> В админ панель
          </Link>

          <div className="flex items-center gap-3 mb-2">
            <Coin size={28} weight="fill" className="text-emerald-400" />
            <p className="text-white/40 text-xs tracking-widest uppercase">Оплата</p>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-3">Пополнения баланса</h1>
          <p className="text-white/45 mb-8">
            Укажите ссылки FunPay для каждой суммы. Игрок оплачивает товар, получает промокод и
            активирует его в кабинете. Ссылки можно оставить пустыми — тогда кнопка будет неактивна.
          </p>

          {loading ? (
            <p className="text-white/35 text-center py-16">Загрузка...</p>
          ) : !allowed ? null : (
            <>
              <div className="flex flex-col gap-3 mb-6">
                {AMOUNTS.map((amount) => {
                  const key = keyFor(amount);
                  const value = links[key] || "";
                  return (
                    <div
                      key={amount}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <p className="font-semibold">{amount} ₽</p>
                        {value && (
                          <a
                            href={value}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-emerald-300 hover:text-emerald-200 transition"
                          >
                            Проверить ссылку <ArrowSquareOut size={12} />
                          </a>
                        )}
                      </div>
                      <input
                        value={value}
                        onChange={(e) => setLinks((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder={`https://funpay.com/... (${amount} ₽)`}
                        maxLength={500}
                        className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-emerald-500 outline-none text-sm"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-3 flex-wrap">
                {msg ? (
                  <p
                    className={`text-sm flex items-center gap-2 ${
                      msg.includes("✓") ? "text-emerald-300" : "text-red-300"
                    }`}
                  >
                    {msg.includes("✓") ? (
                      <CheckCircle size={16} />
                    ) : (
                      <WarningCircle size={16} />
                    )}
                    {msg}
                  </p>
                ) : (
                  <span className="text-xs text-white/30">
                    Суммы: {AMOUNTS.map((a) => `${a} ₽`).join(", ")}
                  </span>
                )}
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-5 py-3 text-sm font-semibold transition"
                >
                  <FloppyDisk size={17} />
                  {saving ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
