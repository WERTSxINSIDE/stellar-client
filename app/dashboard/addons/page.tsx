"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useI18n, type Lang } from "@/lib/i18n";
import {
  ArrowLeft,
  Key,
  Lock,
  ArrowClockwise,
  Check,
  Fingerprint,
} from "@phosphor-icons/react";

type Me = { id: number; username: string; email: string } | null;

export default function AddonsPage() {
  const { lang } = useI18n();
  const tr = (ru: string, en: string) => (lang === "en" ? en : ru);
  const router = useRouter();
  const [user, setUser] = useState<Me>(null);

  // Активация ключа
  const [licenseKey, setLicenseKey] = useState("");
  const [captchaDone, setCaptchaDone] = useState(false);
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [keyMsg, setKeyMsg] = useState("");

  // Смена пароля
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [passMsg, setPassMsg] = useState("");
  const [passErr, setPassErr] = useState(false);
  const [passLoading, setPassLoading] = useState(false);

  // Сброс HWID
  const [hwidKey, setHwidKey] = useState("");
  const [hwidMsg, setHwidMsg] = useState("");
  const [hwidLoading, setHwidLoading] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        if (!data.user) router.replace("/login");
        else setUser(data.user);
      });
  }, [router]);

  function runCaptcha() {
    if (captchaDone || captchaLoading) return;
    setCaptchaLoading(true);
    // Имитация проверки (как у Cloudflare) — локально настоящая капча не работает
    setTimeout(() => {
      setCaptchaLoading(false);
      setCaptchaDone(true);
    }, 1400);
  }

  async function activate() {
    setKeyMsg("");
    if (!captchaDone) {
      setKeyMsg(tr("Сначала пройдите проверку", "Please complete the verification first"));
      return;
    }
    if (!licenseKey.trim()) {
      setKeyMsg(tr("Введите ключ", "Enter a key"));
      return;
    }
    try {
      const res = await fetch("/api/activate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: licenseKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setKeyMsg(data.error || tr("Ошибка активации", "Activation error"));
        return;
      }
      setKeyMsg(tr(`Ключ активирован! Подписка: +${data.duration_days} дней ✓`, `Key activated! Subscription: +${data.duration_days} days ✓`));
      setLicenseKey("");
    } catch {
      setKeyMsg(tr("Не удалось подключиться к серверу", "Could not connect to the server"));
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPassMsg("");
    setPassErr(false);
    if (pass1.length < 6) {
      setPassErr(true);
      setPassMsg(tr("Пароль должен быть не меньше 6 символов", "Password must be at least 6 characters"));
      return;
    }
    if (pass1 !== pass2) {
      setPassErr(true);
      setPassMsg(tr("Пароли не совпадают", "Passwords do not match"));
      return;
    }
    setPassLoading(true);
    try {
      const res = await fetch("/api/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pass1 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPassErr(true);
        setPassMsg(data.error || tr("Ошибка смены пароля", "Password change error"));
        return;
      }
      setPass1("");
      setPass2("");
      setPassMsg(tr("Пароль изменён ✓", "Password changed ✓"));
    } catch {
      setPassErr(true);
      setPassMsg(tr("Не удалось подключиться к серверу", "Could not connect to the server"));
    } finally {
      setPassLoading(false);
    }
  }

  async function resetHwid() {
    setHwidMsg("");
    if (!hwidKey.trim()) {
      setHwidMsg(tr("Введите ключ", "Enter a key"));
      return;
    }
    setHwidLoading(true);
    try {
      const res = await fetch("/api/reset-hwid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: hwidKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setHwidMsg(data.error || tr("Ошибка сброса", "Reset error"));
        return;
      }
      setHwidMsg(tr("HWID сброшен ✓", "HWID reset ✓"));
      setHwidKey("");
    } catch {
      setHwidMsg(tr("Не удалось подключиться к серверу", "Could not connect to the server"));
    } finally {
      setHwidLoading(false);
    }
  }

  return (
    <>
      <Header />

      <main className="relative min-h-screen text-white overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-40 pointer-events-none">
          <Image src="/fluid2.png" alt="" fill className="object-cover" priority />
        </div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/60 via-black/70 to-black pointer-events-none" />

        <div className="max-w-5xl mx-auto px-6 pt-36 pb-24">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-white/50 hover:text-white transition text-sm mb-8"
          >
            <ArrowLeft size={16} weight="bold" />{tr("В кабинет", "Back to dashboard")}
          </Link>

          <p className="text-white/40 text-xs tracking-widest uppercase mb-2">
            {tr("Аккаунт", "Account")}
          </p>
          <h1 className="text-5xl font-extrabold mb-3">
            <span className="bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
              {tr("Дополнения", "Add-ons")}
            </span>
          </h1>
          <p className="text-white/40 mb-12">
            {tr("Активация ключа и настройки безопасности аккаунта.", "Key activation and account security settings.")}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Активация ключа */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Key size={22} className="text-white/70" />
                <h2 className="text-2xl font-bold">{tr("Активировать ключ", "Activate a key")}</h2>
              </div>
              <p className="text-white/40 mb-5">
                {tr("Введи ключ, чтобы продлить доступ.", "Enter a key to extend your access.")}
              </p>

              <div className="relative mb-4">
                <Key
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
                />
                <input
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  placeholder="STELLAR-XXX-XXX-XXX"
                  className="w-full bg-black/40 pl-11 pr-5 py-4 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
                />
              </div>

              {/* Капча */}
              <button
                type="button"
                onClick={runCaptcha}
                className="w-full flex items-center justify-between bg-white text-black rounded-xl px-4 py-3 mb-4 select-none"
              >
                <div className="flex items-center gap-3">
                  <span className="grid place-items-center w-6 h-6">
                    {captchaLoading ? (
                      <span className="w-5 h-5 rounded-full border-2 border-black/20 border-t-black animate-spin" />
                    ) : captchaDone ? (
                      <span className="w-6 h-6 rounded-full bg-green-500 grid place-items-center">
                        <Check size={14} weight="bold" className="text-white" />
                      </span>
                    ) : (
                      <span className="w-5 h-5 rounded-full border-2 border-black/30" />
                    )}
                  </span>
                  <span className="text-sm font-medium">
                    {captchaLoading
                      ? tr("Проверка...", "Checking...")
                      : captchaDone
                        ? tr("Успешно.", "Success.")
                        : tr("Подтвердите, что вы человек", "Confirm you are human")}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-black/50 leading-tight text-right">
                  <span className="text-orange-500 text-lg">☁</span>
                  <div>
                    STELLAR
                    <br />
                    <span className="underline">{tr("Конфиденциальность • Справка", "Privacy • Help")}</span>
                  </div>
                </div>
              </button>

              {keyMsg && (
                <p
                  className={`text-sm mb-3 ${
                    keyMsg.includes("✓") ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {keyMsg}
                </p>
              )}

              <button
                onClick={activate}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold transition bg-purple-600 hover:bg-purple-700"
              >
                <Check size={18} weight="bold" />
                {tr("Активировать", "Activate")}
              </button>
            </div>

            {/* Смена пароля */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Lock size={22} className="text-white/70" />
                <h2 className="text-2xl font-bold">{tr("Сменить пароль", "Change password")}</h2>
              </div>
              <p className="text-white/40 mb-5">
                {tr("Новый пароль для входа в аккаунт.", "A new password for signing in to your account.")}
              </p>

              <form onSubmit={changePassword} className="flex flex-col gap-4">
                <div className="relative">
                  <Lock
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
                  />
                  <input
                    type="password"
                    value={pass1}
                    onChange={(e) => setPass1(e.target.value)}
                    placeholder={tr("Новый пароль", "New password")}
                    className="w-full bg-black/40 pl-11 pr-5 py-4 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
                  />
                </div>
                <div className="relative">
                  <Lock
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
                  />
                  <input
                    type="password"
                    value={pass2}
                    onChange={(e) => setPass2(e.target.value)}
                    placeholder={tr("Повтор пароля", "Repeat password")}
                    className="w-full bg-black/40 pl-11 pr-5 py-4 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
                  />
                </div>

                {passMsg && (
                  <p
                    className={`text-sm ${
                      passErr ? "text-red-400" : "text-green-400"
                    }`}
                  >
                    {passMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={passLoading}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold transition bg-purple-600 hover:bg-purple-700 disabled:opacity-60"
                >
                  <ArrowClockwise size={18} weight="bold" />
                  {passLoading ? tr("Сохранение...", "Saving...") : tr("Сменить пароль", "Change password")}
                </button>
              </form>
            </div>
          </div>

          {/* Сброс HWID */}
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-1">
              <Fingerprint size={22} className="text-white/70" />
              <h2 className="text-2xl font-bold">{tr("Сброс HWID", "HWID reset")}</h2>
            </div>
            <p className="text-white/40 mb-5">
              {tr("Введи ключ для сброса привязки железа. Цена: 150 ₽.", "Enter a key to reset the hardware binding. Price: 150 ₽.")}
            </p>

            <div className="relative mb-4">
              <Fingerprint
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
              />
              <input
                value={hwidKey}
                onChange={(e) => setHwidKey(e.target.value)}
                placeholder="HWID-XXXXXXX-XXXX-XXXX"
                className="w-full bg-black/40 pl-11 pr-5 py-4 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
              />
            </div>

            {hwidMsg && (
              <p
                className={`text-sm mb-3 ${
                  hwidMsg.includes("✓") ? "text-green-400" : "text-red-400"
                }`}
              >
                {hwidMsg}
              </p>
            )}

            <button
              onClick={resetHwid}
              disabled={hwidLoading}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold transition bg-purple-600 hover:bg-purple-700 disabled:opacity-60"
            >
              <Fingerprint size={18} weight="bold" />
              {hwidLoading ? tr("Сброс...", "Resetting...") : tr("Сбросить HWID", "Reset HWID")}
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
