"use client";

import { useEffect } from "react";
import { REF_STORAGE_KEY } from "@/lib/discounts";

function normalize(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 24);
}

/**
 * Считает переход по ссылке `/?ref=CODE` и запоминает код,
 * чтобы регистрация привязалась к партнёру, даже если параметр пропал.
 */
export default function RefTracker() {
  useEffect(() => {
    const ref = normalize(new URLSearchParams(window.location.search).get("ref") || "");
    if (!ref) return;

    try {
      window.localStorage.setItem(REF_STORAGE_KEY, ref);
    } catch {
      // localStorage может быть недоступен в приватном режиме — не критично.
    }

    const seenKey = `stellar_ref_seen:${ref}`;
    try {
      if (window.sessionStorage.getItem(seenKey)) return;
      // Помечаем сразу, чтобы StrictMode и быстрый reload не накрутили клики.
      window.sessionStorage.setItem(seenKey, "1");
    } catch {
      // Если сессия недоступна, серверный rate limit всё равно защитит от накрутки.
    }

    fetch("/api/discount-codes/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: ref }),
      keepalive: true,
    }).catch(() => {
      // Сеть недоступна — снимем отметку, чтобы попробовать на следующей странице.
      try {
        window.sessionStorage.removeItem(seenKey);
      } catch {
        // ignore
      }
    });
  }, []);

  return null;
}
