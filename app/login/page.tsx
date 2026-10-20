"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import GridBackground from "@/components/GridBackground";

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [twofa, setTwofa] = useState(false);
  const [code, setCode] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password, remember }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка входа");
        return;
      }
      if (data.twofa) {
        setTwofa(true);
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
        setError(data.error || "Неверный код");
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
        <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/40 via-black/70 to-black/90 pointer-events-none" />
        <div className="relative z-20 w-full max-w-lg bg-black/30 backdrop-blur-xl rounded-3xl border border-white/10 p-10 shadow-2xl">
          <h1 className="text-4xl font-bold text-center mb-3">{twofa ? "Подтверждение" : "Вход"}</h1>
          <p className="text-center text-white/60 mb-10">{twofa ? "Введите код из письма, отправленного на вашу почту" : "Войдите в аккаунт"}</p>

          {twofa ? (
            <form onSubmit={handleTwofa} className="flex flex-col gap-5">
              <input type="text" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-значный код" maxLength={6} className="bg-black/40 px-5 py-4 rounded-xl border border-white/10 focus:border-purple-500 outline-none text-center tracking-[0.4em] text-xl" />
              {error && <p className="text-red-400 text-sm text-center">{error}</p>}
              <button type="submit" disabled={loading} className="mt-4 py-4 rounded-xl font-semibold transition bg-purple-600 hover:bg-purple-700 disabled:opacity-60">{loading ? "Проверка..." : "Подтвердить"}</button>
              <p className="text-center text-white/40 text-sm">Не пришло письмо? Проверьте спам. <button type="button" onClick={() => { setTwofa(false); setCode(""); setError(""); }} className="text-purple-400 hover:text-purple-300">Назад</button></p>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <input type="text" value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Email или имя пользователя" className="bg-black/40 px-5 py-4 rounded-xl border border-white/10 focus:border-purple-500 outline-none" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль" className="bg-black/40 px-5 py-4 rounded-xl border border-white/10 focus:border-purple-500 outline-none" />
              {error && <p className="text-red-400 text-sm text-center">{error}</p>}
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-4 h-4 rounded border-white/20 bg-black/40 accent-purple-600" />
                <span className="text-white/60 text-sm">Запомнить меня</span>
              </label>
              <button type="submit" disabled={loading} className="mt-4 py-4 rounded-xl font-semibold transition bg-purple-600 hover:bg-purple-700 disabled:opacity-60">{loading ? "Вход..." : "Войти"}</button>
              <p className="text-center mt-3 text-white/50">Нет аккаунта? <Link href="/register" className="text-purple-400 hover:text-purple-300">Регистрация</Link></p>
            </form>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
