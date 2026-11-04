"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import {
  ArrowLeft,
  Bank,
  CheckCircle,
  Clock,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";

type PayoutRequest = {
  id: number;
  user_id: number;
  amount: number;
  method: string;
  details: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
  username: string;
  email: string;
  avatar_url: string | null;
};

type Counts = {
  pending?: number;
  approved?: number;
  rejected?: number;
  total?: number;
};

const TABS = [
  { value: "pending", label: "Ожидают" },
  { value: "approved", label: "Выплачены" },
  { value: "rejected", label: "Отклонены" },
  { value: "all", label: "Все" },
];

const METHODS: Record<string, string> = {
  card: "Карта",
  sbp: "СБП",
  crypto: "Криптовалюта",
  funpay: "FunPay",
};

const STATUS_STYLE: Record<string, string> = {
  pending: "border-amber-400/25 bg-amber-500/10 text-amber-300",
  approved: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
  rejected: "border-red-400/25 bg-red-500/10 text-red-300",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Ожидает",
  approved: "Выплачено",
  rejected: "Отклонено",
};

function fmt(value: string | null) {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminPayoutsPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [counts, setCounts] = useState<Counts>({});
  const [status, setStatus] = useState("pending");
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async (nextStatus: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/payouts?status=${nextStatus}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Не удалось загрузить заявки");
        return;
      }
      setRequests(Array.isArray(data.requests) ? data.requests : []);
      setCounts(data.counts || {});
    } catch {
      setMsg("Ошибка сервера");
    } finally {
      setLoading(false);
    }
  }, []);

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
        load(status);
      })
      .catch(() => setMsg("Ошибка сервера"));
  }, [router, load, status]);

  async function process(request: PayoutRequest, action: "approve" | "reject") {
    if (action === "reject" && !confirm(`Отклонить заявку #${request.id}? Деньги вернутся на баланс.`)) {
      return;
    }
    setBusy(request.id);
    setMsg("");
    try {
      const res = await fetch("/api/admin/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: request.id,
          action,
          admin_note: notes[request.id] || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error || "Не удалось обработать заявку");
        return;
      }
      setMsg(action === "approve" ? "Заявка одобрена ✓" : "Заявка отклонена ✓");
      await load(status);
    } catch {
      setMsg("Ошибка сервера");
    } finally {
      setBusy(null);
    }
  }

  if (!allowed) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-[#0a0710] text-white pt-36 px-6">
          <p className="text-white/35 text-center">
            {loading ? "Загрузка..." : msg || "Доступ запрещён"}
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="relative min-h-screen bg-[#0a0710] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-28 sm:pt-36 pb-24">
          <Link
            href="/dashboard/admin"
            className="inline-flex items-center gap-2 text-white/50 hover:text-white transition text-sm mb-8"
          >
            <ArrowLeft size={16} weight="bold" /> В админ панель
          </Link>

          <div className="flex items-center gap-3 mb-2">
            <Bank size={26} weight="fill" className="text-emerald-400" />
            <p className="text-white/40 text-xs tracking-widest uppercase">Выплаты</p>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3">Заявки авторов</h1>
          <p className="text-white/45 text-sm mb-8">
            При создании заявки сумма блокируется на балансе автора. При отклонении
            она автоматически возвращается.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.06] p-4">
              <p className="text-[11px] text-amber-200/70 uppercase">Ожидают</p>
              <p className="text-2xl font-bold text-amber-200">{counts.pending ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-4">
              <p className="text-[11px] text-emerald-200/70 uppercase">Выплачены</p>
              <p className="text-2xl font-bold text-emerald-200">{counts.approved ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-red-400/20 bg-red-500/[0.06] p-4">
              <p className="text-[11px] text-red-200/70 uppercase">Отклонены</p>
              <p className="text-2xl font-bold text-red-200">{counts.rejected ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[11px] text-white/40 uppercase">Всего</p>
              <p className="text-2xl font-bold">{counts.total ?? 0}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatus(tab.value)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold border transition ${
                  status === tab.value
                    ? "bg-purple-600 border-purple-500 text-white"
                    : "bg-white/5 border-white/10 text-white/60 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {msg && (
            <p
              className={`text-sm mb-4 ${
                msg.includes("✓") ? "text-emerald-300" : "text-red-300"
              }`}
            >
              {msg}
            </p>
          )}

          {loading ? (
            <p className="text-white/35 text-center py-12">Загрузка...</p>
          ) : requests.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center text-white/40 text-sm">
              Заявок нет.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] ${
                        STATUS_STYLE[request.status] || STATUS_STYLE.pending
                      }`}
                    >
                      {request.status === "pending" ? (
                        <Clock size={11} />
                      ) : request.status === "approved" ? (
                        <CheckCircle size={11} />
                      ) : (
                        <XCircle size={11} />
                      )}
                      {STATUS_LABEL[request.status] || request.status}
                    </span>
                    <span className="text-[11px] text-white/30">
                      #{request.id} · {fmt(request.created_at)}
                    </span>
                    <span className="ml-auto text-lg font-bold text-white">
                      {request.amount} ₽
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/50 mb-2">
                    <Link
                      href={`/u/${encodeURIComponent(request.username)}`}
                      className="font-semibold text-white/80 hover:text-purple-300 transition"
                    >
                      {request.username}
                    </Link>
                    <span className="text-white/35">{request.email}</span>
                    <span>{METHODS[request.method] || request.method}</span>
                  </div>

                  <p className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/65 break-words">
                    {request.details}
                  </p>

                  {request.processed_at && (
                    <p className="text-[11px] text-white/35 mt-2">
                      Обработана: {fmt(request.processed_at)}
                    </p>
                  )}
                  {request.admin_note && (
                    <p className="text-[11px] text-white/45 mt-1">
                      Комментарий: {request.admin_note}
                    </p>
                  )}

                  {request.status === "pending" && (
                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                      <input
                        value={notes[request.id] || ""}
                        onChange={(e) =>
                          setNotes((prev) => ({ ...prev, [request.id]: e.target.value }))
                        }
                        maxLength={500}
                        placeholder="Комментарий (необязательно, виден автору)"
                        className="flex-1 bg-black/40 px-3 py-2 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-xs"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => process(request, "approve")}
                          disabled={busy === request.id}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 px-4 py-2 text-xs font-semibold transition"
                        >
                          <CheckCircle size={14} /> Одобрить
                        </button>
                        <button
                          type="button"
                          onClick={() => process(request, "reject")}
                          disabled={busy === request.id}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-red-400/25 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-60 px-4 py-2 text-xs font-semibold text-red-300 transition"
                        >
                          <WarningCircle size={14} /> Отклонить
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
