"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useI18n } from "@/lib/i18n";
import {
  ArrowLeft,
  Check,
  CheckCircle,
  GameController,
  LinkSimple,
  MagnifyingGlass,
  UserPlus,
  UsersThree,
  WarningCircle,
  X,
} from "@phosphor-icons/react";

type Friend = {
  id: number;
  friend_id: number;
  username: string;
  avatar_url: string | null;
  nickname_color: string | null;
  online: boolean;
  in_game: boolean;
  since: string;
};

type Lists = {
  friends: Friend[];
  incoming: Friend[];
  outgoing: Friend[];
  limit: number;
};

export default function FriendsPage() {
  const { lang } = useI18n();
  const tr = (ru: string, en: string) => (lang === "en" ? en : ru);
  const router = useRouter();
  const [lists, setLists] = useState<Lists | null>(null);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/friends");
    const data = await res.json();
    if (res.ok && data.ok) setLists(data);
    else if (res.status === 401) router.replace("/login");
  }, [router]);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) router.replace("/login");
      });
    load().finally(() => setLoading(false));
  }, [load, router]);

  async function act(action: string, name: string) {
    setBusy(`${action}:${name}`);
    setNotice(null);
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, username: name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ ok: false, text: data.error || tr("Ошибка", "Error") });
        return;
      }
      const messages: Record<string, [string, string]> = {
        request: ["Заявка отправлена", "Request sent"],
        accept: ["Заявка принята", "Request accepted"],
        decline: ["Заявка отклонена", "Request declined"],
        remove: ["Пользователь удалён из друзей", "Friend removed"],
      };
      const message = messages[action] || ["Готово", "Done"];
      setNotice({ ok: true, text: data.accepted ? tr("Вы теперь друзья", "You are now friends") : tr(message[0], message[1]) });
      if (action === "request") setUsername("");
      await load();
    } catch {
      setNotice({ ok: false, text: tr("Ошибка сервера", "Server error") });
    } finally {
      setBusy(null);
    }
  }

  const onlineCount = lists?.friends.filter((friend) => friend.online).length ?? 0;

  function Avatar({ friend }: { friend: Friend }) {
    return (
      <div className="relative shrink-0">
        <div className="h-11 w-11 rounded-full overflow-hidden bg-white/10 border border-white/10 flex items-center justify-center">
          {friend.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={friend.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-white/60">
              {friend.username.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#0b0614] ${
            friend.in_game ? "bg-emerald-400" : friend.online ? "bg-cyan-400" : "bg-white/25"
          }`}
        />
      </div>
    );
  }

  function Row({ friend, actions }: { friend: Friend; actions: React.ReactNode }) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <Avatar friend={friend} />
        <div className="min-w-0 flex-1">
          <Link
            href={`/u/${encodeURIComponent(friend.username)}`}
            className="font-medium hover:text-purple-200 transition"
            style={friend.nickname_color ? { color: friend.nickname_color } : undefined}
          >
            {friend.username}
          </Link>
          <p className="text-[11px] text-white/40 flex items-center gap-1.5">
            {friend.in_game ? (
              <>
                <GameController size={13} className="text-emerald-300" />
                {tr("В игре", "In game")}
              </>
            ) : friend.online ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 inline-block" />
                {tr("Онлайн", "Online")}
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-white/25 inline-block" />
                {tr("Не в сети", "Offline")}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      </div>
    );
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
                  {tr("Социальное", "Social")}
                </p>
              </div>
              <h1 className="cosmic-rgb-text text-4xl md:text-5xl font-extrabold">
                {tr("Друзья", "Friends")}
              </h1>
              <p className="text-white/45 mt-2">
                {tr(
                  "Добавляйте игроков, следите за онлайном и статусом «в игре».",
                  "Add players and see who is online or in game."
                )}
              </p>
            </div>
            <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-5 py-4 min-w-[150px]">
              <p className="text-[11px] uppercase tracking-widest text-cyan-200/70">
                {tr("Онлайн", "Online")}
              </p>
              <p className="text-3xl font-bold text-cyan-200">
                {onlineCount}
                <span className="text-white/40 text-base"> / {lists?.friends.length ?? 0}</span>
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

          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (username.trim()) act("request", username.trim());
            }}
            className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex flex-col sm:flex-row gap-3"
          >
            <div className="relative flex-1">
              <MagnifyingGlass
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
              />
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder={tr("Никнейм игрока", "Player username")}
                maxLength={32}
                className="w-full rounded-xl border border-white/10 bg-black/20 pl-10 pr-3 py-2.5 text-sm outline-none focus:border-cyan-400/50"
              />
            </div>
            <button
              type="submit"
              disabled={!username.trim() || busy?.startsWith("request")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-5 py-2.5 text-sm font-semibold transition disabled:opacity-40"
            >
              <UserPlus size={16} /> {tr("Добавить", "Add friend")}
            </button>
          </form>

          {loading || !lists ? (
            <div className="py-24 text-center text-white/40">{tr("Загрузка...", "Loading...")}</div>
          ) : (
            <div className="space-y-8">
              {lists.incoming.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-3">
                    {tr("Входящие заявки", "Incoming requests")} · {lists.incoming.length}
                  </h2>
                  <div className="space-y-2">
                    {lists.incoming.map((friend) => (
                      <Row
                        key={friend.id}
                        friend={friend}
                        actions={
                          <>
                            <button
                              onClick={() => act("accept", friend.username)}
                              disabled={busy === `accept:${friend.username}`}
                              className="rounded-lg bg-emerald-600/80 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                            >
                              <Check size={14} className="inline" /> {tr("Принять", "Accept")}
                            </button>
                            <button
                              onClick={() => act("decline", friend.username)}
                              disabled={busy === `decline:${friend.username}`}
                              className="rounded-lg border border-white/15 hover:bg-white/10 px-3 py-1.5 text-xs transition disabled:opacity-50"
                            >
                              <X size={14} className="inline" />
                            </button>
                          </>
                        }
                      />
                    ))}
                  </div>
                </section>
              )}

              {lists.outgoing.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-3">
                    {tr("Отправленные заявки", "Outgoing requests")} · {lists.outgoing.length}
                  </h2>
                  <div className="space-y-2">
                    {lists.outgoing.map((friend) => (
                      <Row
                        key={friend.id}
                        friend={friend}
                        actions={
                          <button
                            onClick={() => act("decline", friend.username)}
                            disabled={busy === `decline:${friend.username}`}
                            className="rounded-lg border border-white/15 hover:bg-white/10 px-3 py-1.5 text-xs transition disabled:opacity-50"
                          >
                            {tr("Отменить", "Cancel")}
                          </button>
                        }
                      />
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-3">
                  {tr("Мои друзья", "My friends")} · {lists.friends.length} / {lists.limit}
                </h2>
                {lists.friends.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/15 px-6 py-12 text-center text-white/40 text-sm">
                    {tr(
                      "Пока нет друзей. Добавьте игрока по никнейму выше.",
                      "No friends yet. Add a player by username above."
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lists.friends.map((friend) => (
                      <Row
                        key={friend.id}
                        friend={friend}
                        actions={
                          <button
                            onClick={() => act("remove", friend.username)}
                            disabled={busy === `remove:${friend.username}`}
                            className="rounded-lg border border-white/15 hover:border-red-400/40 hover:bg-red-500/10 px-3 py-1.5 text-xs text-white/60 transition disabled:opacity-50"
                          >
                            {tr("Удалить", "Remove")}
                          </button>
                        }
                      />
                    ))}
                  </div>
                )}
              </section>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-xs text-white/45 flex items-start gap-2">
                <LinkSimple size={16} className="text-cyan-300 shrink-0 mt-0.5" />
                <p>
                  {tr(
                    "Статус «в игре» появляется, когда клиент запущен. Друзья могут быстро перейти в профиль и отправить подарок.",
                    "The “in game” status appears while the client is running. Friends can quickly open a profile and send a gift."
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
