"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import GridBackground from "@/components/GridBackground";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [codeEnabled, setCodeEnabled] = useState(false);
  const [code, setCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeMsg, setCodeMsg] = useState("");
  const [codeErr, setCodeErr] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    fetch("/api/email-code")
      .then((r) => r.json())
      .then((d) => setCodeEnabled(!!d.enabled))
      .catch(() => {});
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
      setCodeMsg("Сначала введите корректный email");
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
        setCodeMsg(data.error || "Не удалось отправить код");
        setCodeErr(true);
      } else {
        setCodeMsg(`Код отправлен на ${email}`);
        setCooldown(60);
      }
    } catch {
      setCodeMsg("Ошибка сервера");
      setCodeErr(true);
    } finally {
      setCodeLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка регистрации");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Не удалось подключиться к серверу");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header />

      <main className="min-h-screen w-full text-white relative overflow-hidden flex items-center justify-center px-6 pt-32">
        <GridBackground className="absolute inset-0 z-0 pointer-events-none" />
        <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/40 via-black/60 to-black/80 pointer-events-none" />

        <div className="relative z-20 w-full max-w-lg bg-black/30 backdrop-blur-xl rounded-3xl border border-white/10 p-10 shadow-2xl">
          <h1 className="text-4xl font-bold text-center mb-3">Регистрация</h1>
          <p className="text-center text-white/60 mb-10">
            Создайте новый аккаунт
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="bg-black/40 px-5 py-4 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
            />

            {codeEnabled && (
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="Код из письма (6 цифр)"
                  className="flex-1 min-w-0 bg-black/40 px-5 py-4 rounded-xl border border-white/10 focus:border-purple-500 outline-none tracking-widest"
                />
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={codeLoading || cooldown > 0}
                  className="shrink-0 px-4 py-4 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/15 border border-white/10 disabled:opacity-50 transition"
                >
                  {codeLoading
                    ? "Отправка..."
                    : cooldown > 0
                      ? `${cooldown} сек`
                      : "Получить код"}
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
              placeholder="Имя пользователя"
              className="bg-black/40 px-5 py-4 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
            />

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
              className="bg-black/40 px-5 py-4 rounded-xl border border-white/10 focus:border-purple-500 outline-none"
            />

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-4 py-4 rounded-xl font-semibold transition bg-purple-600 hover:bg-purple-700 disabled:opacity-60"
            >
              {loading ? "Создание..." : "Создать аккаунт"}
            </button>

            <p className="text-center mt-3 text-white/50">
              Уже есть аккаунт?{" "}
              <Link
                href="/login"
                className="text-purple-400 hover:text-purple-300"
              >
                Войти
              </Link>
            </p>
          </form>
        </div>
      </main>

      <Footer />
    </>
  );
}
