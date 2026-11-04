"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowsLeftRight, CircleNotch, Coins, Wallet } from "@phosphor-icons/react";
import { useI18n } from "@/lib/i18n";

type ExchangeData = {
  balance: number;
  sc_coins: number;
  sc_per_ruble: number;
};

type Direction = "rub_to_sc" | "sc_to_rub";

export default function Exchange({
  onBalances,
}: {
  onBalances?: (balances: { balance: number; sc_coins: number }) => void;
}) {
  const { lang } = useI18n();
  const tr = (ru: string, en: string) => (lang === "en" ? en : ru);

  const [data, setData] = useState<ExchangeData | null>(null);
  const [direction, setDirection] = useState<Direction>("rub_to_sc");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/exchange", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || tr("Не удалось загрузить обменник", "Failed to load the exchange"));
        return;
      }
      setData(json);
      setError("");
    } catch {
      setError(tr("Ошибка сервера", "Server error"));
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    load();
  }, [load]);

  const value = Math.floor(Number(amount) || 0);
  const rate = data?.sc_per_ruble ?? 50;
  const received = direction === "rub_to_sc" ? value * rate : Math.floor(value / rate);
  const remainder = direction === "sc_to_rub" ? value - received * rate : 0;
  const valid =
    value > 0 &&
    (direction === "rub_to_sc" || value >= rate) &&
    (direction === "rub_to_sc" ? value <= (data?.balance ?? 0) : value <= (data?.sc_coins ?? 0));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction, amount: value }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || tr("Не удалось обменять", "Exchange failed"));
        return;
      }
      setData((prev) =>
        prev ? { ...prev, balance: json.balance, sc_coins: json.sc_coins } : prev
      );
      onBalances?.({ balance: json.balance, sc_coins: json.sc_coins });
      setAmount("");
      setNotice(
        json.remainder
          ? tr(
              `Обменяно ${json.spent} ${json.spent_label} → ${json.received} ${json.received_label}. Остаток ${json.remainder} SC остался на счету.`,
              `Exchanged ${json.spent} ${json.spent_label} → ${json.received} ${json.received_label}. ${json.remainder} SC stayed on your balance.`
            )
          : tr(
              `Обменяно ${json.spent} ${json.spent_label} → ${json.received} ${json.received_label}`,
              `Exchanged ${json.spent} ${json.spent_label} → ${json.received} ${json.received_label}`
            )
      );
    } catch {
      setError(tr("Ошибка сервера", "Server error"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-7 text-sm text-white/40">
        {tr("Загрузка обменника...", "Loading exchange...")}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h4 className="text-xl font-bold mb-1">{tr("Обмен валюты", "Currency exchange")}</h4>
          <p className="text-white/40 text-sm">
            {tr(`Курс: 1 ₽ = ${rate} SC, ${rate} SC = 1 ₽.`, `Rate: 1 ₽ = ${rate} SC, ${rate} SC = 1 ₽.`)}
          </p>
        </div>
        <ArrowsLeftRight size={22} className="text-purple-300 shrink-0" />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          type="button"
          onClick={() => {
            setDirection("rub_to_sc");
            setAmount("");
            setError("");
            setNotice("");
          }}
          className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
            direction === "rub_to_sc"
              ? "bg-purple-600 text-white"
              : "border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08]"
          }`}
        >
          <Wallet size={15} className="inline mr-1.5 -mt-0.5" />
          {tr("₽ → SC", "₽ → SC")}
        </button>
        <button
          type="button"
          onClick={() => {
            setDirection("sc_to_rub");
            setAmount("");
            setError("");
            setNotice("");
          }}
          className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
            direction === "sc_to_rub"
              ? "bg-purple-600 text-white"
              : "border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08]"
          }`}
        >
          <Coins size={15} className="inline mr-1.5 -mt-0.5" />
          {tr("SC → ₽", "SC → ₽")}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
          <p className="text-white/35">{tr("Баланс", "Balance")}</p>
          <p className="font-semibold text-white/80">{data?.balance ?? 0} ₽</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
          <p className="text-white/35">SC</p>
          <p className="font-semibold text-amber-200">{data?.sc_coins ?? 0} SC</p>
        </div>
      </div>

      <form onSubmit={submit} noValidate>
        <label className="text-white/40 text-xs mb-1 block">
          {direction === "rub_to_sc" ? tr("Сумма в рублях", "Amount in rubles") : tr("Сумма в SC", "Amount in SC")}
        </label>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={amount}
          onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, "").slice(0, 9))}
          placeholder="0"
          className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
        />

        <div className="flex flex-wrap gap-2 mt-2">
          {(direction === "rub_to_sc" ? [10, 50, 100, 500] : [50, 100, 500, 1000]).map((quick) => (
            <button
              key={quick}
              type="button"
              onClick={() => setAmount(String(quick))}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/60 hover:bg-white/[0.08] transition"
            >
              {quick}
            </button>
          ))}
        </div>

        <p className="text-xs text-white/40 mt-3">
          {tr("Получите", "You get")}:{" "}
          <span className="text-white/75 font-medium">
            {direction === "rub_to_sc" ? `${received} SC` : `${received} ₽`}
          </span>
          {direction === "sc_to_rub" && value > 0 && value < rate && (
            <span className="text-red-300 ml-2">
              {tr(`минимум ${rate} SC`, `minimum ${rate} SC`)}
            </span>
          )}
          {direction === "sc_to_rub" && remainder > 0 && value >= rate && (
            <span className="text-white/40 ml-2">
              {tr(
                `остаток ${remainder} SC останется на счету`,
                `${remainder} SC will stay on your balance`
              )}
            </span>
          )}
          {direction === "rub_to_sc" && value > (data?.balance ?? 0) && (
            <span className="text-red-300 ml-2">
              {tr("недостаточно рублей на балансе", "not enough rubles on balance")}
            </span>
          )}
          {direction === "sc_to_rub" && value > (data?.sc_coins ?? 0) && (
            <span className="text-red-300 ml-2">
              {tr("недостаточно SC", "not enough SC")}
            </span>
          )}
        </p>

        {error && <p className="text-sm text-red-300 mt-3">{error}</p>}
        {notice && <p className="text-sm text-emerald-300 mt-3">{notice}</p>}

        <button
          type="submit"
          disabled={!valid || busy}
          className="mt-4 w-full py-3 rounded-xl font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition inline-flex items-center justify-center gap-2"
        >
          {busy ? <CircleNotch size={17} className="animate-spin" /> : <ArrowsLeftRight size={17} />}
          {busy ? tr("Обмен...", "Exchanging...") : tr("Обменять", "Exchange")}
        </button>
      </form>
    </div>
  );
}
