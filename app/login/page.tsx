"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Turnstile from "@/components/Turnstile";
import { useI18n } from "@/lib/i18n";

export default function LoginPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [twofa, setTwofa] = useState(false);
  const [code, setCode] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login,
          password,
          remember,
          turnstile_token: turnstileToken || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("auth.loginError"));
        return;
      }
      if (data.twofa) {
        setTwofa(true);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(t("common.connectionError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleTwofa(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/login-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, code, remember }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("auth.invalidCode"));
        return;
      }
      router.push("/dashboard");
      router.refresh();
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
          <h1 className="mb-2 text-center text-2xl font-semibold sm:text-3xl">{twofa ? t("auth.twofaTitle") : t("auth.loginTitle")}</h1>
          <p className="mb-8 text-center text-sm text-white/50">{twofa ? t("auth.twofaSubtitle") : t("auth.loginSubtitle")}</p>

          {twofa ? (
            <form onSubmit={handleTwofa} className="flex flex-col gap-5">
              <input type="text" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder={t("auth.code6")} maxLength={6} className="bg-[#0a0a0c] px-4 py-3 rounded-lg border border-white/10 focus:border-purple-400/70 outline-none transition-colors text-center tracking-[0.4em] text-xl" />
              {error && <p className="text-red-400 text-sm text-center">{error}</p>}
              <button type="submit" disabled={loading} className="mt-4 rounded-lg bg-purple-600 py-3 font-medium text-white transition-colors hover:bg-purple-500 disabled:opacity-60">{loading ? t("auth.checking") : t("auth.confirm")}</button>
              <p className="text-center text-white/40 text-sm">{t("auth.noEmail")} <button type="button" onClick={() => { setTwofa(false); setCode(""); setError(""); }} className="text-purple-400 hover:text-purple-300">{t("auth.back")}</button></p>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <input type="text" value={login} onChange={(e) => setLogin(e.target.value)} placeholder={t("auth.emailOrUsername")} className="bg-[#0a0a0c] px-4 py-3 rounded-lg border border-white/10 focus:border-purple-400/70 outline-none transition-colors" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("auth.password")} className="bg-[#0a0a0c] px-4 py-3 rounded-lg border border-white/10 focus:border-purple-400/70 outline-none transition-colors" />
              <div className="flex justify-end -mt-2">
                <Link href="/forgot-password" className="text-sm text-white/40 hover:text-purple-300 transition">{t("auth.forgot")}</Link>
              </div>
              <Turnstile onToken={setTurnstileToken} className="flex justify-center" />
              {error && <p className="text-red-400 text-sm text-center">{error}</p>}
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-4 h-4 rounded border-white/20 bg-black/40 accent-purple-600" />
                <span className="text-white/60 text-sm">{t("auth.remember")}</span>
              </label>
              <button type="submit" disabled={loading} className="mt-4 rounded-lg bg-purple-600 py-3 font-medium text-white transition-colors hover:bg-purple-500 disabled:opacity-60">{loading ? t("auth.signingIn") : t("auth.signIn")}</button>
              <p className="text-center mt-3 text-white/50">{t("auth.noAccount")} <Link href="/register" className="text-purple-400 hover:text-purple-300">{t("auth.registerLink")}</Link></p>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
