"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  Headset,
  PaperPlaneTilt,
  LockSimple,
  CheckCircle,
  ArrowLeft,
} from "@phosphor-icons/react";

type Message = {
  id: number;
  user_id: number | null;
  is_admin: number;
  body: string;
  created_at: string;
};

type Ticket = {
  id: number;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
  messages: Message[];
};

type Me = { id: number; username: string; role: string; is_admin: number } | null;

function fmt(ts: string) {
  return new Date(ts.replace(" ", "T")).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SupportPage() {
  const [me, setMe] = useState<Me>(null);
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");

  const [replyFor, setReplyFor] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/support");
    const d = await res.json();
    if (d.ok) setTickets(d.tickets || []);
  }

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        setMe(d.user || null);
        setLoading(false);
        if (d.user) load();
      });
  }, []);

  async function createTicket() {
    if (!subject.trim() || !body.trim()) {
      setMsg("Заполните тему и сообщение");
      return;
    }
    setCreating(true);
    setMsg("");
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", subject, body }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg(d.error || "Ошибка");
        return;
      }
      setSubject("");
      setBody("");
      await load();
    } catch {
      setMsg("Ошибка сервера");
    } finally {
      setCreating(false);
    }
  }

  async function sendReply(id: number) {
    if (!replyText.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reply", ticket_id: id, body: replyText }),
      });
      if (res.ok) {
        setReplyText("");
        setReplyFor(null);
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function closeTicket(id: number) {
    setBusy(true);
    try {
      await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close", ticket_id: id }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Header />
      <main className="relative min-h-screen text-white overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-40 pointer-events-none">
          <Image src="/fluid2.png" alt="" fill className="object-cover" priority />
        </div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/60 via-black/70 to-black pointer-events-none" />

        <div className="max-w-3xl mx-auto px-6 pt-36 pb-24">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-white/50 hover:text-white transition text-sm mb-8"
          >
            <ArrowLeft size={16} weight="bold" />На главную
          </Link>

          <div className="flex items-center gap-3 mb-2">
            <Headset size={30} weight="fill" className="text-purple-400" />
            <p className="text-white/40 text-xs tracking-widest uppercase">Помощь</p>
          </div>
          <h1 className="text-5xl font-extrabold mb-4">
            <span className="bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
              Поддержка
            </span>
          </h1>
          <p className="text-white/50 mb-10">
            Опишите свою проблему — администратор ответит и закроет тикет.
          </p>

          {loading ? null : !me ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-8 text-center">
              <p className="text-white/60 mb-5">Чтобы написать в поддержку, войдите в аккаунт.</p>
              <Link
                href="/login"
                className="inline-block px-6 py-3 rounded-xl font-semibold bg-purple-600 hover:bg-purple-700 transition"
              >
                Войти
              </Link>
            </div>
          ) : (
            <>
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7 mb-8">
                <h2 className="text-xl font-bold mb-4">Новый тикет</h2>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Тема (кратко)"
                  className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none mb-3"
                />
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Опишите проблему подробно..."
                  rows={4}
                  className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none resize-none mb-3"
                />
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  {msg ? <p className="text-red-400 text-sm">{msg}</p> : <span />}
                  <button
                    onClick={createTicket}
                    disabled={creating}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition"
                  >
                    <PaperPlaneTilt size={18} weight="fill" />
                    {creating ? "Отправка..." : "Отправить"}
                  </button>
                </div>
              </div>

              <h2 className="text-2xl font-bold mb-4">Мои тикеты ({tickets.length})</h2>
              {tickets.length === 0 ? (
                <p className="text-white/30 text-center py-8">Тикетов пока нет</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {tickets.map((t) => (
                    <div key={t.id} className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6">
                      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                        <div className="flex items-center gap-3">
                          <h3 className="font-bold">{t.subject}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            t.status === "closed"
                              ? "bg-white/10 text-white/50"
                              : "bg-green-500/20 text-green-300"
                          }`}>
                            {t.status === "closed" ? "Закрыт" : "Открыт"}
                          </span>
                        </div>
                        <span className="text-white/30 text-xs">#{t.id} · {fmt(t.created_at)}</span>
                      </div>

                      <div className="flex flex-col gap-3 mb-4">
                        {t.messages.map((m) => (
                          <div
                            key={m.id}
                            className={`rounded-2xl p-4 border ${
                              m.is_admin
                                ? "bg-purple-600/10 border-purple-500/20 ml-0 sm:ml-8"
                                : "bg-black/30 border-white/5 mr-0 sm:mr-8"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-semibold ${m.is_admin ? "text-purple-300" : "text-white/70"}`}>
                                {m.is_admin ? "Поддержка" : "Вы"}
                              </span>
                              <span className="text-white/25 text-xs">{fmt(m.created_at)}</span>
                            </div>
                            <p className="text-white/80 text-sm whitespace-pre-wrap break-words">{m.body}</p>
                          </div>
                        ))}
                      </div>

                      {t.status !== "closed" && (
                        replyFor === t.id ? (
                          <div className="flex flex-col gap-2">
                            <textarea
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="Ваш ответ..."
                              rows={3}
                              className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none resize-none"
                            />
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => { setReplyFor(null); setReplyText(""); }}
                                className="px-4 py-2 rounded-xl text-sm bg-white/5 hover:bg-white/10 border border-white/10 transition"
                              >
                                Отмена
                              </button>
                              <button
                                onClick={() => sendReply(t.id)}
                                disabled={busy}
                                className="px-5 py-2 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition"
                              >
                                Отправить
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => { setReplyFor(t.id); setReplyText(""); }}
                              className="px-4 py-2 rounded-xl text-sm bg-white/5 hover:bg-white/10 border border-white/10 transition"
                            >
                              Ответить
                            </button>
                            <button
                              onClick={() => closeTicket(t.id)}
                              disabled={busy}
                              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-white/5 hover:bg-white/10 border border-white/10 transition disabled:opacity-50"
                            >
                              <LockSimple size={16} />
                              Закрыть
                            </button>
                          </div>
                        )
                      )}
                      {t.status === "closed" && (
                        <p className="flex items-center gap-2 text-white/30 text-xs justify-end">
                          <CheckCircle size={14} /> Тикет закрыт
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
