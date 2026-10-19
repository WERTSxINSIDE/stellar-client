"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  ArrowLeft,
  User,
  ShieldCheck,
  Hash,
  CalendarBlank,
  Key,
  Fingerprint,
  Shield,
  VideoCamera,
} from "@phosphor-icons/react";

type Me = {
  id: number;
  username: string;
  email: string;
  created_at: string;
  subscription_end: string | null;
  hwid: string | null;
  role: string;
  platform?: string | null;
  sub_gifted?: number;
} | null;

function formatDate(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<Me>(null);
  const [loading, setLoading] = useState(true);

  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.user) {
          router.replace("/login");
          return;
        }
        setUser(data.user);
        setLoading(false);
      });
  }, [router]);

  if (loading || !user) return null;

  const reg = new Date(user.created_at.replace(" ", "T"));
  const subEnd = user.subscription_end
    ? new Date(user.subscription_end.replace(" ", "T"))
    : null;
  const now = new Date();
  const hasSub = subEnd && subEnd > now;

  const roleLabels: Record<string, string> = {
    user: "Пользователь",
    media: "Медиа",
    tester: "Тестер",
    admin: "Администратор",
  };

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
            href="/dashboard"
            className="inline-flex items-center gap-2 text-white/50 hover:text-white transition text-sm mb-8"
          >
            <ArrowLeft size={16} weight="bold" />В кабинет
          </Link>

          <p className="text-white/40 text-xs tracking-widest uppercase mb-2">
            Аккаунт
          </p>
          <h1 className="text-5xl font-extrabold mb-12">
            <span className="bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
              Профиль
            </span>
          </h1>

          {/* Инфо */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7 mb-8">
            <div className="flex items-center gap-5 mb-8">
              <div className="w-20 h-20 rounded-full overflow-hidden border border-white/15 shrink-0">
                <Image
                  src="/icon.png"
                  alt="avatar"
                  width={80}
                  height={80}
                  className="object-cover"
                />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{user.username}</h2>
                <p className="text-white/50 text-sm">{user.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70">
                    <ShieldCheck size={14} />
                    {roleLabels[user.role] || user.role}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70">
                    <Hash size={14} />
                    UID {user.id}
                  </span>
                  {user.role === "media" && user.platform && (
                    <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${
                      user.platform === "youtube"
                        ? "bg-red-500/10 border-red-500/30 text-red-300"
                        : "bg-white/5 border-white/10 text-white/70"
                    }`}>
                      <VideoCamera size={14} />
                      {user.platform === "youtube" ? "YouTube" : "TikTok"}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center gap-2 text-white/40 text-sm mb-2">
                  <CalendarBlank size={18} />
                  Регистрация
                </div>
                <p className="text-lg font-semibold">{formatDate(reg)}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center gap-2 text-white/40 text-sm mb-2">
                  <Key size={18} />
                  Подписка
                </div>
                <p className="text-lg font-semibold">
                  {hasSub
                    ? user.sub_gifted
                      ? "Подаренная подписка"
                      : formatDate(subEnd!)
                    : "Нет подписки"}
                </p>
                {hasSub && (
                  <p className="text-white/30 text-xs mt-1">
                    {user.sub_gifted ? `до ${formatDate(subEnd!)}` : "активна"}
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 col-span-2">
                <div className="flex items-center gap-2 text-white/40 text-sm mb-2">
                  <Fingerprint size={18} />
                  HWID
                </div>
                <p className="font-mono text-lg break-all">
                  {user.hwid || "Не привязан"}
                </p>
              </div>
            </div>
          </div>

          {user.role === "admin" && (
            <Link
              href="/dashboard/admin"
              className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl font-semibold transition bg-purple-600/80 hover:bg-purple-700 border border-purple-500/30 mb-8"
            >
              <Shield size={20} weight="bold" />
              Админ панель
            </Link>
          )}

          {/* Сообщение */}
          {msg && (
            <p className={`text-sm mb-4 ${msgOk ? "text-green-400" : "text-red-400"}`}>
              {msg}
            </p>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
