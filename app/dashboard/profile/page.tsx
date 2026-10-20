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
  LockKey,
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

  const [twofaEnabled, setTwofaEnabled] = useState(false);
  const [twofaFlow, setTwofaFlow] = useState<"idle" | "code" | "disable">("idle");
  const [twofaCode, setTwofaCode] = useState("");
  const [twofaPassword, setTwofaPassword] = useState("");
  const [twofaMsg, setTwofaMsg] = useState("");
  const [twofaOk, setTwofaOk] = useState(false);
  const [twofaBusy, setTwofaBusy] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.user) { router.replace("/login"); return; }
        setUser(data.user);
        setLoading(false);
      });
    fetch("/api/2fa").then(r=>r.json()).then(d=>{ if(d.ok) setTwofaEnabled(!!d.enabled); }).catch(()=>{});
  }, [router]);

  async function twofaRequest(){ setTwofaBusy(true); setTwofaMsg(""); setTwofaOk(false); try{ const res=await fetch("/api/2fa",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"request"})}); const d=await res.json(); if(!res.ok){setTwofaMsg(d.error||"Ошибка");return;} setTwofaFlow("code"); setTwofaMsg("Код отправлен на вашу почту"); setTwofaOk(true);}catch{setTwofaMsg("Ошибка сервера");}finally{setTwofaBusy(false);}}
  async function twofaEnable(){ setTwofaBusy(true); setTwofaMsg(""); try{ const res=await fetch("/api/2fa",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"enable",code:twofaCode})}); const d=await res.json(); if(!res.ok){setTwofaOk(false);setTwofaMsg(d.error||"Ошибка");return;} setTwofaEnabled(true); setTwofaFlow("idle"); setTwofaCode(""); setTwofaMsg("Двухфакторная защита включена"); setTwofaOk(true);}catch{setTwofaMsg("Ошибка сервера");}finally{setTwofaBusy(false);}}
  async function twofaDisable(){ setTwofaBusy(true); setTwofaMsg(""); try{ const res=await fetch("/api/2fa",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"disable",password:twofaPassword})}); const d=await res.json(); if(!res.ok){setTwofaOk(false);setTwofaMsg(d.error||"Ошибка");return;} setTwofaEnabled(false); setTwofaFlow("idle"); setTwofaPassword(""); setTwofaMsg("Двухфакторная защита отключена"); setTwofaOk(true);}catch{setTwofaMsg("Ошибка сервера");}finally{setTwofaBusy(false);}}

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

          {/* Двухфакторная защита */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-7 mb-8">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center shrink-0"><LockKey size={22} className="text-purple-300" /></div>
                <div>
                  <h2 className="text-xl font-bold mb-1">Двухфакторная защита</h2>
                  <p className="text-white/50 text-sm max-w-md">При входе в аккаунт дополнительно потребуется код из письма на {user.email}.</p>
                </div>
              </div>
              <span className={`text-xs px-3 py-1.5 rounded-full border ${twofaEnabled?"bg-green-500/15 border-green-500/30 text-green-300":"bg-white/5 border-white/10 text-white/50"}`}>{twofaEnabled?"Включена":"Выключена"}</span>
            </div>
            {twofaMsg && <p className={`text-sm mb-4 ${twofaOk?"text-green-400":"text-red-400"}`}>{twofaMsg}</p>}
            {twofaFlow === "code" ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <input type="text" inputMode="numeric" value={twofaCode} onChange={(e)=>setTwofaCode(e.target.value.replace(/\D/g,"").slice(0,6))} placeholder="Код из письма" maxLength={6} className="flex-1 bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-center tracking-[0.3em]" />
                <button onClick={twofaEnable} disabled={twofaBusy||twofaCode.length<6} className="px-6 py-3 rounded-xl font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition">Подтвердить</button>
                <button onClick={()=>{setTwofaFlow("idle");setTwofaCode("");setTwofaMsg("");}} className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition">Отмена</button>
              </div>
            ) : twofaFlow === "disable" ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <input type="password" value={twofaPassword} onChange={(e)=>setTwofaPassword(e.target.value)} placeholder="Пароль от аккаунта" className="flex-1 bg-black/40 px-4 py-3 rounded-xl border border-white/10 focus:border-purple-500 outline-none" />
                <button onClick={twofaDisable} disabled={twofaBusy||!twofaPassword} className="px-6 py-3 rounded-xl font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-50 transition">Отключить</button>
                <button onClick={()=>{setTwofaFlow("idle");setTwofaPassword("");setTwofaMsg("");}} className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition">Отмена</button>
              </div>
            ) : twofaEnabled ? (
              <button onClick={()=>{setTwofaFlow("disable");setTwofaMsg("");}} className="px-6 py-3 rounded-xl font-semibold bg-white/5 hover:bg-white/10 border border-white/10 transition">Отключить</button>
            ) : (
              <button onClick={twofaRequest} disabled={twofaBusy} className="px-6 py-3 rounded-xl font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition">{twofaBusy?"Отправка...":"Включить"}</button>
            )}
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
