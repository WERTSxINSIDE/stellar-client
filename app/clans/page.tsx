"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  EnvelopeSimple,
  MagnifyingGlass,
  Plus,
  Shield,
  Sparkle,
  Trophy,
  X,
} from "@phosphor-icons/react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useI18n } from "@/lib/i18n";
import { clanRoleLabel } from "@/lib/clans";

type ClanListItem = {
  id: number;
  name: string;
  tag: string;
  description: string | null;
  emblem: string;
  color: string;
  xp: number;
  treasury: number;
  recruiting: number;
  member_count: number;
  role_count: number;
  level: number;
  max_members: number;
  bonus_percent: number;
  leader_name: string;
  created_at: string;
  applied?: boolean;
};

type MyClan = ClanListItem & { role: string };

type Invite = {
  id: number;
  clan_id: number;
  name: string;
  tag: string;
  emblem: string;
  color: string;
  inviter_name: string | null;
  created_at: string;
};

type ClansData = {
  clans: ClanListItem[];
  my_clan: MyClan | null;
  invites: Invite[];
  create_cost: number;
  my_coins: number;
  logged_in: boolean;
};

const EMPTY: ClansData = {
  clans: [],
  my_clan: null,
  invites: [],
  create_cost: 500,
  my_coins: 0,
  logged_in: false,
};

const SORTS = [
  { key: "xp", ru: "По прогрессу", en: "By progress" },
  { key: "members", ru: "По составу", en: "By members" },
  { key: "treasury", ru: "По казне", en: "By treasury" },
  { key: "new", ru: "Новые", en: "New" },
];

export default function ClansPage() {
  const { lang } = useI18n();
  const tr = (ru: string, en: string) => (lang === "en" ? en : ru);

  const [data, setData] = useState<ClansData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("xp");
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [applyTarget, setApplyTarget] = useState<ClanListItem | null>(null);
  const [applyMessage, setApplyMessage] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    name: "",
    tag: "",
    emblem: "🛡️",
    color: "#a78bfa",
    description: "",
  });

  const load = useCallback(
    async (nextSort = sort, nextQuery = query) => {
      try {
        const params = new URLSearchParams({ sort: nextSort });
        if (nextQuery.trim()) params.set("q", nextQuery.trim());
        const res = await fetch(`/api/clans?${params.toString()}`);
        const json = await res.json();
        if (json.ok) setData({ ...EMPTY, ...json });
      } catch {
        setError(tr("Не удалось загрузить кланы", "Failed to load clans"));
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sort, query, lang]
  );

  useEffect(() => {
    load();
  }, [load]);

  async function createClan(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const res = await fetch("/api/clans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.error || tr("Не удалось создать клан", "Failed to create clan"));
        return;
      }
      setShowCreate(false);
      setForm({ name: "", tag: "", emblem: "🛡️", color: "#a78bfa", description: "" });
      setNotice(tr("Клан создан!", "Clan created!"));
      await load();
    } catch {
      setError(tr("Ошибка сети", "Network error"));
    } finally {
      setBusy(false);
    }
  }

  async function applyToClan() {
    if (!applyTarget) return;
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const res = await fetch(`/api/clans/${applyTarget.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: applyMessage }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.error || tr("Не удалось подать заявку", "Failed to apply"));
        return;
      }
      setApplyTarget(null);
      setApplyMessage("");
      setNotice(tr("Заявка отправлена. Ждите ответа офицеров.", "Application sent. Wait for officers."));
      await load();
    } catch {
      setError(tr("Ошибка сети", "Network error"));
    } finally {
      setBusy(false);
    }
  }

  async function respondInvite(invite: Invite, action: "accept" | "decline") {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const res = await fetch("/api/clans/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId: invite.id, action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.error || tr("Не удалось обработать приглашение", "Failed to handle invite"));
        return;
      }
      if (action === "accept" && json.clan_id) {
        window.location.href = `/clans/${json.clan_id}`;
        return;
      }
      setNotice(tr("Приглашение отклонено", "Invite declined"));
      await load();
    } catch {
      setError(tr("Ошибка сети", "Network error"));
    } finally {
      setBusy(false);
    }
  }

  const canCreate = data.logged_in && !data.my_clan;

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
          <div className="mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
            >
              <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-purple-300/80 mb-4">
                <Shield size={16} weight="fill" />
                {tr("Кланы", "Clans")}
              </p>
              <h1 className="text-4xl sm:text-5xl font-extrabold mb-4">
                {tr("Соберите свой клан", "Build your clan")}
              </h1>
              <p className="text-white/45 max-w-2xl leading-relaxed">
                {tr(
                  "Общий прогресс, клановый лидерборд, казна и бонус к ежедневным SC за состав. Чем больше активных участников и ролей — тем сильнее клан.",
                  "Shared progress, a clan leaderboard, treasury and a daily SC bonus for composition. More active members and roles make a stronger clan."
                )}
              </p>
            </motion.div>

            {error && (
              <div className="mt-5 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}
            {notice && (
              <div className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {notice}
              </div>
            )}

            {data.my_clan && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 rounded-3xl border border-purple-400/25 bg-purple-500/[0.08] p-5 sm:p-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <span
                    className="w-14 h-14 shrink-0 rounded-2xl grid place-items-center text-2xl border"
                    style={{ borderColor: `${data.my_clan.color}55`, background: `${data.my_clan.color}22` }}
                  >
                    {data.my_clan.emblem}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-wider text-white/35">
                      {tr("Мой клан", "My clan")}
                    </p>
                    <h2 className="text-xl font-bold truncate">
                      {data.my_clan.name}{" "}
                      <span className="text-sm font-mono text-purple-300">[{data.my_clan.tag}]</span>
                    </h2>
                    <p className="text-xs text-white/40 mt-1">
                      {tr("Ваша роль", "Your role")}:{" "}
                      <span className="text-white/70">{clanRoleLabel(data.my_clan.role, lang)}</span>
                      {" · "}
                      {data.my_clan.member_count}/{data.my_clan.max_members} {tr("участников", "members")}
                      {" · "}
                      {tr("бонус", "bonus")} +{data.my_clan.bonus_percent}%
                    </p>
                  </div>
                  <Link
                    href={`/clans/${data.my_clan.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 px-5 py-3 text-sm font-semibold transition"
                  >
                    {tr("Открыть клан", "Open clan")}
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </motion.div>
            )}

            {data.invites.length > 0 && (
              <div className="mt-6 space-y-3">
                <h2 className="text-sm font-semibold text-white/70 inline-flex items-center gap-2">
                  <EnvelopeSimple size={16} />
                  {tr("Приглашения", "Invites")}
                </h2>
                {data.invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
                  >
                    <span className="text-xl">{invite.emblem}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {invite.name} <span className="text-white/40 font-mono">[{invite.tag}]</span>
                      </p>
                      <p className="text-xs text-white/35">
                        {tr("Пригласил", "Invited by")} {invite.inviter_name || "—"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => respondInvite(invite, "accept")}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-3 py-2 text-xs font-semibold transition"
                      >
                        <Check size={14} />
                        {tr("Принять", "Accept")}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => respondInvite(invite, "decline")}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-50 px-3 py-2 text-xs font-semibold transition"
                      >
                        <X size={14} />
                        {tr("Отклонить", "Decline")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {canCreate && (
              <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <p className="font-semibold inline-flex items-center gap-2">
                      <Sparkle size={18} weight="fill" className="text-purple-300" />
                      {tr("Создать клан", "Create a clan")}
                    </p>
                    <p className="text-sm text-white/40 mt-1">
                      {tr("Стоимость", "Cost")}: {data.create_cost} SC · {tr("у вас", "you have")}{" "}
                      <span className="text-amber-200">{data.my_coins} SC</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreate((value) => !value)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-purple-400/30 bg-purple-500/10 hover:bg-purple-500/20 px-5 py-3 text-sm font-semibold text-purple-100 transition"
                  >
                    {showCreate ? <X size={16} /> : <Plus size={16} />}
                    {showCreate ? tr("Свернуть", "Collapse") : tr("Заполнить заявку", "Fill the form")}
                  </button>
                </div>

                {showCreate && (
                  <form onSubmit={createClan} className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="text-xs text-white/50">
                      {tr("Название", "Name")}
                      <input
                        value={form.name}
                        onChange={(event) => setForm({ ...form, name: event.target.value.slice(0, 32) })}
                        placeholder={tr("Например: Stellar Legion", "For example: Stellar Legion")}
                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-purple-400/40"
                      />
                    </label>
                    <label className="text-xs text-white/50">
                      {tr("Тег (2–6 латинских символов)", "Tag (2–6 Latin characters)")}
                      <input
                        value={form.tag}
                        onChange={(event) =>
                          setForm({ ...form, tag: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) })
                        }
                        placeholder="STLR"
                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm font-mono text-white placeholder:text-white/25 outline-none focus:border-purple-400/40"
                      />
                    </label>
                    <label className="text-xs text-white/50">
                      {tr("Эмблема", "Emblem")}
                      <input
                        value={form.emblem}
                        onChange={(event) => setForm({ ...form, emblem: event.target.value.slice(0, 4) })}
                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-purple-400/40"
                      />
                    </label>
                    <label className="text-xs text-white/50">
                      {tr("Цвет", "Color")}
                      <span className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                        <input
                          type="color"
                          value={form.color}
                          onChange={(event) => setForm({ ...form, color: event.target.value })}
                          className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent"
                        />
                        <span className="text-sm font-mono text-white/60">{form.color}</span>
                      </span>
                    </label>
                    <label className="sm:col-span-2 text-xs text-white/50">
                      {tr("Описание", "Description")}
                      <textarea
                        value={form.description}
                        onChange={(event) => setForm({ ...form, description: event.target.value.slice(0, 280) })}
                        rows={3}
                        placeholder={tr(
                          "Кого ищете, какой стиль игры, требования к активности…",
                          "Who you are looking for, playstyle, activity requirements…"
                        )}
                        className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-purple-400/40"
                      />
                    </label>
                    <div className="sm:col-span-2 flex flex-col sm:flex-row sm:items-center gap-3">
                      <button
                        type="submit"
                        disabled={busy || data.my_coins < data.create_cost}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 px-5 py-3 text-sm font-semibold transition"
                      >
                        <Shield size={16} weight="fill" />
                        {tr("Создать за", "Create for")} {data.create_cost} SC
                      </button>
                      {data.my_coins < data.create_cost && (
                        <p className="text-xs text-amber-200/70">
                          {tr("Не хватает SC — загляните в ежедневные награды и достижения.", "Not enough SC — check daily rewards and achievements.")}
                        </p>
                      )}
                    </div>
                  </form>
                )}
              </div>
            )}

            <div className="mt-10 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
              <div className="flex flex-wrap gap-2">
                {SORTS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setSort(item.key);
                      load(item.key, query);
                    }}
                    className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                      sort === item.key
                        ? "bg-purple-600 text-white"
                        : "border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/10"
                    }`}
                  >
                    {lang === "en" ? item.en : item.ru}
                  </button>
                ))}
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  load(sort, query);
                }}
                className="flex items-center gap-2 w-full lg:w-80"
              >
                <div className="relative flex-1">
                  <MagnifyingGlass
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
                  />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value.slice(0, 40))}
                    placeholder={tr("Поиск по названию или тегу", "Search by name or tag")}
                    className="w-full rounded-xl border border-white/10 bg-black/30 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-purple-400/40"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2.5 text-sm font-semibold transition"
                >
                  {tr("Найти", "Search")}
                </button>
              </form>
            </div>

            {loading ? (
              <p className="mt-10 text-sm text-white/40">{tr("Загрузка кланов...", "Loading clans...")}</p>
            ) : data.clans.length === 0 ? (
              <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center">
                <Shield size={34} className="mx-auto text-white/20" />
                <p className="mt-3 text-sm text-white/50">
                  {tr("Кланов пока нет. Создайте первый!", "No clans yet. Create the first one!")}
                </p>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                {data.clans.map((clan, index) => (
                  <motion.div
                    key={clan.id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.15 }}
                    transition={{ duration: 0.35, delay: Math.min(index, 6) * 0.04 }}
                    className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 hover:border-purple-400/25 transition"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="w-12 h-12 shrink-0 rounded-2xl grid place-items-center text-xl border"
                        style={{ borderColor: `${clan.color}55`, background: `${clan.color}22` }}
                      >
                        {clan.emblem}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 className="font-bold truncate">
                          {clan.name}{" "}
                          <span className="text-xs font-mono text-purple-300">[{clan.tag}]</span>
                        </h2>
                        <p className="text-xs text-white/35">
                          {tr("Лидер", "Leader")}: {clan.leader_name} · {tr("уровень", "level")} {clan.level}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-200">
                        <Trophy size={12} />
                        {clan.xp} XP
                      </span>
                    </div>

                    {clan.description && (
                      <p className="mt-3 text-sm text-white/45 line-clamp-2">{clan.description}</p>
                    )}

                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-white/[0.03] border border-white/5 px-2 py-2">
                        <p className="text-sm font-semibold">
                          {clan.member_count}/{clan.max_members}
                        </p>
                        <p className="text-[10px] text-white/30">{tr("состав", "members")}</p>
                      </div>
                      <div className="rounded-xl bg-white/[0.03] border border-white/5 px-2 py-2">
                        <p className="text-sm font-semibold text-emerald-200">+{clan.bonus_percent}%</p>
                        <p className="text-[10px] text-white/30">{tr("бонус SC", "SC bonus")}</p>
                      </div>
                      <div className="rounded-xl bg-white/[0.03] border border-white/5 px-2 py-2">
                        <p className="text-sm font-semibold text-amber-200">{clan.treasury} ₽</p>
                        <p className="text-[10px] text-white/30">{tr("казна", "treasury")}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <Link
                        href={`/clans/${clan.id}`}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2.5 text-sm font-semibold transition"
                      >
                        {tr("Подробнее", "Details")}
                      </Link>
                      {!data.my_clan && data.logged_in && (
                        <button
                          type="button"
                          disabled={!clan.recruiting || clan.applied || busy}
                          onClick={() => {
                            setApplyTarget(clan);
                            setApplyMessage("");
                          }}
                          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 px-4 py-2.5 text-sm font-semibold transition"
                        >
                          {clan.applied ? tr("Заявка отправлена", "Applied") : tr("Вступить", "Join")}
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {!data.logged_in && (
              <p className="mt-8 text-sm text-white/40">
                {tr("Чтобы создать клан или вступить в него,", "To create or join a clan,")}{" "}
                <Link href="/login" className="text-purple-300 hover:text-purple-200 underline">
                  {tr("войдите в аккаунт", "sign in")}
                </Link>
                .
              </p>
            )}
          </div>
        </section>
      </main>

      {applyTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center px-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0712] p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold">
                {tr("Заявка в", "Apply to")} {applyTarget.name}
              </h3>
              <button
                type="button"
                onClick={() => setApplyTarget(null)}
                className="w-8 h-8 grid place-items-center rounded-lg bg-white/5 hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-white/40 mt-1">
              {tr("Офицеры увидят сообщение и примут решение.", "Officers will see your message and decide.")}
            </p>
            <textarea
              value={applyMessage}
              onChange={(event) => setApplyMessage(event.target.value.slice(0, 240))}
              rows={4}
              placeholder={tr("Расскажите о себе и активности", "Tell them about yourself and activity")}
              className="mt-4 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-purple-400/40"
            />
            <button
              type="button"
              disabled={busy}
              onClick={applyToClan}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-4 py-3 text-sm font-semibold transition"
            >
              <Check size={16} />
              {tr("Отправить заявку", "Send application")}
            </button>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
}
