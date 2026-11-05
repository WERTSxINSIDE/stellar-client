"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useI18n } from "@/lib/i18n";
import {
  ChatCircleDots,
  PaperPlaneTilt,
  Scales,
  UsersThree,
} from "@phosphor-icons/react";

type ChatMessage = {
  id: number;
  channel: "general" | "trade";
  body: string;
  created_at: string;
  user_id: number | null;
  username: string | null;
  avatar_url: string | null;
  nickname_color: string | null;
};

type Me = { id: number; username: string } | null;

const CHANNELS = [
  { id: "general", labelRu: "Общий", labelEn: "General", icon: UsersThree },
  { id: "trade", labelRu: "Торговля", labelEn: "Trade", icon: Scales },
] as const;

export default function ChatPage() {
  const { lang } = useI18n();
  const tr = (ru: string, en: string) => (lang === "en" ? en : ru);
  const [channel, setChannel] = useState<"general" | "trade">("general");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [me, setMe] = useState<Me>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef(0);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setMe({ id: data.user.id, username: data.user.username });
        }
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async (after = 0) => {
    try {
      const res = await fetch(`/api/chat${after > 0 ? `?after=${after}` : ""}`);
      const data = await res.json();
      if (!res.ok || !data.ok) return;

      const incoming = (data.messages || []) as ChatMessage[];
      if (after > 0) {
        setMessages((prev) => {
          const seen = new Set(prev.map((item) => item.id));
          const fresh = incoming.filter((item) => !seen.has(item.id));
          return fresh.length ? [...prev, ...fresh].slice(-300) : prev;
        });
      } else {
        setMessages(incoming);
      }

      const maxId = incoming.reduce((max, item) => Math.max(max, item.id), 0);
      if (maxId > lastIdRef.current) lastIdRef.current = maxId;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => load(lastIdRef.current), 5000);
    return () => clearInterval(timer);
  }, [load]);

  const visible = messages.filter((item) => item.channel === channel);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [visible.length, channel]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!body || sending) return;

    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, channel }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || tr("Не удалось отправить сообщение", "Failed to send message"));
        return;
      }
      setText("");
      if (data.message) {
        setMessages((prev) => [...prev, data.message as ChatMessage].slice(-300));
        lastIdRef.current = Math.max(lastIdRef.current, data.message.id);
      } else {
        await load(lastIdRef.current);
      }
    } catch {
      setError(tr("Ошибка сервера", "Server error"));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Header />
      <main className="relative min-h-screen text-white">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.16),transparent_55%)]" />
        <div className="max-w-4xl mx-auto px-6 pt-36 pb-20">
          <div className="flex items-center gap-3 mb-2">
            <ChatCircleDots size={28} weight="fill" className="text-purple-300" />
            <p className="text-white/40 text-xs tracking-widest uppercase">
              {tr("Сообщество", "Community")}
            </p>
          </div>
          <h1 className="cosmic-rgb-text text-4xl md:text-5xl font-extrabold">
            {tr("Общий чат", "Global chat")}
          </h1>
          <p className="text-white/45 mt-2 mb-6 max-w-2xl">
            {tr(
              "Два канала: общий и торговля. Читать может любой, писать — только авторизованные. За нарушения действует система трёх страйков.",
              "Two channels: general and trade. Anyone can read, only signed-in users can post. Three-strike moderation applies."
            )}
          </p>

          <div className="flex gap-2 mb-4">
            {CHANNELS.map((item) => {
              const Icon = item.icon;
              const active = channel === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setChannel(item.id)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? "border-purple-400/50 bg-purple-500/15 text-purple-100"
                      : "border-white/10 bg-white/[0.02] text-white/50 hover:bg-white/[0.05]"
                  }`}
                >
                  <Icon size={16} /> {tr(item.labelRu, item.labelEn)}
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
            <div className="h-[55vh] min-h-[320px] overflow-y-auto px-4 py-4 space-y-3">
              {loading ? (
                <div className="h-full flex items-center justify-center text-white/35 text-sm">
                  {tr("Загрузка сообщений...", "Loading messages...")}
                </div>
              ) : visible.length === 0 ? (
                <div className="h-full flex items-center justify-center text-white/35 text-sm text-center px-6">
                  {tr(
                    "Здесь пока тихо. Начните разговор первым.",
                    "It’s quiet here. Start the conversation."
                  )}
                </div>
              ) : (
                visible.map((item, index) => {
                  const previous = visible[index - 1];
                  const grouped =
                    previous &&
                    previous.user_id === item.user_id &&
                    new Date(item.created_at).getTime() -
                      new Date(previous.created_at).getTime() <
                      5 * 60_000;
                  return (
                    <div key={item.id} className={`flex gap-2.5 ${grouped ? "mt-1" : "mt-3"}`}>
                      <div className="w-8 shrink-0">
                        {!grouped && (
                          <div className="h-8 w-8 rounded-full overflow-hidden bg-white/10 border border-white/10 flex items-center justify-center">
                            {item.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-[10px] font-bold text-white/60">
                                {(item.username || "?").slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        {!grouped && (
                          <div className="flex items-baseline gap-2 mb-0.5">
                            {item.username ? (
                              <Link
                                href={`/u/${encodeURIComponent(item.username)}`}
                                className="text-xs font-semibold hover:underline"
                                style={item.nickname_color ? { color: item.nickname_color } : undefined}
                              >
                                {item.username}
                              </Link>
                            ) : (
                              <span className="text-xs font-semibold text-white/40">
                                {tr("Удалённый", "Deleted")}
                              </span>
                            )}
                            <span className="text-[10px] text-white/25">
                              {new Date(item.created_at).toLocaleTimeString(
                                lang === "en" ? "en-GB" : "ru-RU",
                                { hour: "2-digit", minute: "2-digit" }
                              )}
                            </span>
                          </div>
                        )}
                        <p className="text-sm text-white/80 whitespace-pre-wrap break-words">
                          {item.body}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-white/10 p-3 bg-white/[0.02]">
              {error && (
                <p className="text-xs text-red-300 mb-2 px-1">{error}</p>
              )}
              {me ? (
                <form onSubmit={send} className="flex gap-2">
                  <input
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    maxLength={500}
                    placeholder={
                      channel === "trade"
                        ? tr("Куплю / продам...", "Buy / sell...")
                        : tr("Написать сообщение...", "Write a message...")
                    }
                    className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-purple-400/50"
                  />
                  <button
                    type="submit"
                    disabled={!text.trim() || sending}
                    className="inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 px-4 py-2.5 text-sm font-semibold transition disabled:opacity-40"
                  >
                    <PaperPlaneTilt size={16} />
                    <span className="hidden sm:inline">
                      {sending ? tr("...", "...") : tr("Отправить", "Send")}
                    </span>
                  </button>
                </form>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-1">
                  <p className="text-xs text-white/45">
                    {tr(
                      "Войдите, чтобы писать в чат.",
                      "Sign in to post in the chat."
                    )}
                  </p>
                  <Link
                    href="/login"
                    className="rounded-xl bg-purple-600 hover:bg-purple-500 px-4 py-2 text-sm font-semibold transition"
                  >
                    {tr("Войти", "Sign in")}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
