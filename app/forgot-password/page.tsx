"use client";

import { useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
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
      <main className="relative flex min-h-screen w-full items-center justify-center px-4 pb-16 pt-28 text-white sm:px-6">
        <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0f0f12]/90 p-6 sm:p-8">
          <h1 className="mb-2 text-center text-2xl font-semibold sm:text-3xl">{t("forgot.title")}</h1>
          <p className="mb-8 text-center text-sm text-white/50">
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
                className="bg-[#0a0a0c] px-4 py-3 rounded-lg border border-white/10 focus:border-purple-400/70 outline-none transition-colors"
              />
              {error && <p className="text-red-400 text-sm text-center">{error}</p>}
              <button type="submit" disabled={loading} className="mt-2 rounded-lg bg-purple-600 py-3 font-medium text-white transition-colors hover:bg-purple-500 disabled:opacity-60">
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
                className="bg-[#0a0a0c] px-4 py-3 rounded-lg border border-white/10 focus:border-purple-400/70 outline-none transition-colors text-center tracking-[0.4em] text-xl"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("forgot.newPassword")}
                className="bg-[#0a0a0c] px-4 py-3 rounded-lg border border-white/10 focus:border-purple-400/70 outline-none transition-colors"
              />
              <input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                placeholder={t("forgot.repeatPassword")}
                className="bg-[#0a0a0c] px-4 py-3 rounded-lg border border-white/10 focus:border-purple-400/70 outline-none transition-colors"
              />
              {error && <p className="text-red-400 text-sm text-center">{error}</p>}
              <button type="submit" disabled={loading} className="mt-2 rounded-lg bg-purple-600 py-3 font-medium text-white transition-colors hover:bg-purple-500 disabled:opacity-60">
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
              <Link href="/login" className="rounded-lg bg-purple-600 py-3 font-medium transition-colors hover:bg-purple-500">
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
