"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ChatCircleDots,
  Check,
  Coins,
  Crown,
  GearSix,
  PaperPlaneTilt,
  Shield,
  Sparkle,
  Trash,
  Trophy,
  UserPlus,
  UsersThree,
  X,
} from "@phosphor-icons/react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useI18n } from "@/lib/i18n";
import { isCosmicBadge, isRgbValue } from "@/lib/cosmetics";
import {
  CLAN_ROLES,
  CLAN_ROLE_META,
  clanRoleColor,
  clanRoleLabel,
  roleWeight,
  type ClanRole,
} from "@/lib/clans";

type Clan = {
  id: number;
  name: string;
  tag: string;
  description: string | null;
  emblem: string;
  color: string;
  leader_id: number;
  leader_name: string;
  xp: number;
  treasury: number;
  recruiting: number;
  member_count: number;
  role_count: number;
  level: number;
  max_members: number;
  bonus_percent: number;
  created_at: string;
};

type Member = {
  user_id: number;
  role: string;
  contribution: number;
  weekly_points: number;
  joined_at: string;
  last_active_at: string;
  username: string;
  avatar_url: string | null;
  nickname_color: string | null;
  equipped_badge: string | null;
  subscription_end: string | null;
};

type Activity = {
  id: number;
  type: string;
  points: number;
  note: string | null;
  created_at: string;
  username: string | null;
};

type Message = {
  id: number;
  body: string;
  created_at: string;
  user_id: number | null;
  username: string | null;
  avatar_url: string | null;
  nickname_color: string | null;
};

type Transaction = {
  id: number;
  amount: number;
  type: string;
  note: string | null;
  created_at: string;
  username: string | null;
};

type Application = {
  id: number;
  user_id: number;
  message: string | null;
  status: string;
  created_at: string;
  username: string;
  avatar_url: string | null;
  subscription_end: string | null;
};

type Invite = {
  id: number;
  invitee_id: number;
  status: string;
  created_at: string;
  expires_at: string | null;
  username: string;
};

type ClanMission = {
  key: string;
  title_ru: string;
  title_en: string;
  desc_ru: string;
  desc_en: string;
  icon: string;
  reward: number;
  target: number;
  progress: number;
  claimed: boolean;
  claimable: boolean;
};

type MissionState = {
  missions: ClanMission[];
  member_count: number;
  week_start: string;
  resets_at: string;
  week_reward: number;
  claimed_reward: number;
  claimable_reward: number;
  min_members: number;
  viewer_can_claim: boolean;
};

type Detail = {
  clan: Clan;
  members: Member[];
  activity: Activity[];
  messages: Message[];
  transactions: Transaction[];
  applications: Application[];
  invites: Invite[];
  my_role: string | null;
  is_member: boolean;
  my_application: { id: number; status: string; created_at: string } | null;
  missions: MissionState | null;
  permissions: string[];
};

type Tab = "overview" | "members" | "missions" | "requests" | "treasury" | "chat" | "settings";

const roleOptions = CLAN_ROLES.filter((role) => role !== "leader");

function fmtDate(value: string, lang: "ru" | "en") {
  return new Date(value.replace(" ", "T")).toLocaleString(lang === "en" ? "en-GB" : "ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Склеивает сообщения по id и держит строгий порядок: старые сверху, новые снизу. */
function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const map = new Map<number, Message>();
  for (const message of current) map.set(message.id, message);
  for (const message of incoming) {
    map.set(message.id, { ...map.get(message.id), ...message });
  }
  return [...map.values()].sort((a, b) => a.id - b.id);
}

export default function ClanPage() {
  const params = useParams<{ id: string }>();
  const clanId = Number(params?.id);
  const { lang } = useI18n();
  const tr = (ru: string, en: string) => (lang === "en" ? en : ru);

  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [applyMessage, setApplyMessage] = useState("");
  const [showApply, setShowApply] = useState(false);

  const [chatText, setChatText] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [money, setMoney] = useState("100");

  const chatBoxRef = useRef<HTMLDivElement | null>(null);
  const chatMessagesRef = useRef<Message[]>([]);
  const chatCountRef = useRef(0);
  const chatTabRef = useRef<Tab>("overview");

  const scrollChatToBottom = useCallback((smooth = true) => {
    const box = chatBoxRef.current;
    if (!box) return;
    box.scrollTo({ top: box.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const [settings, setSettings] = useState({ description: "", emblem: "🛡️", color: "#a78bfa", recruiting: true });
  const [settingsInit, setSettingsInit] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isInteger(clanId) || clanId <= 0) return;
    try {
      const res = await fetch(`/api/clans/${clanId}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.error || tr("Клан не найден", "Clan not found"));
        return;
      }
      setData(json);
      if (!settingsInit) {
        setSettings({
          description: json.clan.description || "",
          emblem: json.clan.emblem || "🛡️",
          color: json.clan.color || "#a78bfa",
          recruiting: !!json.clan.recruiting,
        });
        setSettingsInit(true);
      }
    } catch {
      setError(tr("Не удалось загрузить клан", "Failed to load the clan"));
    } finally {
      setLoading(false);
    }
  }, [clanId, lang, settingsInit]);

  useEffect(() => {
    load();
  }, [load]);

  async function action(url: string, body: Record<string, unknown>, method = "POST") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.error || tr("Не удалось выполнить действие", "Action failed"));
        return null;
      }
      await load();
      return json;
    } catch {
      setError(tr("Ошибка сети", "Network error"));
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    const result = await action(`/api/clans/${clanId}/join`, { message: applyMessage });
    if (result) {
      setShowApply(false);
      setApplyMessage("");
      setNotice(tr("Заявка отправлена. Ждите ответа офицеров.", "Application sent. Wait for officers."));
    }
  }

  async function leave() {
    if (!window.confirm(tr("Выйти из клана?", "Leave the clan?"))) return;
    const result = await action(`/api/clans/${clanId}/members`, { action: "leave" });
    if (result) {
      setNotice(tr("Вы вышли из клана", "You left the clan"));
      if (result.disbanded) window.location.href = "/clans";
    }
  }

  async function setRole(member: Member, role: ClanRole) {
    await action(`/api/clans/${clanId}/members`, { action: "role", userId: member.user_id, role });
  }

  async function kick(member: Member) {
    if (!window.confirm(tr(`Исключить ${member.username}?`, `Kick ${member.username}?`))) return;
    await action(`/api/clans/${clanId}/members`, { action: "kick", userId: member.user_id });
  }

  async function transfer(member: Member) {
    if (
      !window.confirm(
        tr(`Передать лидерство ${member.username}? Вы станете соруководителем.`, `Transfer leadership to ${member.username}? You will become co-leader.`)
      )
    )
      return;
    await action(`/api/clans/${clanId}/members`, { action: "transfer", userId: member.user_id });
  }

  async function review(application: Application, decision: "approve" | "reject") {
    await action(`/api/clans/${clanId}/applications`, { applicationId: application.id, action: decision });
  }

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    if (!inviteName.trim()) return;
    const result = await action(`/api/clans/${clanId}/invites`, { username: inviteName.trim() });
    if (result) {
      setInviteName("");
      setNotice(tr("Приглашение отправлено", "Invite sent"));
    }
  }

  async function cancelInvite(inviteId: number) {
    await action(`/api/clans/${clanId}/invites`, { inviteId }, "DELETE");
  }

  async function claimMission(mission: ClanMission) {
    if (busy || !mission.claimable) return;
    const result = await action(`/api/clans/${clanId}/missions`, { key: mission.key });
    if (result) {
      setNotice(
        tr(
          `Награда +${result.reward} SC начислена участникам (${result.distributed})`,
          `Reward +${result.reward} SC sent to members (${result.distributed})`
        )
      );
    }
  }

  async function treasury(kind: "deposit" | "withdraw") {
    const amount = Math.floor(Number(money));
    if (!Number.isInteger(amount) || amount <= 0) {
      setError(tr("Введите сумму", "Enter an amount"));
      return;
    }
    const result = await action(`/api/clans/${clanId}/treasury`, { action: kind, amount });
    if (result) {
      setMoney("100");
      setNotice(
        kind === "deposit"
          ? tr("Казна пополнена", "Treasury topped up")
          : tr("Средства выведены на баланс", "Funds withdrawn to balance")
      );
    }
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    const text = chatText.trim();
    if (!text) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/clans/${clanId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.error || tr("Не удалось отправить сообщение", "Failed to send message"));
        return;
      }
      setChatText("");
      if (json.message) {
        setData((prev) =>
          prev
            ? { ...prev, messages: mergeMessages(prev.messages, [json.message as Message]) }
            : prev
        );
      }
      requestAnimationFrame(() => scrollChatToBottom());
    } catch {
      setError(tr("Ошибка сети", "Network error"));
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings(event: React.FormEvent) {
    event.preventDefault();
    const result = await action(
      `/api/clans/${clanId}`,
      {
        description: settings.description,
        emblem: settings.emblem,
        color: settings.color,
        recruiting: settings.recruiting,
      },
      "PATCH"
    );
    if (result) setNotice(tr("Настройки сохранены", "Settings saved"));
  }

  async function disband() {
    if (
      !window.confirm(
        tr("Распустить клан? Это действие необратимо: все участники потеряют клан.", "Disband the clan? This cannot be undone.")
      )
    )
      return;
    const result = await action(`/api/clans/${clanId}`, {}, "DELETE");
    if (result) window.location.href = "/clans";
  }

  useEffect(() => {
    chatMessagesRef.current = data?.messages ?? [];
  }, [data?.messages]);

  useEffect(() => {
    if (!data?.is_member) return;
    const timer = setInterval(() => {
      if (tab !== "chat") return;
      const lastId = chatMessagesRef.current[chatMessagesRef.current.length - 1]?.id ?? 0;
      fetch(`/api/clans/${clanId}/chat${lastId > 0 ? `?after=${lastId}` : ""}`)
        .then((res) => res.json())
        .then((json) => {
          if (!json.ok || !Array.isArray(json.messages) || json.messages.length === 0) return;
          setData((prev) =>
            prev
              ? { ...prev, messages: mergeMessages(prev.messages, json.messages as Message[]) }
              : prev
          );
        })
        .catch(() => {});
    }, 6000);
    return () => clearInterval(timer);
  }, [clanId, data?.is_member, tab]);

  // Автоскролл: вниз при открытии чата и при каждом новом сообщении.
  useEffect(() => {
    const count = data?.messages?.length ?? 0;
    const openedChat = tab === "chat" && chatTabRef.current !== "chat";
    const hasNew = tab === "chat" && count !== chatCountRef.current;

    chatTabRef.current = tab;
    chatCountRef.current = count;

    if (!openedChat && !hasNew) return;
    const frame = requestAnimationFrame(() => scrollChatToBottom(!openedChat));
    return () => cancelAnimationFrame(frame);
  }, [tab, data?.messages, scrollChatToBottom]);

  const myWeight = useMemo(() => roleWeight(data?.my_role), [data?.my_role]);
  const can = useCallback(
    (permission: string) => !!data?.permissions?.includes(permission),
    [data?.permissions]
  );

  if (loading) {
    return (
      <>
        <Header />
        <main className="min-h-screen grid place-items-center text-white/40 text-sm">
          {tr("Загрузка клана...", "Loading clan...")}
        </main>
        <Footer />
      </>
    );
  }

  if (!data) {
    return (
      <>
        <Header />
        <main className="min-h-screen grid place-items-center px-4">
          <div className="text-center">
            <Shield size={40} className="mx-auto text-white/20" />
            <p className="mt-4 text-white/60">{error || tr("Клан не найден", "Clan not found")}</p>
            <Link href="/clans" className="mt-4 inline-flex text-purple-300 hover:text-purple-200">
              {tr("Вернуться к кланам", "Back to clans")}
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const clan = data.clan;
  const nextLevelXp = (clan.level) ** 2 * 100;
  const currentLevelXp = (clan.level - 1) ** 2 * 100;
  const levelProgress = Math.min(
    100,
    Math.round(((clan.xp - currentLevelXp) / Math.max(1, nextLevelXp - currentLevelXp)) * 100)
  );

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: tr("Обзор", "Overview"), icon: <Sparkle size={16} /> },
    { key: "members", label: tr("Участники", "Members"), icon: <UsersThree size={16} /> },
  ];
  if (data.is_member) {
    tabs.push({ key: "missions", label: tr("Миссии", "Missions"), icon: <Trophy size={16} /> });
    if (can("review_applications") || can("invite")) {
      tabs.push({ key: "requests", label: tr("Заявки", "Requests"), icon: <UserPlus size={16} /> });
    }
    tabs.push({ key: "treasury", label: tr("Казна", "Treasury"), icon: <Coins size={16} /> });
    tabs.push({ key: "chat", label: tr("Чат", "Chat"), icon: <ChatCircleDots size={16} /> });
    if (can("manage_settings")) {
      tabs.push({ key: "settings", label: tr("Настройки", "Settings"), icon: <GearSix size={16} /> });
    }
  }

  const activeTab = tabs.some((item) => item.key === tab) ? tab : "overview";

  return (
    <>
      <Header />
      <main className="relative min-h-screen text-white overflow-hidden">
        <div className="absolute inset-0 -z-20 opacity-25">
          <Image src="/fluid1.png" alt="" fill className="object-cover" priority />
        </div>

        <section className="relative z-10 pt-28 sm:pt-36 pb-20 px-4 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <Link
              href="/clans"
              className="inline-flex items-center gap-2 text-xs text-white/40 hover:text-white/70 transition mb-6"
            >
              <ArrowLeft size={14} />
              {tr("Все кланы", "All clans")}
            </Link>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-7"
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <span
                  className="w-16 h-16 shrink-0 rounded-2xl grid place-items-center text-3xl border"
                  style={{ borderColor: `${clan.color}66`, background: `${clan.color}22` }}
                >
                  {clan.emblem}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl sm:text-3xl font-extrabold">{clan.name}</h1>
                    <span className="text-sm font-mono text-purple-300">[{clan.tag}]</span>
                    {!clan.recruiting && (
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] text-white/40">
                        {tr("набор закрыт", "recruiting closed")}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white/40 mt-1">
                    {tr("Лидер", "Leader")}: {clan.leader_name} · {tr("уровень", "level")} {clan.level} ·{" "}
                    {clan.member_count}/{clan.max_members} {tr("участников", "members")}
                  </p>
                  {clan.description && <p className="text-sm text-white/50 mt-3">{clan.description}</p>}
                </div>

                <div className="shrink-0 flex flex-wrap items-center gap-2">
                  {data.is_member ? (
                    <button
                      type="button"
                      onClick={leave}
                      disabled={busy}
                      className="rounded-xl border border-red-400/25 bg-red-500/10 hover:bg-red-500/15 px-4 py-2.5 text-sm font-semibold text-red-200 disabled:opacity-50 transition"
                    >
                      {tr("Выйти из клана", "Leave clan")}
                    </button>
                  ) : data.my_application?.status === "pending" ? (
                    <span className="rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">
                      {tr("Заявка на рассмотрении", "Application pending")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowApply(true)}
                      disabled={!clan.recruiting || clan.member_count >= clan.max_members}
                      className="inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 px-4 py-2.5 text-sm font-semibold transition"
                    >
                      <UserPlus size={16} />
                      {tr("Вступить", "Join")}
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-white/30">{tr("Прогресс", "Progress")}</p>
                  <p className="text-lg font-bold inline-flex items-center gap-1.5">
                    <Trophy size={16} className="text-amber-300" />
                    {clan.xp} XP
                  </p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-white/30">{tr("Бонус состава", "Composition bonus")}</p>
                  <p className="text-lg font-bold text-emerald-200">+{clan.bonus_percent}%</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-white/30">{tr("Казна", "Treasury")}</p>
                  <p className="text-lg font-bold text-amber-200">{clan.treasury} ₽</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-white/30">{tr("Роли", "Roles")}</p>
                  <p className="text-lg font-bold">{clan.role_count}/8</p>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] text-white/35 mb-1.5">
                  <span>
                    {tr("До уровня", "To level")} {clan.level + 1}
                  </span>
                  <span>
                    {clan.xp} / {nextLevelXp} XP
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-400 transition-all"
                    style={{ width: `${levelProgress}%` }}
                  />
                </div>
              </div>
            </motion.div>

            {error && (
              <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}
            {notice && (
              <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {notice}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              {tabs.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${
                    activeTab === item.key
                      ? "bg-purple-600 text-white"
                      : "border border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/10"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>

            {activeTab === "overview" && (
              <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <h2 className="font-bold mb-4 inline-flex items-center gap-2">
                    <Sparkle size={16} className="text-purple-300" />
                    {tr("Активность клана", "Clan activity")}
                  </h2>
                  {data.activity.length === 0 ? (
                    <p className="text-sm text-white/35">{tr("Событий пока нет.", "No events yet.")}</p>
                  ) : (
                    <div className="space-y-3">
                      {data.activity.map((item) => (
                        <div key={item.id} className="flex items-start gap-3 text-sm">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-white/65">
                              {item.note || item.type}
                              {item.points > 0 && (
                                <span className="ml-2 text-[11px] text-emerald-300">+{item.points} XP</span>
                              )}
                            </p>
                            <p className="text-[10px] text-white/25">
                              {item.username ? `${item.username} · ` : ""}
                              {fmtDate(item.created_at, lang)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <h2 className="font-bold mb-4 inline-flex items-center gap-2">
                    <Crown size={16} className="text-amber-300" />
                    {tr("Как растёт клан", "How the clan grows")}
                  </h2>
                  <ul className="space-y-3 text-xs text-white/45 leading-relaxed">
                    <li>+{tr("ежедневная награда участника", "member daily reward")}: 5 XP</li>
                    <li>+{tr("одобренный отзыв", "approved review")}: 15 XP</li>
                    <li>+{tr("покупка в клиенте", "client purchase")}: 10 XP</li>
                    <li>
                      +{tr("игра в клиенте", "time in game")}: 2 XP{" "}
                      {tr("за 30 минут (до 20 XP в день)", "per 30 minutes (up to 20 XP/day)")}
                    </li>
                    <li>+{tr("взнос в казну", "treasury deposit")}: до 20 XP</li>
                    <li className="text-emerald-300/70">
                      +1 SC {tr("за каждые 10 минут игры (до 30 SC в день)", "per 10 minutes played (up to 30 SC/day)")}
                    </li>
                    <li className="text-white/60">
                      {tr(
                        "Бонус к SC: 3% с 3 участников, 6% с 6, 10% с 12, 15% с 20. Ещё до +5% за разнообразие ролей.",
                        "SC bonus: 3% from 3 members, 6% from 6, 10% from 12, 15% from 20. Up to +5% more for role diversity."
                      )}
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {activeTab === "members" && (
              <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <h2 className="font-bold mb-4 inline-flex items-center gap-2">
                  <UsersThree size={17} className="text-purple-300" />
                  {tr("Состав клана", "Clan members")} · {data.members.length}
                </h2>
                <div className="space-y-2">
                  {data.members.map((member) => {
                    const canManage = can("manage_roles") && member.user_id !== data.clan.leader_id && myWeight > roleWeight(member.role);
                    const canKick =
                      can("kick") &&
                      member.user_id !== data.clan.leader_id &&
                      member.user_id !== data.clan.leader_id &&
                      myWeight > roleWeight(member.role);
                    const canTransfer = can("transfer") && member.user_id !== data.clan.leader_id;
                    return (
                      <div
                        key={member.user_id}
                        className="rounded-2xl border border-white/5 bg-white/[0.02] px-3 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
                      >
                        <span
                          className="w-9 h-9 shrink-0 rounded-xl bg-white/5 border border-white/10 grid place-items-center text-xs font-bold"
                          style={{ borderColor: `${clanRoleColor(member.role)}55` }}
                        >
                          {member.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={member.avatar_url} alt="" className="w-full h-full object-cover rounded-xl" />
                          ) : (
                            member.username.slice(0, 2).toUpperCase()
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate inline-flex items-center gap-1.5">
                            {member.equipped_badge && (
                              <span className={isCosmicBadge(member.equipped_badge) ? "cosmic-badge" : undefined}>
                                {member.equipped_badge}
                              </span>
                            )}
                            <span
                              className={isRgbValue(member.nickname_color) ? "cosmic-rgb-text" : undefined}
                              style={
                                isRgbValue(member.nickname_color)
                                  ? undefined
                                  : { color: member.nickname_color || undefined }
                              }
                            >
                              {member.username}
                            </span>
                            {member.user_id === data.clan.leader_id && <Crown size={13} className="text-amber-300" />}
                          </p>
                          <p className="text-[11px] text-white/30">
                            {tr("в клане с", "joined")} {fmtDate(member.joined_at, lang)} · +
                            {member.contribution} ₽ · {member.weekly_points} XP/{tr("нед", "wk")}
                          </p>
                        </div>
                        <span
                          className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                          style={{
                            color: clanRoleColor(member.role),
                            borderColor: `${clanRoleColor(member.role)}44`,
                            background: `${clanRoleColor(member.role)}14`,
                          }}
                        >
                          {clanRoleLabel(member.role, lang)}
                        </span>

                        {canManage && (
                          <select
                            value={member.role}
                            onChange={(event) => setRole(member, event.target.value as ClanRole)}
                            className="shrink-0 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white/70 outline-none"
                          >
                            {roleOptions.map((role) => (
                              <option key={role} value={role}>
                                {clanRoleLabel(role, lang)}
                              </option>
                            ))}
                          </select>
                        )}

                        {canTransfer && (
                          <button
                            type="button"
                            onClick={() => transfer(member)}
                            className="shrink-0 rounded-lg border border-amber-400/25 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200 hover:bg-amber-500/20 transition"
                          >
                            {tr("Передать лидерство", "Make leader")}
                          </button>
                        )}

                        {canKick && (
                          <button
                            type="button"
                            onClick={() => kick(member)}
                            className="shrink-0 w-8 h-8 grid place-items-center rounded-lg border border-red-400/20 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition"
                            title={tr("Исключить", "Kick")}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "missions" && (
              <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <h2 className="font-bold inline-flex items-center gap-2">
                      <Trophy size={17} className="text-amber-300" />
                      {tr("Миссии недели", "Weekly missions")}
                    </h2>
                    <p className="text-xs text-white/35 mt-1">
                      {tr(
                        "Награда достаётся каждому участнику клана. Забрать может офицер и выше.",
                        "Every clan member gets the reward. Officers and above can claim it."
                      )}
                    </p>
                  </div>
                  <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.07] px-3 py-2 text-right">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-300/60">
                      {tr("Можно забрать", "Available")}
                    </p>
                    <p className="text-sm font-bold text-emerald-300">
                      +{data.missions?.claimable_reward ?? 0} SC
                    </p>
                  </div>
                </div>

                {!data.missions ? (
                  <p className="text-sm text-white/35">{tr("Миссии недоступны.", "Missions are unavailable.")}</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/35 mb-4">
                      <span>
                        {tr("Сброс", "Reset")}:{" "}
                        {fmtDate(data.missions.resets_at, lang)}
                      </span>
                      <span>
                        {tr("Участников", "Members")}: {data.missions.member_count}/{data.missions.min_members}
                      </span>
                      <span>
                        {tr("За неделю", "Per week")}: до {data.missions.week_reward} SC
                      </span>
                    </div>

                    {data.missions.member_count < data.missions.min_members && (
                      <p className="mb-4 rounded-xl border border-amber-400/20 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-200/80">
                        {tr(
                          `Для наград нужно минимум ${data.missions.min_members} участника.`,
                          `At least ${data.missions.min_members} members are required for rewards.`
                        )}
                      </p>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {data.missions.missions.map((mission) => {
                        const percent = Math.min(
                          100,
                          Math.round((mission.progress / mission.target) * 100)
                        );
                        return (
                          <div
                            key={mission.key}
                            className={`rounded-2xl border p-4 ${
                              mission.claimed
                                ? "border-emerald-400/20 bg-emerald-500/[0.04]"
                                : mission.claimable
                                  ? "border-purple-400/30 bg-purple-500/[0.06]"
                                  : "border-white/10 bg-white/[0.02]"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <span className="w-9 h-9 shrink-0 rounded-xl bg-white/[0.06] grid place-items-center text-lg">
                                {mission.icon}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold">
                                    {lang === "en" ? mission.title_en : mission.title_ru}
                                  </p>
                                  <span className="text-[11px] font-semibold text-amber-200">
                                    +{mission.reward} SC
                                  </span>
                                </div>
                                <p className="text-[11px] text-white/40 mt-0.5">
                                  {lang === "en" ? mission.desc_en : mission.desc_ru}
                                </p>

                                <div className="mt-2.5 flex items-center gap-2">
                                  <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        mission.claimed
                                          ? "bg-emerald-400"
                                          : mission.claimable
                                            ? "bg-purple-400"
                                            : "bg-white/30"
                                      }`}
                                      style={{ width: `${percent}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] tabular-nums text-white/40">
                                    {mission.progress}/{mission.target}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => claimMission(mission)}
                                  disabled={!mission.claimable || busy}
                                  className={`mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold transition ${
                                    mission.claimed
                                      ? "bg-emerald-500/10 text-emerald-300 cursor-default"
                                      : mission.claimable
                                        ? "bg-purple-600 text-white hover:bg-purple-500"
                                        : "bg-white/[0.05] text-white/30 cursor-not-allowed"
                                  }`}
                                >
                                  {mission.claimed
                                    ? tr("Получено", "Claimed")
                                    : mission.claimable
                                      ? tr("Забрать награду", "Claim reward")
                                      : !data.missions?.viewer_can_claim
                                        ? tr("Забирает офицер", "Claimed by an officer")
                                        : tr("В процессе", "In progress")}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === "requests" && (
              <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
                {can("review_applications") && (
                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                    <h2 className="font-bold mb-4 inline-flex items-center gap-2">
                      <UserPlus size={17} className="text-purple-300" />
                      {tr("Заявки", "Applications")} · {data.applications.length}
                    </h2>
                    {data.applications.length === 0 ? (
                      <p className="text-sm text-white/35">{tr("Новых заявок нет.", "No new applications.")}</p>
                    ) : (
                      <div className="space-y-3">
                        {data.applications.map((application) => (
                          <div key={application.id} className="rounded-2xl border border-white/5 bg-white/[0.02] p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium">{application.username}</p>
                              <span className="text-[10px] text-white/25">{fmtDate(application.created_at, lang)}</span>
                            </div>
                            {application.message && (
                              <p className="text-xs text-white/45 mt-1.5">{application.message}</p>
                            )}
                            <div className="mt-3 flex gap-2">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => review(application, "approve")}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold transition"
                              >
                                <Check size={13} />
                                {tr("Принять", "Accept")}
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => review(application, "reject")}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold transition"
                              >
                                <X size={13} />
                                {tr("Отклонить", "Reject")}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {can("invite") && (
                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                    <h2 className="font-bold mb-4 inline-flex items-center gap-2">
                      <UserPlus size={17} className="text-cyan-300" />
                      {tr("Приглашения", "Invites")}
                    </h2>
                    <form onSubmit={invite} className="flex gap-2">
                      <input
                        value={inviteName}
                        onChange={(event) => setInviteName(event.target.value.slice(0, 40))}
                        placeholder={tr("Ник игрока", "Player username")}
                        className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-purple-400/40"
                      />
                      <button
                        type="submit"
                        disabled={busy || !inviteName.trim()}
                        className="rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 px-4 py-2.5 text-sm font-semibold transition"
                      >
                        {tr("Позвать", "Invite")}
                      </button>
                    </form>

                    <div className="mt-4 space-y-2">
                      {data.invites.length === 0 ? (
                        <p className="text-sm text-white/35">{tr("Активных приглашений нет.", "No active invites.")}</p>
                      ) : (
                        data.invites.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5"
                          >
                            <div>
                              <p className="text-sm">{item.username}</p>
                              <p className="text-[10px] text-white/25">
                                {tr("до", "until")} {item.expires_at ? fmtDate(item.expires_at, lang) : "—"}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => cancelInvite(item.id)}
                              className="text-[11px] text-white/40 hover:text-red-300 transition"
                            >
                              {tr("Отменить", "Cancel")}
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "treasury" && (
              <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-1 rounded-3xl border border-amber-400/20 bg-amber-500/[0.06] p-5">
                  <p className="text-[10px] uppercase tracking-wider text-amber-200/60">{tr("Казна клана", "Clan treasury")}</p>
                  <p className="text-3xl font-extrabold text-amber-100 mt-1">{clan.treasury} ₽</p>
                  <p className="text-xs text-white/35 mt-2">
                    {tr(
                      "Взносы идут на нужды клана. Выводить средства могут лидер, соруководитель и казначей.",
                      "Deposits fund clan needs. Leader, co-leader and treasurer can withdraw."
                    )}
                  </p>

                  <div className="mt-5 space-y-2">
                    <input
                      value={money}
                      onChange={(event) => setMoney(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400/40"
                      placeholder="100"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => treasury("deposit")}
                      className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 px-4 py-2.5 text-sm font-semibold text-black transition"
                    >
                      {tr("Внести в казну", "Deposit")}
                    </button>
                    {can("treasury_withdraw") && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => treasury("withdraw")}
                        className="w-full rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-50 px-4 py-2.5 text-sm font-semibold transition"
                      >
                        {tr("Вывести на баланс", "Withdraw to balance")}
                      </button>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <h2 className="font-bold mb-4 inline-flex items-center gap-2">
                    <Coins size={17} className="text-amber-300" />
                    {tr("История казны", "Treasury history")}
                  </h2>
                  {data.transactions.length === 0 ? (
                    <p className="text-sm text-white/35">{tr("Операций пока нет.", "No transactions yet.")}</p>
                  ) : (
                    <div className="space-y-2">
                      {data.transactions.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-sm text-white/70 truncate">{item.note || item.type}</p>
                            <p className="text-[10px] text-white/25">
                              {item.username || "—"} · {fmtDate(item.created_at, lang)}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 text-sm font-semibold ${
                              item.amount > 0 ? "text-emerald-300" : "text-red-300"
                            }`}
                          >
                            {item.amount > 0 ? "+" : ""}
                            {item.amount} ₽
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "chat" && (
              <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                  <h2 className="font-bold inline-flex items-center gap-2">
                    <ChatCircleDots size={17} className="text-purple-300" />
                    {tr("Клановый чат", "Clan chat")}
                  </h2>
                  <span className="text-[10px] text-white/25">
                    {tr("обновляется автоматически", "auto-refreshes")}
                  </span>
                </div>
                <div ref={chatBoxRef} className="h-[420px] overflow-y-auto px-4 py-4 space-y-3">
                  {data.messages.length === 0 ? (
                    <p className="text-sm text-white/35 text-center py-10">
                      {tr("Сообщений пока нет. Начните разговор!", "No messages yet. Start the conversation!")}
                    </p>
                  ) : (
                    data.messages.map((message) => (
                      <div key={message.id} className="flex items-start gap-2.5">
                        <span className="w-8 h-8 shrink-0 rounded-lg bg-white/5 border border-white/10 grid place-items-center text-[10px] font-bold">
                          {message.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={message.avatar_url} alt="" className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            (message.username || "?").slice(0, 2).toUpperCase()
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[11px] text-white/35">
                            <span
                              className={isRgbValue(message.nickname_color) ? "cosmic-rgb-text" : undefined}
                              style={
                                isRgbValue(message.nickname_color)
                                  ? undefined
                                  : { color: message.nickname_color || "#c4b5fd" }
                              }
                            >
                              {message.username || "—"}
                            </span>
                            {" · "}
                            {fmtDate(message.created_at, lang)}
                          </p>
                          <p className="text-sm text-white/75 whitespace-pre-line break-words">{message.body}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <form onSubmit={sendMessage} className="border-t border-white/10 px-4 py-3 flex gap-2">
                  <input
                    value={chatText}
                    onChange={(event) => setChatText(event.target.value.slice(0, 500))}
                    placeholder={tr("Сообщение клану...", "Message the clan...")}
                    className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-purple-400/40"
                  />
                  <button
                    type="submit"
                    disabled={busy || !chatText.trim()}
                    className="inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 px-4 py-2.5 text-sm font-semibold transition"
                  >
                    <PaperPlaneTilt size={15} weight="fill" />
                    <span className="hidden sm:inline">{tr("Отправить", "Send")}</span>
                  </button>
                </form>
              </div>
            )}

            {activeTab === "settings" && (
              <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
                <form onSubmit={saveSettings} className="lg:col-span-2 rounded-3xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
                  <h2 className="font-bold inline-flex items-center gap-2">
                    <GearSix size={17} className="text-purple-300" />
                    {tr("Настройки клана", "Clan settings")}
                  </h2>
                  <label className="block text-xs text-white/50">
                    {tr("Описание", "Description")}
                    <textarea
                      value={settings.description}
                      onChange={(event) =>
                        setSettings({ ...settings, description: event.target.value.slice(0, 280) })
                      }
                      rows={4}
                      className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-purple-400/40"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="block text-xs text-white/50">
                      {tr("Эмблема", "Emblem")}
                      <input
                        value={settings.emblem}
                        onChange={(event) => setSettings({ ...settings, emblem: event.target.value.slice(0, 4) })}
                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-purple-400/40"
                      />
                    </label>
                    <label className="block text-xs text-white/50">
                      {tr("Цвет", "Color")}
                      <span className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                        <input
                          type="color"
                          value={settings.color}
                          onChange={(event) => setSettings({ ...settings, color: event.target.value })}
                          className="h-7 w-10 cursor-pointer rounded border-0 bg-transparent"
                        />
                        <span className="text-sm font-mono text-white/60">{settings.color}</span>
                      </span>
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-white/60">
                    <input
                      type="checkbox"
                      checked={settings.recruiting}
                      onChange={(event) => setSettings({ ...settings, recruiting: event.target.checked })}
                      className="accent-purple-500"
                    />
                    {tr("Открыт набор по заявкам", "Accepting applications")}
                  </label>
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 px-5 py-2.5 text-sm font-semibold transition"
                  >
                    <Check size={16} />
                    {tr("Сохранить", "Save")}
                  </button>
                </form>

                <div className="rounded-3xl border border-red-400/20 bg-red-500/[0.05] p-5">
                  <h2 className="font-bold inline-flex items-center gap-2 text-red-200">
                    <Trash size={17} />
                    {tr("Опасная зона", "Danger zone")}
                  </h2>
                  <p className="text-xs text-white/40 mt-2 leading-relaxed">
                    {tr(
                      "Распустить клан может только лидер. Участники, история и казна будут удалены.",
                      "Only the leader can disband the clan. Members, history and treasury will be removed."
                    )}
                  </p>
                  {can("disband") && (
                    <button
                      type="button"
                      onClick={disband}
                      disabled={busy}
                      className="mt-4 w-full rounded-xl border border-red-400/30 bg-red-500/15 hover:bg-red-500/25 text-red-200 px-4 py-2.5 text-sm font-semibold transition"
                    >
                      {tr("Распустить клан", "Disband clan")}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {showApply && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center px-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0712] p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold">
                {tr("Заявка в", "Apply to")} {clan.name}
              </h3>
              <button
                type="button"
                onClick={() => setShowApply(false)}
                className="w-8 h-8 grid place-items-center rounded-lg bg-white/5 hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>
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
              onClick={apply}
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
