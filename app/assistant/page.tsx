"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpenText,
  Headset,
  PaperPlaneTilt,
  Robot,
  Sparkle,
} from "@phosphor-icons/react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useI18n } from "@/lib/i18n";

type Source = {
  id: string;
  kind: "guide" | "faq";
  title: string;
  url: string;
  snippet: string;
};

type Reply = {
  answer: string;
  sources: Source[];
  escalate: boolean;
  suggestions: string[];
};

type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
  reply?: Reply;
};

const QUICK_RU = [
  "Как установить лаунчер?",
  "Как сбросить HWID?",
  "Как оплатить подписку?",
  "Что дают кланы?",
];

const QUICK_EN = [
  "How do I install the launcher?",
  "How do I reset HWID?",
  "How do I pay for a subscription?",
  "What do clans give?",
];

const GREETING_RU =
  "Привет! Я помощник по гайдам Stellar Client. Опишите проблему или задайте вопрос — найду подходящую статью. Если ответа нет, предложу создать тикет.";
const GREETING_EN =
  "Hi! I'm the Stellar Client guide assistant. Describe the issue or ask a question — I'll find a relevant article. If there is no answer, I'll offer to open a ticket.";

export default function AssistantPage() {
  const { lang } = useI18n();
  const tr = (ru: string, en: string) => (lang === "en" ? en : ru);
  const quick = lang === "en" ? QUICK_EN : QUICK_RU;

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 0, role: "assistant", text: lang === "en" ? GREETING_EN : GREETING_RU },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const counter = useRef(1);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages((prev) =>
      prev.length === 1 && prev[0].role === "assistant"
        ? [{ id: 0, role: "assistant", text: lang === "en" ? GREETING_EN : GREETING_RU }]
        : prev
    );
  }, [lang]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || loading) return;

    setError("");
    setInput("");
    setMessages((prev) => [...prev, { id: counter.current++, role: "user", text }]);
    setLoading(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, lang }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error || tr("Не удалось получить ответ.", "Failed to get an answer."));
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: counter.current++,
          role: "assistant",
          text: String(data.answer || ""),
          reply: {
            answer: String(data.answer || ""),
            sources: Array.isArray(data.sources) ? data.sources : [],
            escalate: !!data.escalate,
            suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
          },
        },
      ]);
    } catch {
      setError(tr("Сеть недоступна. Попробуйте ещё раз.", "Network unavailable. Try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header />

      <main className="relative min-h-screen text-white overflow-hidden">
        <div className="absolute inset-0 -z-20 opacity-30">
          <Image src="/fluid1.png" alt="" fill className="object-cover" priority />
        </div>
        <div className="absolute inset-0 -z-30 opacity-20">
          <Image src="/fluid2.png" alt="" fill className="object-cover" />
        </div>

        <section className="relative z-10 pt-32 sm:pt-40 pb-20 px-4 sm:px-6">
          <div className="mx-auto max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
            >
              <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-purple-300/80 mb-4">
                <Sparkle size={16} weight="fill" />
                {tr("AI-помощник", "AI assistant")}
              </p>
              <h1 className="text-4xl sm:text-5xl font-extrabold mb-4">
                {tr("Помощник по гайдам", "Guide assistant")}
              </h1>
              <p className="text-white/45 max-w-2xl leading-relaxed">
                {tr(
                  "Отвечает по FAQ и статьям Stellar Client. Работает локально — без внешних сервисов и ключей. Сложные вопросы передаёт в поддержку.",
                  "Answers from Stellar Client FAQ and articles. Runs locally — no external services or keys. Complex issues are handed to support."
                )}
              </p>
            </motion.div>

            <div className="mt-10 rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-white/[0.03]">
                <span className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-400/30 grid place-items-center text-purple-200">
                  <Robot size={20} weight="fill" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{tr("Stellar Assistant", "Stellar Assistant")}</p>
                  <p className="text-[11px] text-white/35">
                    {tr("Поиск по FAQ и гайдам", "Searching FAQ and guides")}
                  </p>
                </div>
              </div>

              <div className="h-[min(58vh,520px)] min-h-[320px] overflow-y-auto px-4 sm:px-5 py-5 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[92%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line ${
                        message.role === "user"
                          ? "bg-purple-600 text-white rounded-br-sm"
                          : "bg-white/[0.06] border border-white/10 text-white/80 rounded-bl-sm"
                      }`}
                    >
                      {message.text}

                      {message.reply && message.reply.sources.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {message.reply.sources.map((source) => (
                            <Link
                              key={source.id}
                              href={source.url}
                              className="block rounded-xl border border-purple-400/20 bg-purple-500/[0.08] px-3 py-2.5 hover:bg-purple-500/[0.14] transition group"
                            >
                              <span className="flex items-start gap-2">
                                <BookOpenText
                                  size={15}
                                  className="mt-0.5 shrink-0 text-purple-300"
                                />
                                <span className="min-w-0">
                                  <span className="block text-xs font-semibold text-purple-100 group-hover:text-white transition">
                                    {source.title}
                                  </span>
                                  <span className="block text-[11px] text-white/40 mt-0.5 line-clamp-2">
                                    {source.snippet}
                                  </span>
                                </span>
                                <ArrowRight
                                  size={14}
                                  className="ml-auto mt-1 shrink-0 text-purple-300/60 group-hover:translate-x-0.5 transition"
                                />
                              </span>
                            </Link>
                          ))}
                        </div>
                      )}

                      {message.reply?.escalate && (
                        <Link
                          href="/support"
                          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 px-3 py-2 text-xs font-semibold transition"
                        >
                          <Headset size={15} />
                          {tr("Создать тикет", "Create a ticket")}
                        </Link>
                      )}

                      {message.reply && message.reply.suggestions.length > 0 && (
                        <div className="mt-3">
                          <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5">
                            {tr("Ещё по теме", "Related")}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {message.reply.suggestions.map((suggestion) => (
                              <button
                                key={suggestion}
                                type="button"
                                onClick={() => ask(suggestion)}
                                className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-white/60 hover:bg-white/10 hover:text-white transition text-left"
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-bl-sm bg-white/[0.06] border border-white/10 px-4 py-3">
                      <span className="inline-flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-300 animate-bounce [animation-delay:-0.2s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-300 animate-bounce [animation-delay:-0.1s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-300 animate-bounce" />
                      </span>
                    </div>
                  </div>
                )}

                <div ref={endRef} />
              </div>

              <div className="border-t border-white/10 px-4 sm:px-5 py-4 bg-white/[0.02]">
                {messages.length <= 1 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {quick.map((question) => (
                      <button
                        key={question}
                        type="button"
                        onClick={() => ask(question)}
                        className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/65 hover:bg-white/10 hover:text-white transition"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                )}

                {error && <p className="mb-2 text-xs text-red-300">{error}</p>}

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    ask(input);
                  }}
                  className="flex items-end gap-2"
                >
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value.slice(0, 500))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        ask(input);
                      }
                    }}
                    rows={1}
                    placeholder={tr(
                      "Например: почему не запускается лаунчер?",
                      "For example: why won't the launcher start?"
                    )}
                    className="min-h-[44px] max-h-32 flex-1 resize-none rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-purple-400/40"
                  />
                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="h-11 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:hover:bg-purple-600 text-sm font-semibold inline-flex items-center gap-2 transition"
                  >
                    <PaperPlaneTilt size={16} weight="fill" />
                    <span className="hidden sm:inline">{tr("Спросить", "Ask")}</span>
                  </button>
                </form>

                <p className="mt-2 text-[10px] text-white/25">
                  {tr(
                    "Помощник не заменяет поддержку: по платежам и блокировкам лучше сразу тикет.",
                    "The assistant is not a replacement for support: for payments and bans, open a ticket."
                  )}
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
