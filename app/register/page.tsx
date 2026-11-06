"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Turnstile from "@/components/Turnstile";
import { useI18n } from "@/lib/i18n";
import { REF_STORAGE_KEY } from "@/lib/discounts";
import { isMinecraftName } from "@/lib/minecraft-name";

export default function RegisterPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [refName, setRefName] = useState("");

  const [codeEnabled, setCodeEnabled] = useState(false);
  const [code, setCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeMsg, setCodeMsg] = useState("");
  const [codeErr, setCodeErr] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/email-code")
      .then((r) => r.json())
      .then((d) => setCodeEnabled(!!d.enabled))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("ref");
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(REF_STORAGE_KEY);
    } catch {
      // localStorage может быть недоступен — тогда работает только параметр в ссылке.
    }
    const ref = (fromUrl || stored || "").trim().slice(0, 64);
    if (ref) setRefName(ref);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode() {
    if (cooldown > 0 || codeLoading) return;
    setCodeMsg("");
    setCodeErr(false);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setCodeMsg(t("auth.enterValidEmail"));
      setCodeErr(true);
      return;
    }
    setCodeLoading(true);
    try {
      const res = await fetch("/api/email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCodeMsg(data.error || t("auth.sendCodeError"));
        setCodeErr(true);
      } else {
        setCodeMsg(t("auth.codeSent", { email }));
        setCooldown(60);
      }
    } catch {
      setCodeMsg(t("common.serverError"));
      setCodeErr(true);
    } finally {
      setCodeLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!isMinecraftName(username)) {
      setError(t("auth.usernameInvalid"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email,
          password,
          code: code.trim(),
          ref: refName || undefined,
          turnstile_token: turnstileToken || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("auth.registerError"));
        return;
      }
      try {
        window.localStorage.removeItem(REF_STORAGE_KEY);
      } catch {
        // ignore
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
          <h1 className="mb-2 text-center text-2xl font-semibold sm:text-3xl">{t("auth.registerTitle")}</h1>
          <p className="mb-8 text-center text-sm text-white/50">
            {t("auth.registerSubtitle")}
          </p>

          {refName && (
            <div className="mb-6 rounded-2xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-sm text-purple-200">
              {t("auth.referralInvited", { name: refName })}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="bg-[#0a0a0c] px-4 py-3 rounded-lg border border-white/10 focus:border-purple-400/70 outline-none transition-colors"
            />

            {codeEnabled && (
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder={t("auth.codePlaceholder")}
                  className="flex-1 min-w-0 bg-[#0a0a0c] px-4 py-3 rounded-lg border border-white/10 focus:border-purple-400/70 outline-none transition-colors tracking-widest"
                />
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={codeLoading || cooldown > 0}
                  className="shrink-0 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-medium transition-colors hover:bg-white/10 disabled:opacity-50"
                >
                  {codeLoading
                    ? t("auth.sending")
                    : cooldown > 0
                      ? t("auth.seconds", { count: cooldown })
                      : t("auth.getCode")}
                </button>
              </div>
            )}
            {codeEnabled && codeMsg && (
              <p className={`text-sm -mt-3 ${codeErr ? "text-red-400" : "text-green-400"}`}>{codeMsg}</p>
            )}

            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("auth.username")}
              maxLength={16}
              autoComplete="username"
              spellCheck={false}
              className="bg-[#0a0a0c] px-4 py-3 rounded-lg border border-white/10 focus:border-purple-400/70 outline-none transition-colors"
            />
            <p className="-mt-3 text-xs text-white/40">{t("auth.usernameHint")}</p>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("auth.password")}
              className="bg-[#0a0a0c] px-4 py-3 rounded-lg border border-white/10 focus:border-purple-400/70 outline-none transition-colors"
            />

            <Turnstile onToken={setTurnstileToken} className="flex justify-center" />

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-4 rounded-lg bg-purple-600 py-3 font-medium text-white transition-colors hover:bg-purple-500 disabled:opacity-60"
            >
              {loading ? t("auth.creating") : t("auth.createAccount")}
            </button>

            <p className="text-center mt-3 text-white/50">
              {t("auth.alreadyHave")}{" "}
              <Link
                href="/login"
                className="text-purple-400 hover:text-purple-300"
              >
                {t("auth.signInLink")}
              </Link>
            </p>
          </form>
        </div>
      </main>

      <Footer />
    </>
  );
}
