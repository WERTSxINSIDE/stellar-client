"use client";

import { useEffect, useRef, useState } from "react";
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
  Paperclip,
  X,
  Clock,
  Star,
  FileText,
  DownloadSimple,
} from "@phosphor-icons/react";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_IDS,
  isAllowedAttachmentName,
  isImageAttachment,
  supportCategoryLabel,
} from "@/lib/support";
import { useI18n } from "@/lib/i18n";

type Message = {
  id: number;
  user_id: number | null;
  is_admin: number;
  body: string;
  attachment_url: string | null;
  attachment_name: string | null;
  created_at: string;
};

type Ticket = {
  id: number;
  subject: string;
  category: string | null;
  status: string;
  user_unread: number;
  created_at: string;
  updated_at: string;
  csat_rating: number | null;
  csat_comment: string | null;
  csat_at: string | null;
  messages: Message[];
};

type Me = { id: number; username: string; role: string; is_admin: number } | null;

type DraftAttachment = { url: string; name: string } | null;

function fmt(ts: string, lang: "ru" | "en") {
  return new Date(ts.replace(" ", "T")).toLocaleString(lang === "en" ? "en-GB" : "ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Сжимает скриншот, чтобы вложение влезло в БД. */
function compressImage(file: File, maxSize = 1600, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();

    image.onload = () => {
      try {
        const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("canvas");
        ctx.drawImage(image, 0, 0, width, height);

        URL.revokeObjectURL(objectUrl);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(error);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("image"));
    };

    image.src = objectUrl;
  });
}

/** Определяет MIME по расширению, если браузер не знает тип файла. */
function fileMime(file: File) {
  if (file.type) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".rar")) return "application/vnd.rar";
  if (lower.endsWith(".7z")) return "application/x-7z-compressed";
  if (lower.endsWith(".txt") || lower.endsWith(".log")) return "text/plain";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

const MAX_ATTACHMENT_BYTES = 1_800_000;

/** Готовит вложение: картинки сжимает, остальные файлы читает как data URL. */
async function prepareAttachment(file: File): Promise<{ url: string; name: string }> {
  if (!isAllowedAttachmentName(file.name)) {
    throw new Error("ext");
  }

  if (/^image\//i.test(file.type)) {
    if (file.size > 8 * 1024 * 1024) throw new Error("size");
    return { url: await compressImage(file), name: file.name || "скриншот.jpg" };
  }

  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error("size");

  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });

  const payload = raw.includes(",") ? raw.split(",").pop() || "" : raw;
  return { url: `data:${fileMime(file)};base64,${payload}`, name: file.name };
}

const STATUS_STYLES: Record<string, { labelKey: string; className: string }> = {
  open: {
    labelKey: "support.statusOpen",
    className: "bg-green-500/20 text-green-300 border-green-400/25",
  },
  pending: {
    labelKey: "support.statusPending",
    className: "bg-amber-500/15 text-amber-300 border-amber-400/25",
  },
  closed: {
    labelKey: "support.statusClosed",
    className: "bg-white/10 text-white/50 border-white/10",
  },
};

function AttachmentPreview({
  attachment,
  onRemove,
  busy,
}: {
  attachment: DraftAttachment;
  onRemove: () => void;
  busy?: boolean;
}) {
  const { t } = useI18n();
  if (!attachment) return null;
  const isImage = isImageAttachment(attachment.url);
  return (
    <div className="relative inline-flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-2 pr-9 max-w-full">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={attachment.url}
          alt={attachment.name}
          className="h-16 w-16 rounded-lg object-cover bg-white/5"
        />
      ) : (
        <span className="h-16 w-16 rounded-lg bg-white/5 border border-white/10 grid place-items-center text-purple-300">
          <FileText size={26} />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-xs text-white/70 truncate max-w-[180px]">{attachment.name}</p>
        <p className="text-[11px] text-white/30">
          {isImage ? t("support.screenshotAttached") : t("support.fileAttached")}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={busy}
        aria-label={t("support.removeAttachment")}
        className="absolute top-1.5 right-1.5 w-6 h-6 grid place-items-center rounded-full bg-white/10 hover:bg-white/20 transition"
      >
        <X size={12} />
      </button>
    </div>
  );
}

function MessageAttachment({ message }: { message: Message }) {
  const { t } = useI18n();
  if (!message.attachment_url) return null;
  const isImage = isImageAttachment(message.attachment_url);

  if (isImage) {
    return (
      <a
        href={message.attachment_url}
        target="_blank"
        rel="noopener noreferrer"
        className="block mt-2 max-w-sm rounded-xl overflow-hidden border border-white/10 hover:border-purple-400/40 transition"
        title={message.attachment_name || t("support.screenshot")}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={message.attachment_url}
          alt={message.attachment_name || t("support.attachment")}
          className="w-full max-h-72 object-contain bg-black/40"
          loading="lazy"
        />
      </a>
    );
  }

  return (
    <a
      href={message.attachment_url}
      download={message.attachment_name || undefined}
      className="mt-2 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/60 hover:text-white hover:border-purple-400/40 transition"
    >
      <FileText size={16} className="text-purple-300" />
      <span className="max-w-[200px] truncate">
        {message.attachment_name || t("support.fileDefault")}
      </span>
      <DownloadSimple size={14} />
    </a>
  );
}

export default function SupportPage() {
  const { t, lang } = useI18n();
  const [me, setMe] = useState<Me>(null);
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<string>("other");
  const [body, setBody] = useState("");
  const [createAttachment, setCreateAttachment] = useState<DraftAttachment>(null);
  const [fileBusy, setFileBusy] = useState<"create" | "reply" | null>(null);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");

  const [replyFor, setReplyFor] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyAttachment, setReplyAttachment] = useState<DraftAttachment>(null);
  const [csatFor, setCsatFor] = useState<number | null>(null);
  const [csatComment, setCsatComment] = useState("");
  const [csatBusy, setCsatBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const createFileRef = useRef<HTMLInputElement | null>(null);
  const replyFileRef = useRef<HTMLInputElement | null>(null);

  async function load() {
    const res = await fetch("/api/support");
    const d = await res.json();
    if (d.ok) setTickets(d.tickets || []);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const categoryParam = params.get("category");
    if (
      categoryParam &&
      (SUPPORT_CATEGORY_IDS as readonly string[]).includes(categoryParam)
    ) {
      setCategory(categoryParam);
    }
    const subjectParam = params.get("subject");
    if (subjectParam) setSubject(subjectParam.slice(0, 160));
    const bodyParam = params.get("body");
    if (bodyParam) setBody(bodyParam.slice(0, 4000));

    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        setMe(d.user || null);
        setLoading(false);
        if (d.user) load();
      });
  }, []);

  async function pickFile(file: File | null, target: "create" | "reply") {
    if (!file) return;
    setMsg("");

    if (!isAllowedAttachmentName(file.name)) {
      setMsg(t("support.errExt"));
      return;
    }

    setFileBusy(target);
    try {
      const attachment = await prepareAttachment(file);
      if (target === "create") setCreateAttachment(attachment);
      else setReplyAttachment(attachment);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setMsg(
        code === "size"
          ? t("support.errSize")
          : code === "ext"
            ? t("support.errExt")
            : t("support.errProcess")
      );
    } finally {
      setFileBusy(null);
    }
  }

  async function createTicket() {
    if (!subject.trim() || (!body.trim() && !createAttachment)) {
      setMsg(t("support.errFill"));
      return;
    }
    setCreating(true);
    setMsg("");
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          subject,
          category,
          body,
          attachment: createAttachment || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg(d.error || t("support.error"));
        return;
      }
      setSubject("");
      setBody("");
      setCreateAttachment(null);
      await load();
    } catch {
      setMsg(t("support.serverError"));
    } finally {
      setCreating(false);
    }
  }

  async function sendReply(id: number) {
    if (!replyText.trim() && !replyAttachment) return;
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reply",
          ticket_id: id,
          body: replyText,
          attachment: replyAttachment || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg(d.error || t("support.errReply"));
        return;
      }
      setReplyText("");
      setReplyAttachment(null);
      setReplyFor(null);
      await load();
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

  async function rateTicket(id: number, rating: number) {
    setCsatBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "csat",
          ticket_id: id,
          rating,
          comment: csatComment,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg(d.error || t("support.errRate"));
        return;
      }
      setCsatFor(null);
      setCsatComment("");
      await load();
    } catch {
      setMsg(t("support.serverError"));
    } finally {
      setCsatBusy(false);
    }
  }

  const unreadTotal = tickets.reduce((sum, t) => sum + (Number(t.user_unread) || 0), 0);

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
            <ArrowLeft size={16} weight="bold" />{t("support.backHome")}
          </Link>

          <div className="flex items-center gap-3 mb-2">
            <Headset size={30} weight="fill" className="text-purple-400" />
            <p className="text-white/40 text-xs tracking-widest uppercase">{t("support.eyebrow")}</p>
          </div>
          <h1 className="text-5xl font-extrabold mb-4">
            <span className="bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
              {t("support.title")}
            </span>
          </h1>
          <p className="text-white/50 mb-10">{t("support.subtitle")}</p>

          {loading ? null : !me ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-8 text-center">
              <p className="text-white/60 mb-5">{t("support.loginPrompt")}</p>
              <Link
                href="/login"
                className="inline-block px-6 py-3 rounded-xl font-semibold bg-purple-600 hover:bg-purple-700 transition"
              >
                {t("support.login")}
              </Link>
            </div>
          ) : (
            <>
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7 mb-8">
                <h2 className="text-xl font-bold mb-4">{t("support.newTicket")}</h2>
                <label className="block text-white/40 text-xs mb-1">{t("support.category")}</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none mb-3 text-sm"
                >
                  {SUPPORT_CATEGORIES.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {supportCategoryLabel(entry.id, lang)}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t("support.subjectPlaceholder")}
                  maxLength={200}
                  className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none mb-3"
                />
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={t("support.bodyPlaceholder")}
                  rows={4}
                  className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none resize-none mb-3"
                />

                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <button
                    type="button"
                    onClick={() => createFileRef.current?.click()}
                    disabled={fileBusy === "create"}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm bg-white/5 hover:bg-white/10 border border-white/10 transition disabled:opacity-50"
                  >
                    <Paperclip size={16} />
                    {fileBusy === "create" ? t("support.processing") : t("support.attachFile")}
                  </button>
                  <input
                    ref={createFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,.log,application/zip,.rar,.7z"
                    className="hidden"
                    onChange={(e) => {
                      void pickFile(e.target.files?.[0] || null, "create");
                      e.target.value = "";
                    }}
                  />
                  <span className="text-[11px] text-white/30">
                    JPG, PNG, WebP, GIF, PDF, TXT, LOG, ZIP, RAR, 7Z
                  </span>
                </div>

                <AttachmentPreview
                  attachment={createAttachment}
                  onRemove={() => setCreateAttachment(null)}
                  busy={fileBusy === "create"}
                />

                <div className="flex items-center justify-between gap-3 flex-wrap mt-3">
                  {msg ? <p className="text-red-400 text-sm">{msg}</p> : <span />}
                  <button
                    onClick={createTicket}
                    disabled={creating || fileBusy === "create"}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition"
                  >
                    <PaperPlaneTilt size={18} weight="fill" />
                    {creating ? t("support.sending") : t("support.send")}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <h2 className="text-2xl font-bold">
                  {t("support.myTickets", { count: tickets.length })}
                </h2>
                {unreadTotal > 0 && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30">
                    {t("support.newCount", { count: unreadTotal })}
                  </span>
                )}
              </div>

              {tickets.length === 0 ? (
                <p className="text-white/30 text-center py-8">{t("support.empty")}</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {tickets.map((ticket) => {
                    const status = STATUS_STYLES[ticket.status] || STATUS_STYLES.open;
                    const unread = Number(ticket.user_unread) || 0;
                    return (
                      <div
                        key={ticket.id}
                        className={`rounded-3xl border bg-white/[0.04] backdrop-blur-xl p-6 ${
                          unread > 0 ? "border-purple-400/40" : "border-white/10"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold">{ticket.subject}</h3>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full border ${status.className}`}
                            >
                              {t(status.labelKey)}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/50">
                              {supportCategoryLabel(ticket.category, lang)}
                            </span>
                            {unread > 0 && (
                              <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-purple-500 text-white font-semibold">
                                <Clock size={11} /> {t("support.newCount", { count: unread })}
                              </span>
                            )}
                          </div>
                          <span className="text-white/30 text-xs">
                            #{ticket.id} · {fmt(ticket.created_at, lang)}
                          </span>
                        </div>

                        <div className="flex flex-col gap-3 mb-4">
                          {ticket.messages.map((m) => (
                            <div
                              key={m.id}
                              className={`rounded-2xl p-4 border ${
                                m.is_admin
                                  ? "bg-purple-600/10 border-purple-500/20 ml-0 sm:ml-8"
                                  : "bg-black/30 border-white/5 mr-0 sm:mr-8"
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span
                                  className={`text-xs font-semibold ${
                                    m.is_admin ? "text-purple-300" : "text-white/70"
                                  }`}
                                >
                                  {m.is_admin ? t("support.team") : t("support.you")}
                                </span>
                                <span className="text-white/25 text-xs">
                                  {fmt(m.created_at, lang)}
                                </span>
                              </div>
                              {m.body && (
                                <p className="text-white/80 text-sm whitespace-pre-wrap break-words">
                                  {m.body}
                                </p>
                              )}
                              <MessageAttachment message={m} />
                            </div>
                          ))}
                        </div>

                        {ticket.status !== "closed" && (
                          replyFor === ticket.id ? (
                            <div className="flex flex-col gap-2">
                              <textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder={t("support.replyPlaceholder")}
                                rows={3}
                                className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none resize-none"
                              />

                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => replyFileRef.current?.click()}
                                  disabled={fileBusy === "reply"}
                                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-white/5 hover:bg-white/10 border border-white/10 transition disabled:opacity-50"
                                >
                                  <Paperclip size={15} />
                                  {fileBusy === "reply" ? t("support.processing") : t("support.file")}
                                </button>
                                <input
                                  ref={replyFileRef}
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,.log,application/zip,.rar,.7z"
                                  className="hidden"
                                  onChange={(e) => {
                                    void pickFile(e.target.files?.[0] || null, "reply");
                                    e.target.value = "";
                                  }}
                                />
                                <AttachmentPreview
                                  attachment={replyAttachment}
                                  onRemove={() => setReplyAttachment(null)}
                                  busy={fileBusy === "reply"}
                                />
                              </div>

                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => {
                                    setReplyFor(null);
                                    setReplyText("");
                                    setReplyAttachment(null);
                                  }}
                                  className="px-4 py-2 rounded-xl text-sm bg-white/5 hover:bg-white/10 border border-white/10 transition"
                                >
                                  {t("support.cancel")}
                                </button>
                                <button
                                  onClick={() => sendReply(ticket.id)}
                                  disabled={busy || fileBusy === "reply"}
                                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition"
                                >
                                  {t("support.send")}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => {
                                  setReplyFor(ticket.id);
                                  setReplyText("");
                                  setReplyAttachment(null);
                                  setMsg("");
                                }}
                                className="px-4 py-2 rounded-xl text-sm bg-white/5 hover:bg-white/10 border border-white/10 transition"
                              >
                                {t("support.reply")}
                              </button>
                              <button
                                onClick={() => closeTicket(ticket.id)}
                                disabled={busy}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-white/5 hover:bg-white/10 border border-white/10 transition disabled:opacity-50"
                              >
                                <LockSimple size={16} />
                                {t("support.close")}
                              </button>
                            </div>
                          )
                        )}
                        {ticket.status === "closed" && (
                          <div className="border-t border-white/[0.06] pt-4">
                            <p className="flex items-center gap-2 text-white/30 text-xs justify-end mb-3">
                              <CheckCircle size={14} /> {t("support.closed")}
                            </p>

                            {ticket.csat_rating ? (
                              <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] p-4">
                                <p className="text-sm text-emerald-200/90 font-semibold mb-1">
                                  {t("support.thanks")}
                                </p>
                                <div className="flex items-center gap-0.5">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                      key={star}
                                      size={16}
                                      weight={star <= Number(ticket.csat_rating) ? "fill" : "regular"}
                                      className={
                                        star <= Number(ticket.csat_rating)
                                          ? "text-yellow-400"
                                          : "text-white/20"
                                      }
                                    />
                                  ))}
                                  <span className="text-xs text-white/40 ml-1">
                                    {ticket.csat_rating}/5
                                  </span>
                                </div>
                                {ticket.csat_comment && (
                                  <p className="text-xs text-white/50 mt-2 whitespace-pre-wrap break-words">
                                    {ticket.csat_comment}
                                  </p>
                                )}
                              </div>
                            ) : csatFor === ticket.id ? (
                              <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                                <p className="text-sm font-semibold mb-2">
                                  {t("support.rateTitle")}
                                </p>
                                <div className="flex items-center gap-1">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                      key={star}
                                      type="button"
                                      disabled={csatBusy}
                                      onClick={() => rateTicket(ticket.id, star)}
                                      aria-label={`${star}/5`}
                                      className="hover:scale-110 transition disabled:opacity-50"
                                    >
                                      <Star size={24} className="text-yellow-400/80" />
                                    </button>
                                  ))}
                                </div>
                                <textarea
                                  value={csatComment}
                                  onChange={(e) => setCsatComment(e.target.value)}
                                  rows={2}
                                  maxLength={500}
                                  placeholder={t("support.csatPlaceholder")}
                                  className="w-full mt-2 bg-black/40 px-3 py-2 rounded-xl border border-white/10 focus:border-purple-500 outline-none resize-none text-sm"
                                />
                                <div className="flex justify-end mt-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCsatFor(null);
                                      setCsatComment("");
                                    }}
                                    className="px-3 py-1.5 rounded-lg text-xs bg-white/5 hover:bg-white/10 border border-white/10 transition"
                                  >
                                    {t("support.cancel")}
                                  </button>
                                </div>
                                <p className="text-[11px] text-white/30 mt-2">
                                  {t("support.rateHint")}
                                </p>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-white/10 bg-black/25 p-3">
                                <p className="text-sm text-white/50">
                                  {t("support.csatPrompt")}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCsatFor(ticket.id);
                                    setCsatComment("");
                                    setMsg("");
                                  }}
                                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-purple-600 hover:bg-purple-700 transition"
                                >
                                  <Star size={16} /> {t("support.rate")}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
