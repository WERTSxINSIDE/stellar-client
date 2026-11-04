"use client";

import { useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import GridBackground from "@/components/GridBackground";
import { useI18n } from "@/lib/i18n";

type Step = "email" | "reset" | "done";

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await fetch("/api/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("forgot.sendError"));
        return;
      }
      setInfo(data.message || t("forgot.codeSent"));
      setStep("reset");
    } catch {
      setError(t("common.connectionError"));
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError(t("forgot.minLength"));
      return;
    }
    if (password !== password2) {
      setError(t("forgot.mismatch"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("forgot.changeError"));
        return;
      }
      setStep("done");
    } catch {
      setError(t("common.connectionError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header />
      <main className="min-h-screen w-full text-white relative overflow-hidden flex items-center justify-center px-6 pt-32">
        <GridBackground className="absolute inset-0 z-0 pointer-events-none" />
        <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/40 via-black/70 to-black/90 pointer-events-none" />
        <div className="relative z-20 w-full max-w-lg bg-black/30 backdrop-blur-xl rounded-3xl border border-white/10 p-10 shadow-2xl">
          <h1 className="text-4xl font-bold text-center mb-3">{t("forgot.title")}</h1>
          <p className="text-center text-white/60 mb-8">
            {step === "email" && t("forgot.emailHint")}
            {step === "reset" && t("forgot.resetHint")}
            {step === "done" && t("forgot.doneHint")}
          </p>

          {step === "email" && (
            <form onSubmit={requestCode} className="flex flex-col gap-5">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                className="bg-black/40 px-5 py-4 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
              />
              {error && <p className="text-red-400 text-sm text-center">{error}</p>}
              <button type="submit" disabled={loading} className="mt-2 py-4 rounded-xl font-semibold transition bg-purple-600 hover:bg-purple-700 disabled:opacity-60">
                {loading ? t("forgot.sending") : t("forgot.sendCode")}
              </button>
              <p className="text-center text-white/50">
                {t("forgot.remembered")}{" "}
                <Link href="/login" className="text-purple-400 hover:text-purple-300">{t("forgot.signIn")}</Link>
              </p>
            </form>
          )}

          {step === "reset" && (
            <form onSubmit={resetPassword} className="flex flex-col gap-5">
              {info && <p className="text-green-400 text-sm text-center">{info}</p>}
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder={t("auth.code6")}
                maxLength={6}
                className="bg-black/40 px-5 py-4 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-center tracking-[0.4em] text-xl"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("forgot.newPassword")}
                className="bg-black/40 px-5 py-4 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
              />
              <input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder={t("forgot.repeatPassword")}
                className="bg-black/40 px-5 py-4 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
              />
              {error && <p className="text-red-400 text-sm text-center">{error}</p>}
              <button type="submit" disabled={loading} className="mt-2 py-4 rounded-xl font-semibold transition bg-purple-600 hover:bg-purple-700 disabled:opacity-60">
                {loading ? t("forgot.saving") : t("forgot.save")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError("");
                  setInfo("");
                }}
                className="text-center text-sm text-white/40 hover:text-white transition"
              >
                {t("forgot.resend")}
              </button>
            </form>
          )}

          {step === "done" && (
            <div className="flex flex-col gap-6 text-center">
              <p className="text-white/70">
                {t("forgot.doneText")}
              </p>
              <Link href="/login" className="py-4 rounded-xl font-semibold bg-purple-600 hover:bg-purple-700 transition">
                {t("forgot.goLogin")}
              </Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
