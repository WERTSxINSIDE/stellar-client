"use client";

import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      theme?: "light" | "dark" | "auto";
      language?: string;
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    }
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_ID = "cf-turnstile-script";

type Props = {
  /** Токен капчи или null, если пользователь ещё не прошёл проверку. */
  onToken: (token: string | null) => void;
  className?: string;
};

/**
 * Виджет Cloudflare Turnstile.
 * Если ключи на сервере не настроены — не рендерится и не мешает форме.
 */
export default function Turnstile({ onToken, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | null>(null);
  const callbackRef = useRef(onToken);
  const [siteKey, setSiteKey] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    callbackRef.current = onToken;
  }, [onToken]);

  // Публичный ключ берём с сервера, чтобы не пересобирать клиент при смене ключей.
  useEffect(() => {
    let active = true;
    fetch("/api/turnstile", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data?.enabled && typeof data.site_key === "string") {
          setSiteKey(data.site_key);
        }
      })
      .catch(() => {
        // без капчи форма всё равно отправится — сервер сам решит, нужна ли проверка
      });
    return () => {
      active = false;
    };
  }, []);

  // Загружаем скрипт Cloudflare один раз.
  useEffect(() => {
    if (!siteKey) return;
    if (window.turnstile) {
      setScriptReady(true);
      return;
    }

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === "1") setScriptReady(true);
      const onLoad = () => setScriptReady(true);
      existing.addEventListener("load", onLoad);
      return () => existing.removeEventListener("load", onLoad);
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = "1";
      setScriptReady(true);
    };
    document.head.appendChild(script);
  }, [siteKey]);

  // Рендерим/убираем виджет.
  useEffect(() => {
    if (!scriptReady || !siteKey || !containerRef.current) return;
    const api = window.turnstile;
    if (!api) return;

    widgetRef.current = api.render(containerRef.current, {
      sitekey: siteKey,
      theme: "dark",
      language: "ru",
      callback: (token: string) => callbackRef.current(token),
      "expired-callback": () => callbackRef.current(null),
      "error-callback": () => callbackRef.current(null),
    });

    return () => {
      if (widgetRef.current) {
        try {
          api.remove(widgetRef.current);
        } catch {
          // виджет уже мог быть удалён вместе с контейнером
        }
        widgetRef.current = null;
      }
    };
  }, [scriptReady, siteKey]);

  if (!siteKey) return null;

  return <div ref={containerRef} className={className} />;
}
