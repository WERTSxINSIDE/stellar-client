"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useI18n } from "@/lib/i18n";
import {
  ArrowLeft,
  Check,
  CheckCircle,
  Crown,
  Crosshair,
  MapPin,
  Plus,
  SignOut,
  UserPlus,
  UsersThree,
  WarningCircle,
  X,
} from "@phosphor-icons/react";

type Member = {
  user_id: number;
  username: string;
  avatar_url: string | null;
  nickname_color: string | null;
  online: boolean;
  in_game: boolean;
  joined_at: string;
  is_leader: boolean;
  is_self: boolean;
};

type Party = {
  id: number;
  leader_id: number;
  created_at: string;
  members: Member[];
};

type Invite = {
  id: number;
  party_id: number;
  from_username: string;
  from_avatar: string | null;
  member_count: number;
  created_at: string;
};

type PartyState = {
  party: Party | null;
  invites: Invite[];
  max_members: number;
  position_ttl_seconds?: number;
};

type Position = {
  user_id: number;
  username: string;
  server: string | null;
  dimension: string | null;
  x: number;
  y: number;
  z: number;
  yaw: number | null;
  health: number | null;
  age_ms: number;
};

type Friend = { username: string };

export default function PartyPage() {
  const { lang } = useI18n();
  const tr = (ru: string, en: string) => (lang === "en" ? en : ru);
  const router = useRouter();
  const [state, setState] = useState<PartyState | null>(null);
  const [positions, setPositions] = useState<Record<number, Position>>({});
  const [friends, setFriends] = useState<Friend[]>([]);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/party");
    const data = await res.json();
    if (res.ok && data.ok) setState(data);
    else if (res.status === 401) router.replace("/login");
  }, [router]);

  const loadPositions = useCallback(async () => {
    const res = await fetch("/api/party/positions");
    if (!res.ok) return;
    const data = await res.json();
    if (data.ok) {
      const map: Record<number, Position> = {};
      for (const item of data.positions as Position[]) map[item.user_id] = item;
      setPositions(map);
    }
  }, []);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) router.replace("/login");
      });
    fetch("/api/friends")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setFriends(d.friends || []);
      })
      .catch(() => {});
    load().finally(() => setLoading(false));
  }, [load, router]);

  useEffect(() => {
    const partyTimer = setInterval(load, 5000);
    return () => clearInterval(partyTimer);
  }, [load]);

  useEffect(() => {
    if (!state?.party) {
      setPositions({});
      return;
    }
    loadPositions();
    const timer = setInterval(loadPositions, 2000);
    return () => clearInterval(timer);
  }, [state?.party, loadPositions]);

  async function act(payload: Record<string, unknown>, key: string) {
    setBusy(key);
    setNotice(null);
    try {
      const res = await fetch("/api/party", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ ok: false, text: data.error || tr("Ошибка", "Error") });
        return;
      }
      setState(data);
      const labels: Record<string, [string, string]> = {
        create: ["Пати создано", "Party created"],
        invite: ["Приглашение отправлено", "Invitation sent"],
        accept: ["Вы вступили в пати", "You joined the party"],
        decline: ["Приглашение отклонено", "Invitation declined"],
        leave: ["Вы покинули пати", "You left the party"],
        kick: ["Игрок исключён", "Player kicked"],
        disband: ["Пати распущено", "Party disbanded"],
      };
      const label = labels[String(payload.action)] || ["Готово", "Done"];
      setNotice({ ok: true, text: tr(label[0], label[1]) });
      if (payload.action === "invite") setUsername("");
    } catch {
      setNotice({ ok: false, text: tr("Ошибка сервера", "Server error") });
    } finally {
      setBusy(null);
    }
  }

  const party = state?.party || null;
  const isLeader = Boolean(party?.members.find((member) => member.is_self)?.is_leader);
  const ownPosition = party?.members.find((member) => member.is_self)
    ? positions[party.members.find((member) => member.is_self)!.user_id]
    : undefined;

  const friendOptions = useMemo(
    () =>
      friends
        .filter((friend) => !party?.members.some((member) => member.username === friend.username))
        .slice(0, 100),
    [friends, party]
  );

  function positionStatus(position: Position | undefined) {
    if (!position) {
      return {
        tone: "text-white/30",
        label: tr("нет данных", "no data"),
      };
    }
    if (!ownPosition) {
      return {
        tone: "text-emerald-300",
        label: tr("свежие координаты", "fresh coordinates"),
      };
    }
    if (position.server !== ownPosition.server) {
      return { tone: "text-amber-300", label: tr("другой сервер", "another server") };
    }
    if (position.dimension !== ownPosition.dimension) {
      return { tone: "text-amber-300", label: tr("другое измерение", "another dimension") };
    }
    return { tone: "text-emerald-300", label: tr("рядом", "nearby") };
  }

  return (
    <>
      <Header />
      <main className="relative min-h-screen text-white">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_55%)]" />
        <div className="max-w-4xl mx-auto px-6 pt-36 pb-24">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-white/50 hover:text-white transition text-sm mb-8"
          >
            <ArrowLeft size={16} weight="bold" /> {tr("В кабинет", "Back to dashboard")}
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <UsersThree size={28} weight="fill" className="text-cyan-300" />
                <p className="text-white/40 text-xs tracking-widest uppercase">
                  {tr("Группа", "Group")}
                </p>
              </div>
              <h1 className="cosmic-rgb-text text-4xl md:text-5xl font-extrabold">
                {tr("Пати и метки", "Party and markers")}
              </h1>
              <p className="text-white/45 mt-2 max-w-2xl">
                {tr(
                  "Соберите друзей в группу. Клиент синхронизирует координаты, чтобы вы видели метки друг друга на одном сервере и измерении.",
                  "Gather friends into a group. The client syncs coordinates so you can see each other’s markers on the same server and dimension."
                )}
              </p>
            </div>
            <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-5 py-4 min-w-[140px]">
              <p className="text-[11px] uppercase tracking-widest text-cyan-200/70">
                {tr("Участники", "Members")}
              </p>
              <p className="text-3xl font-bold text-cyan-200">
                {party ? party.members.length : 0}
                <span className="text-white/40 text-base"> / {state?.max_members ?? 8}</span>
              </p>
            </div>
          </div>

          {notice && (
            <div
              className={`mb-5 rounded-2xl border px-4 py-3 text-sm flex items-center gap-2 ${
                notice.ok
                  ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                  : "border-red-400/30 bg-red-500/10 text-red-200"
              }`}
            >
              {notice.ok ? <CheckCircle size={17} /> : <WarningCircle size={17} />}
              {notice.text}
            </div>
          )}

          {loading || !state ? (
            <div className="py-24 text-center text-white/40">{tr("Загрузка...", "Loading...")}</div>
          ) : !party ? (
            <div className="space-y-6">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
                <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-cyan-500/15 text-cyan-200 flex items-center justify-center">
                  <UsersThree size={26} />
                </div>
                <h2 className="text-xl font-bold mb-1">{tr("Вы пока не в пати", "You are not in a party yet")}</h2>
                <p className="text-sm text-white/45 mb-5">
                  {tr(
                    "Создайте группу и пригласите друзей. Максимум 8 человек.",
                    "Create a group and invite your friends. Up to 8 players."
                  )}
                </p>
                <button
                  onClick={() => act({ action: "create" }, "create")}
                  disabled={busy === "create"}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-5 py-2.5 text-sm font-semibold transition disabled:opacity-50"
                >
                  <Plus size={16} weight="bold" />
                  {busy === "create" ? tr("Создаём...", "Creating...") : tr("Создать пати", "Create party")}
                </button>
              </div>

              <section>
                <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-3">
                  {tr("Приглашения", "Invitations")} · {state.invites.length}
                </h2>
                {state.invites.length === 0 ? (
                  <p className="text-sm text-white/30">{tr("Новых приглашений нет.", "No new invitations.")}</p>
                ) : (
                  <div className="space-y-2">
                    {state.invites.map((invite) => (
                      <div
                        key={invite.id}
                        className="flex items-center gap-3 rounded-xl border border-cyan-400/20 bg-cyan-500/[0.06] px-4 py-3"
                      >
                        <div className="h-10 w-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center overflow-hidden">
                          {invite.from_avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={invite.from_avatar} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-xs font-bold text-white/60">
                              {invite.from_username.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{invite.from_username}</p>
                          <p className="text-[11px] text-white/35">
                            {tr("участников", "members")}: {invite.member_count} / {state.max_members}
                          </p>
                        </div>
                        <button
                          onClick={() => act({ action: "accept", invite_id: invite.id }, `accept:${invite.id}`)}
                          disabled={busy === `accept:${invite.id}`}
                          className="rounded-lg bg-emerald-600/80 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                        >
                          <Check size={14} className="inline" /> {tr("Принять", "Accept")}
                        </button>
                        <button
                          onClick={() => act({ action: "decline", invite_id: invite.id }, `decline:${invite.id}`)}
                          disabled={busy === `decline:${invite.id}`}
                          className="rounded-lg border border-white/15 hover:bg-white/10 px-3 py-1.5 text-xs transition disabled:opacity-50"
                        >
                          <X size={14} className="inline" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-white/10">
                  <div>
                    <p className="text-[11px] uppercase tracking-widest text-white/35">
                      {tr("Пати", "Party")} #{party.id}
                    </p>
                    <p className="text-sm text-white/60">
                      {tr("Лидер", "Leader")}:{" "}
                      <span className="text-white font-medium">
                        {party.members.find((member) => member.is_leader)?.username || "—"}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => act({ action: "leave" }, "leave")}
                      disabled={busy === "leave"}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 hover:bg-white/10 px-3 py-1.5 text-xs transition disabled:opacity-50"
                    >
                      <SignOut size={14} /> {tr("Покинуть", "Leave")}
                    </button>
                    {isLeader && (
                      <button
                        onClick={() => act({ action: "disband" }, "disband")}
                        disabled={busy === "disband"}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 text-xs text-red-200 transition disabled:opacity-50"
                      >
                        {tr("Распустить", "Disband")}
                      </button>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-white/[0.06]">
                  {party.members.map((member) => {
                    const position = positions[member.user_id];
                    const status = positionStatus(position);
                    return (
                      <div key={member.user_id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                        <div className="relative shrink-0">
                          <div className="h-10 w-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center overflow-hidden">
                            {member.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={member.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-xs font-bold text-white/60">
                                {member.username.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0b0614] ${
                              member.in_game ? "bg-emerald-400" : member.online ? "bg-cyan-400" : "bg-white/25"
                            }`}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium flex items-center gap-1.5">
                            <Link
                              href={`/u/${encodeURIComponent(member.username)}`}
                              className="hover:underline"
                              style={member.nickname_color ? { color: member.nickname_color } : undefined}
                            >
                              {member.username}
                            </Link>
                            {member.is_leader && <Crown size={13} className="text-amber-300" />}
                            {member.is_self && (
                              <span className="text-[10px] uppercase tracking-widest text-white/30">
                                {tr("вы", "you")}
                              </span>
                            )}
                          </p>
                          <p className={`text-[11px] ${status.tone}`}>
                            {member.in_game
                              ? tr("В игре", "In game")
                              : member.online
                                ? tr("Онлайн", "Online")
                                : tr("Не в сети", "Offline")}
                            {" · "}
                            {status.label}
                          </p>
                        </div>

                        {position ? (
                          <div className="text-right text-[11px] leading-5">
                            <p className="text-white/55 inline-flex items-center gap-1">
                              <MapPin size={12} /> {position.server || tr("сервер", "server")}
                            </p>
                            <p className="text-white/35 font-mono">
                              {position.x.toFixed(1)} / {position.y.toFixed(1)} / {position.z.toFixed(1)}
                            </p>
                            <p className="text-white/25">
                              {position.dimension || "—"} · {Math.max(1, Math.round(position.age_ms / 1000))}s
                            </p>
                          </div>
                        ) : (
                          <span className="text-[11px] text-white/25 inline-flex items-center gap-1">
                            <Crosshair size={12} /> {tr("ждём клиент", "waiting for client")}
                          </span>
                        )}

                        {isLeader && !member.is_self && (
                          <button
                            onClick={() => act({ action: "kick", user_id: member.user_id }, `kick:${member.user_id}`)}
                            disabled={busy === `kick:${member.user_id}`}
                            className="rounded-lg border border-white/15 hover:border-red-400/40 hover:bg-red-500/10 px-3 py-1.5 text-xs text-white/60 transition disabled:opacity-50"
                          >
                            {tr("Исключить", "Kick")}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {isLeader && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (username.trim()) act({ action: "invite", username: username.trim() }, "invite");
                  }}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex flex-col sm:flex-row gap-3"
                >
                  <div className="flex-1">
                    <input
                      list="party-friends"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder={tr("Никнейм друга", "Friend username")}
                      maxLength={32}
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-cyan-400/50"
                    />
                    <datalist id="party-friends">
                      {friendOptions.map((friend) => (
                        <option key={friend.username} value={friend.username} />
                      ))}
                    </datalist>
                    <p className="mt-1.5 text-[11px] text-white/30">
                      {tr(
                        "Приглашать можно только друзей. Максимум 8 участников.",
                        "You can invite friends only. Up to 8 members."
                      )}
                    </p>
                  </div>
                  <button
                    type="submit"
                    disabled={!username.trim() || busy === "invite"}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-5 py-2.5 text-sm font-semibold transition disabled:opacity-40 sm:self-start"
                  >
                    <UserPlus size={16} /> {tr("Пригласить", "Invite")}
                  </button>
                </form>
              )}

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-xs text-white/45 flex items-start gap-2">
                <Crosshair size={16} className="text-cyan-300 shrink-0 mt-0.5" />
                <p>
                  {tr(
                    "Координаты видны только участникам пати и живут 10 секунд. Метки в клиенте показываются, когда сервер и измерение совпадают; иначе участник отображается как «другой сервер».",
                    "Coordinates are visible only to party members and expire after 10 seconds. In-client markers appear when the server and dimension match; otherwise the member is shown as “another server”."
                  )}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
