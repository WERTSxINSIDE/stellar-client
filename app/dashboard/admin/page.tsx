"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
  import {
  ArrowLeft,
  Key,
  Fingerprint,
  Users,
  Copy,
  Check,
  ShieldCheck,
  Trash,
  Prohibit,
  WarningCircle,
  Minus,
  Plus,
  User,
  Coin,
} from "@phosphor-icons/react";

type Me = {
  id: number;
  username: string;
  email: string;
  is_admin: number;
} | null;

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<Me>(null);
  const [loading, setLoading] = useState(true);

  // Генерация ключей подписки
  const [subDays, setSubDays] = useState(30);
  const [subCount, setSubCount] = useState(1);
  const [subKeys, setSubKeys] = useState<string[]>([]);
  const [subMsg, setSubMsg] = useState("");
  const [subLoading, setSubLoading] = useState(false);

  // Генерация ключей сброса HWID
  const [hwidCount, setHwidCount] = useState(1);
  const [hwidKeys, setHwidKeys] = useState<string[]>([]);
  const [hwidMsg, setHwidMsg] = useState("");
  const [hwidLoading, setHwidLoading] = useState(false);

  // Все ключи
  const [allKeys, setAllKeys] = useState<any[]>([]);
  const [keysTab, setKeysTab] = useState<"generate" | "list" | "users" | "news" | "media">("generate");

  // Пользователи
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // Медиа заявки
  const [mediaSubmissions, setMediaSubmissions] = useState<any[]>([]);
  const [mediaReward, setMediaReward] = useState<number>(10);
  const [mediaNote, setMediaNote] = useState<string>("");

  // Новости
  const [allNews, setAllNews] = useState<any[]>([]);
  const [newsTitle, setNewsTitle] = useState("");
  const [newsContent, setNewsContent] = useState("");
  const [newsTag, setNewsTag] = useState("Обновление");
  const [newsMsg, setNewsMsg] = useState("");
  const [newsLoading, setNewsLoading] = useState(false);

  const adminToken = "euphoria-admin-2024";

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.user) {
          router.replace("/login");
          return;
        }
        if (!data.user.is_admin) {
          router.replace("/dashboard");
          return;
        }
        setUser(data.user);
        setLoading(false);
      });
  }, [router]);

  async function loadKeys() {
    try {
      const res = await fetch("/api/admin-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_token: adminToken }),
      });
      const data = await res.json();
      if (data.keys) setAllKeys(data.keys);
    } catch {}
  }

  async function loadMedia() {
    try {
      const res = await fetch("/api/media-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_token: adminToken, action: "list" }),
      });
      const data = await res.json();
      if (data.submissions) setMediaSubmissions(data.submissions);
    } catch {}
  }

  async function approveMedia(id: number) {
    try {
      await fetch("/api/media-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_token: adminToken, action: "approve", submission_id: id, reward: mediaReward, admin_note: mediaNote || undefined }),
      });
      loadMedia();
      loadUsers();
    } catch {}
  }

  async function rejectMedia(id: number) {
    try {
      await fetch("/api/media-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_token: adminToken, action: "reject", submission_id: id, admin_note: mediaNote || undefined }),
      });
      loadMedia();
    } catch {}
  }

  useEffect(() => {
    if (user) {
      loadKeys();
      loadUsers();
      loadNews();
      loadMedia();
    }
  }, [user]);

  async function loadNews() {
    try {
      const res = await fetch("/api/news");
      const data = await res.json();
      setAllNews(data.news || []);
    } catch {}
  }

  async function createNews() {
    if (!newsTitle.trim() || !newsContent.trim()) return;
    setNewsMsg("");
    setNewsLoading(true);
    try {
      const res = await fetch("/api/admin-news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_token: adminToken,
          action: "create",
          title: newsTitle,
          content: newsContent,
          tag: newsTag,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNewsMsg(data.error || "Ошибка");
        return;
      }
      setNewsMsg("Новость создана ✓");
      setNewsTitle("");
      setNewsContent("");
      setNewsTag("Обновление");
      loadNews();
    } catch {
      setNewsMsg("Ошибка сервера");
    } finally {
      setNewsLoading(false);
    }
  }

  async function deleteNews(id: number) {
    if (!confirm("Удалить новость?")) return;
    try {
      const res = await fetch("/api/admin-news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_token: adminToken,
          action: "delete",
          id,
        }),
      });
      const data = await res.json();
      if (data.ok) loadNews();
    } catch {}
  }

  async function loadUsers() {
    try {
      const res = await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_token: adminToken, action: "list" }),
      });
      const data = await res.json();
      if (data.users) setAllUsers(data.users);
    } catch {}
  }

  async function setRole(userId: number, role: string) {
    try {
      await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_token: adminToken,
          action: "set-role",
          user_id: userId,
          role,
        }),
      });
      loadUsers();
    } catch {}
  }

  async function deleteUser(userId: number) {
    if (!confirm("Удалить пользователя?")) return;
    try {
      await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_token: adminToken,
          action: "delete",
          user_id: userId,
        }),
      });
      loadUsers();
    } catch {}
  }

  async function banUser(userId: number) {
    const reason = prompt("Причина бана (необязательно):");
    if (reason === null) return;
    try {
      await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_token: adminToken,
          action: "ban",
          user_id: userId,
          ban_reason: reason || undefined,
        }),
      });
      loadUsers();
    } catch {}
  }

  async function unbanUser(userId: number) {
    try {
      await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_token: adminToken,
          action: "unban",
          user_id: userId,
        }),
      });
      loadUsers();
    } catch {}
  }

  async function reduceSubscription(userId: number) {
    const days = prompt("Сколько дней убрать?");
    if (!days || isNaN(Number(days)) || Number(days) < 1) return;
    try {
      const res = await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_token: adminToken,
          action: "reduce-subscription",
          user_id: userId,
          days: Number(days),
        }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Ошибка");
      loadUsers();
    } catch {}
  }

  async function addSubscription(userId: number) {
    const days = prompt("Сколько дней добавить?");
    if (!days || isNaN(Number(days)) || Number(days) < 1) return;
    try {
      const res = await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_token: adminToken,
          action: "add-subscription",
          user_id: userId,
          days: Number(days),
        }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Ошибка");
      loadUsers();
    } catch {}
  }

  async function addBalance(userId: number) {
    const amount = prompt("Сумма начисления (можно отрицательную для списания):");
    if (!amount || isNaN(Number(amount)) || Number(amount) === 0) return;
    try {
      const res = await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_token: adminToken,
          action: "add-balance",
          user_id: userId,
          days: Number(amount),
        }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Ошибка");
      loadUsers();
    } catch {}
  }

  async function changePassword(userId: number) {
    const pw = prompt("Новый пароль (минимум 6 символов):");
    if (!pw || pw.length < 6) return;
    try {
      const res = await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_token: adminToken,
          action: "change-password",
          user_id: userId,
          new_password: pw,
        }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Ошибка");
      else alert("Пароль изменён ✓");
    } catch {}
  }

  async function changeUsername(userId: number) {
    const nick = prompt("Новый ник:");
    if (!nick || nick.length < 2) return;
    try {
      const res = await fetch("/api/admin-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_token: adminToken,
          action: "change-username",
          user_id: userId,
          new_username: nick,
        }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Ошибка");
      else {
        alert("Ник изменён ✓");
        loadUsers();
      }
    } catch {}
  }

  async function deleteKey(keyId: number) {
    if (!confirm("Удалить ключ?")) return;
    try {
      const res = await fetch("/api/admin-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_token: adminToken,
          action: "delete",
          key_id: keyId,
        }),
      });
      const data = await res.json();
      if (data.ok) loadKeys();
    } catch {}
  }

  async function generateSubKeys() {
    setSubMsg("");
    setSubLoading(true);
    try {
      const res = await fetch("/api/generate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_token: adminToken,
          duration_days: subDays,
          count: subCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubMsg(data.error || "Ошибка");
        return;
      }
      setSubKeys(data.keys);
      setSubMsg(`Создано ${data.keys.length} ключей ✓`);
      loadKeys();
    } catch {
      setSubMsg("Ошибка сервера");
    } finally {
      setSubLoading(false);
    }
  }

  async function generateHwidKeys() {
    setHwidMsg("");
    setHwidLoading(true);
    try {
      const res = await fetch("/api/generate-hwid-reset-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_token: adminToken,
          count: hwidCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setHwidMsg(data.error || "Ошибка");
        return;
      }
      setHwidKeys(data.keys);
      setHwidMsg(`Создано ${data.keys.length} ключей ✓`);
      loadKeys();
    } catch {
      setHwidMsg("Ошибка сервера");
    } finally {
      setHwidLoading(false);
    }
  }

  function copyAll(keys: string[]) {
    navigator.clipboard.writeText(keys.join("\n"));
  }

  if (loading) return null;

  return (
    <>
      <Header />
      <main className="relative min-h-screen text-white overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-40 pointer-events-none">
          <Image src="/fluid2.png" alt="" fill className="object-cover" priority />
        </div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/60 via-black/70 to-black pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 pt-36 pb-24">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-white/50 hover:text-white transition text-sm mb-8"
          >
            <ArrowLeft size={16} weight="bold" />В кабинет
          </Link>

          <p className="text-white/40 text-xs tracking-widest uppercase mb-2">
            Управление
          </p>
          <h1 className="text-5xl font-extrabold mb-12">
            <span className="bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
              Админ панель
            </span>
          </h1>

          {/* Переключатель */}
          <div className="flex gap-2 p-1.5 rounded-2xl bg-white/[0.04] border border-white/10 mb-8 max-w-lg">
            <button
              onClick={() => setKeysTab("generate")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                keysTab === "generate"
                  ? "bg-purple-600/80 text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Генерация ключей
            </button>
            <button
              onClick={() => setKeysTab("list")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                keysTab === "list"
                  ? "bg-purple-600/80 text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Все ключи
            </button>
            <button
              onClick={() => setKeysTab("users")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                keysTab === "users"
                  ? "bg-purple-600/80 text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Пользователи
            </button>
            <button
              onClick={() => setKeysTab("news")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                keysTab === "news"
                  ? "bg-purple-600/80 text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Новости
            </button>
            <button
              onClick={() => setKeysTab("media")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${
                keysTab === "media"
                  ? "bg-purple-600/80 text-white"
                  : "text-white/60 hover:text-white"
              }`}
            >
              Медиа
            </button>
          </div>

          {keysTab === "generate" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Ключи подписки */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7">
                <div className="flex items-center gap-2 mb-1">
                  <Key size={22} className="text-white/70" />
                  <h2 className="text-2xl font-bold">Ключи подписки</h2>
                </div>
                <p className="text-white/40 mb-5">Генерация ключей для активации подписки.</p>

                <div className="flex gap-3 mb-4">
                  <div className="flex-1">
                    <label className="text-white/40 text-xs mb-1 block">Дней</label>
                    <select
                      value={subDays}
                      onChange={(e) => setSubDays(Number(e.target.value))}
                      className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
                    >
                      <option value={1}>1 день</option>
                      <option value={3}>3 дня</option>
                      <option value={7}>7 дней</option>
                      <option value={30}>30 дней</option>
                      <option value={90}>90 дней</option>
                      <option value={180}>180 дней</option>
                      <option value={9999}>Навсегда</option>
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="text-white/40 text-xs mb-1 block">Кол-во</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={subCount}
                      onChange={(e) => setSubCount(Number(e.target.value))}
                      className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
                    />
                  </div>
                </div>

                {subMsg && (
                  <p className={`text-sm mb-3 ${subMsg.includes("✓") ? "text-green-400" : "text-red-400"}`}>
                    {subMsg}
                  </p>
                )}

                {subKeys.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white/40 text-xs">Ключи:</span>
                      <button
                        onClick={() => copyAll(subKeys)}
                        className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
                      >
                        <Copy size={12} /> Копировать все
                      </button>
                    </div>
                    <div className="bg-black/40 rounded-xl p-3 max-h-40 overflow-y-auto font-mono text-sm text-white/80 whitespace-pre">{subKeys.join("\n")}</div>
                  </div>
                )}

                <button
                  onClick={generateSubKeys}
                  disabled={subLoading}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold transition bg-purple-600 hover:bg-purple-700 disabled:opacity-60"
                >
                  <Key size={18} weight="bold" />
                  {subLoading ? "Генерация..." : "Сгенерировать"}
                </button>
              </div>

              {/* Ключи сброса HWID */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7">
                <div className="flex items-center gap-2 mb-1">
                  <Fingerprint size={22} className="text-white/70" />
                  <h2 className="text-2xl font-bold">Ключи сброса HWID</h2>
                </div>
                <p className="text-white/40 mb-5">Генерация ключей для сброса привязки железа (150 ₽).</p>

                <div className="mb-4">
                  <label className="text-white/40 text-xs mb-1 block">Кол-во</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={hwidCount}
                    onChange={(e) => setHwidCount(Number(e.target.value))}
                    className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
                  />
                </div>

                {hwidMsg && (
                  <p className={`text-sm mb-3 ${hwidMsg.includes("✓") ? "text-green-400" : "text-red-400"}`}>
                    {hwidMsg}
                  </p>
                )}

                {hwidKeys.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white/40 text-xs">Ключи:</span>
                      <button
                        onClick={() => copyAll(hwidKeys)}
                        className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
                      >
                        <Copy size={12} /> Копировать все
                      </button>
                    </div>
                    <div className="bg-black/40 rounded-xl p-3 max-h-40 overflow-y-auto font-mono text-sm text-white/80 whitespace-pre">{hwidKeys.join("\n")}</div>
                  </div>
                )}

                <button
                  onClick={generateHwidKeys}
                  disabled={hwidLoading}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold transition bg-purple-600 hover:bg-purple-700 disabled:opacity-60"
                >
                  <Fingerprint size={18} weight="bold" />
                  {hwidLoading ? "Генерация..." : "Сгенерировать"}
                </button>
              </div>
            </div>
          )}

          {keysTab === "list" && (
            /* Список всех ключей */
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Users size={22} className="text-white/70" />
                  <h2 className="text-2xl font-bold">Все ключи ({allKeys.length})</h2>
                </div>
                <button
                  onClick={loadKeys}
                  className="text-sm text-purple-400 hover:text-purple-300"
                >
                  Обновить
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-white/40 border-b border-white/10">
                      <th className="text-left py-3 px-2">Ключ</th>
                      <th className="text-left py-3 px-2">Тип</th>
                      <th className="text-left py-3 px-2">Дней</th>
                      <th className="text-left py-3 px-2">Статус</th>
                       <th className="text-left py-3 px-2">Создан</th>
                      <th className="text-left py-3 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {allKeys.map((k: any) => (
                      <tr key={k.id} className="border-b border-white/5">
                        <td className="py-3 px-2 font-mono text-white/80">{k.key}</td>
                        <td className="py-3 px-2">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            k.duration_days === 0
                              ? "bg-orange-500/20 text-orange-300"
                              : "bg-purple-500/20 text-purple-300"
                          }`}>
                            {k.duration_days === 0 ? "HWID Reset" : "Подписка"}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-white/60">{k.duration_days === 0 ? "—" : k.duration_days}</td>
                        <td className="py-3 px-2">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            k.activated_by
                              ? "bg-red-500/20 text-red-300"
                              : "bg-green-500/20 text-green-300"
                          }`}>
                            {k.activated_by ? `Использован (UID ${k.activated_by})` : "Активен"}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-white/40">{k.created_at}</td>
                        <td className="py-3 px-2">
                          <button
                            onClick={() => deleteKey(k.id)}
                            className="text-red-400 hover:text-red-300 transition"
                            title="Удалить"
                          >
                            <Trash size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {allKeys.length === 0 && (
                  <p className="text-white/30 text-center py-8">Нет ключей</p>
                )}
              </div>
            </div>
          )}

          {keysTab === "users" && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={22} className="text-white/70" />
                  <h2 className="text-2xl font-bold">Пользователи ({allUsers.length})</h2>
                </div>
                <button
                  onClick={loadUsers}
                  className="text-sm text-purple-400 hover:text-purple-300"
                >
                  Обновить
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[1200px]">
                  <thead>
                    <tr className="text-white/40 border-b border-white/10">
                      <th className="text-left py-3 px-2">UID</th>
                      <th className="text-left py-3 px-2">Имя</th>
                      <th className="text-left py-3 px-2">Email</th>
                      <th className="text-left py-3 px-2">Роль</th>
                      <th className="text-left py-3 px-2">Подписка</th>
                      <th className="text-left py-3 px-2">Баланс</th>
                      <th className="text-left py-3 px-2">HWID</th>
                      <th className="text-left py-3 px-2">Статус</th>
                      <th className="text-left py-3 px-2">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.map((u: any) => (
                      <tr key={u.id} className="border-b border-white/5">
                        <td className="py-3 px-2 text-white/60">{u.id}</td>
                        <td className="py-3 px-2 font-semibold text-white/90">{u.username}</td>
                        <td className="py-3 px-2 text-white/60">{u.email}</td>
                        <td className="py-3 px-2">
                          <select
                            value={u.role || "user"}
                            onChange={(e) => setRole(u.id, e.target.value)}
                            className="bg-black/40 px-2 py-1 rounded-lg border border-white/10 text-xs focus:border-purple-500 outline-none"
                          >
                            <option value="user">User</option>
                            <option value="media">Media</option>
                            <option value="tester">Tester</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="py-3 px-2 text-white/60">
                          {u.subscription_end
                            ? new Date(u.subscription_end.replace(" ", "T")) > new Date()
                              ? u.subscription_end
                              : "Истекла"
                            : "Нет"}
                        </td>
                        <td className="py-3 px-2 text-white/60">{u.balance ?? 0} ₽</td>
                        <td className="py-3 px-2 text-white/40 font-mono text-xs max-w-[120px] truncate">
                          {u.hwid || "—"}
                        </td>
                        <td className="py-3 px-2">
                          {u.banned ? (
                            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-300" title={u.ban_reason || ""}>
                              <Prohibit size={12} />
                              Забанен
                            </span>
                          ) : (
                            <span className="text-green-400 text-xs">Активен</span>
                          )}
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            {u.id !== 1 && (
                              <>
                                {u.subscription_end && (
                                  <button
                                    onClick={() => reduceSubscription(u.id)}
                                    className="text-yellow-400 hover:text-yellow-300 transition"
                                    title="Убрать дни подписки"
                                  >
                                    <Minus size={16} />
                                  </button>
                                )}
                                <button
                                  onClick={() => addSubscription(u.id)}
                                  className="text-green-400 hover:text-green-300 transition"
                                  title="Добавить дни подписки"
                                >
                                  <Plus size={16} />
                                </button>
                                <button
                                  onClick={() => addBalance(u.id)}
                                  className="text-amber-400 hover:text-amber-300 transition"
                                  title="Начислить/списать баланс"
                                >
                                  <Coin size={16} />
                                </button>
                                {u.banned ? (
                                  <button
                                    onClick={() => unbanUser(u.id)}
                                    className="text-green-400 hover:text-green-300 transition"
                                    title="Разбанить"
                                  >
                                    <Check size={16} weight="bold" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => banUser(u.id)}
                                    className="text-orange-400 hover:text-orange-300 transition"
                                    title="Забанить"
                                  >
                                    <Prohibit size={16} />
                                  </button>
                                )}
                                <button
                                  onClick={() => deleteUser(u.id)}
                                  className="text-red-400 hover:text-red-300 transition"
                                  title="Удалить"
                                >
                                  <Trash size={16} />
                                </button>
                                <button
                                  onClick={() => changePassword(u.id)}
                                  className="text-blue-400 hover:text-blue-300 transition"
                                  title="Сменить пароль"
                                >
                                  <Key size={16} />
                                </button>
                                <button
                                  onClick={() => changeUsername(u.id)}
                                  className="text-cyan-400 hover:text-cyan-300 transition"
                                  title="Сменить ник"
                                >
                                  <User size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {allUsers.length === 0 && (
                  <p className="text-white/30 text-center py-8">Нет пользователей</p>
                )}
              </div>
            </div>
          )}

          {keysTab === "news" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Создать новость */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7">
                <div className="flex items-center gap-2 mb-1">
                  <Key size={22} className="text-white/70" />
                  <h2 className="text-2xl font-bold">Новая новость</h2>
                </div>
                <p className="text-white/40 mb-5">Добавление новости на главную страницу.</p>

                <div className="mb-4">
                  <label className="text-white/40 text-xs mb-1 block">Тег</label>
                  <select
                    value={newsTag}
                    onChange={(e) => setNewsTag(e.target.value)}
                    className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
                  >
                    <option value="Обновление">Обновление</option>
                    <option value="Ивент">Ивент</option>
                    <option value="Важно">Важно</option>
                    <option value="Исправление">Исправление</option>
                    <option value="Анонс">Анонс</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="text-white/40 text-xs mb-1 block">Заголовок</label>
                  <input
                    type="text"
                    value={newsTitle}
                    onChange={(e) => setNewsTitle(e.target.value)}
                    placeholder="Название новости"
                    className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
                  />
                </div>

                <div className="mb-4">
                  <label className="text-white/40 text-xs mb-1 block">Содержание</label>
                  <textarea
                    value={newsContent}
                    onChange={(e) => setNewsContent(e.target.value)}
                    placeholder="Текст новости..."
                    rows={4}
                    className="w-full bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none resize-none"
                  />
                </div>

                {newsMsg && (
                  <p className={`text-sm mb-3 ${newsMsg.includes("✓") ? "text-green-400" : "text-red-400"}`}>
                    {newsMsg}
                  </p>
                )}

                <button
                  onClick={createNews}
                  disabled={newsLoading || !newsTitle.trim() || !newsContent.trim()}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold transition bg-purple-600 hover:bg-purple-700 disabled:opacity-60"
                >
                  {newsLoading ? "Публикация..." : "Опубликовать"}
                </button>
              </div>

              {/* Список новостей */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Users size={22} className="text-white/70" />
                    <h2 className="text-2xl font-bold">Все новости ({allNews.length})</h2>
                  </div>
                  <button
                    onClick={loadNews}
                    className="text-sm text-purple-400 hover:text-purple-300"
                  >
                    Обновить
                  </button>
                </div>

                <div className="flex flex-col gap-4 max-h-96 overflow-y-auto">
                  {allNews.map((n: any) => (
                    <div key={n.id} className="bg-black/30 rounded-xl p-4 border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300">
                            {n.tag}
                          </span>
                          <span className="text-white/30 text-xs">{n.created_at?.slice(0, 10)}</span>
                        </div>
                        <button
                          onClick={() => deleteNews(n.id)}
                          className="text-red-400 hover:text-red-300 transition"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                      <h3 className="font-bold text-white/90 mb-1">{n.title}</h3>
                      <p className="text-white/50 text-sm">{n.content}</p>
                    </div>
                  ))}
                  {allNews.length === 0 && (
                    <p className="text-white/30 text-center py-8">Нет новостей</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {keysTab === "media" && (
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Users size={22} className="text-white/70" />
                  <h2 className="text-2xl font-bold">Медиа заявки ({mediaSubmissions.length})</h2>
                </div>
                <button
                  onClick={loadMedia}
                  className="text-sm text-purple-400 hover:text-purple-300"
                >
                  Обновить
                </button>
              </div>

              <div className="mb-4 flex items-center gap-3">
                <label className="text-white/40 text-xs">Награда (₽):</label>
                <input
                  type="number"
                  min={0}
                  value={mediaReward}
                  onChange={(e) => setMediaReward(Number(e.target.value))}
                  className="w-24 bg-black/40 px-3 py-2 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-sm"
                />
              </div>

              <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto">
                {mediaSubmissions.map((s: any) => (
                  <div key={s.id} className="bg-black/30 rounded-xl p-4 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white/90 text-sm">{s.username}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          s.status === "approved" ? "bg-green-500/20 text-green-300" :
                          s.status === "rejected" ? "bg-red-500/20 text-red-300" :
                          "bg-yellow-500/20 text-yellow-300"
                        }`}>
                          {s.status === "approved" ? "Одобрено" : s.status === "rejected" ? "Отклонено" : "На рассмотрении"}
                        </span>
                        {s.reward > 0 && <span className="text-green-400 text-sm">+{s.reward} ₽</span>}
                      </div>
                      <span className="text-white/30 text-xs">{s.created_at?.slice(0, 10)}</span>
                    </div>

                    <a href={s.video_url} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 text-sm truncate block mb-3">
                      {s.video_url}
                    </a>

                    {s.admin_note && (
                      <p className="text-white/30 text-xs mb-2">Примечание: {s.admin_note}</p>
                    )}

                    {s.status === "pending" && (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Примечание (необязательно)"
                          value={mediaNote}
                          onChange={(e) => setMediaNote(e.target.value)}
                          className="flex-1 bg-black/40 px-3 py-2 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-xs"
                        />
                        <button
                          onClick={() => approveMedia(s.id)}
                          className="px-4 py-2 rounded-xl text-xs font-semibold bg-green-600 hover:bg-green-700 transition"
                        >
                          Одобрить
                        </button>
                        <button
                          onClick={() => rejectMedia(s.id)}
                          className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 transition"
                        >
                          Отклонить
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {mediaSubmissions.length === 0 && (
                  <p className="text-white/30 text-center py-8">Нет заявок</p>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
