"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { House, ShoppingCartSimple, Question, Trophy, Headset, Star, BellSimple, Check, UsersThree, Pulse, List, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import OnlineBadge from "@/components/OnlineBadge";
import { useI18n } from "@/lib/i18n";
import { localizeNotification } from "@/lib/notification-i18n";

export default function Header() {
  const { t } = useI18n();
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [supportUnread, setSupportUnread] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [menuOpen]);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setLoggedIn(!!d.user))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!loggedIn) {
      setSupportUnread(0);
      return;
    }
    let active = true;
    const load = () => {
      fetch("/api/support/unread")
        .then((r) => r.json())
        .then((d) => {
          if (active && d.ok) setSupportUnread(Number(d.unread) || 0);
        })
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [loggedIn]);

  return (
    <motion.header
      initial={{ opacity: 0, y: -15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="
        fixed top-0 left-0 z-[25]

        h-20

        w-full
        px-3 sm:px-6

        backdrop-blur-xl
        bg-black/60
        border-b border-white/10
      "
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 py-4">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-3 group transition hover:opacity-100"
          >
            <Image src="/icon.png" alt="Icon" width={45} height={45} priority />
          </Link>

          <div className="hidden lg:flex items-center gap-3 xl:gap-4 text-white/85">
            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.92 }} transition={{ type: "spring", damping: 14, stiffness: 350 }}>
              <Link
                href="/"
                aria-label={t("nav.home")}
                title={t("nav.home")}
                className="flex items-center gap-2 cursor-pointer group"
              >
                <House
                  size={24}
                  weight="fill"
                  className="group-hover:text-purple-300 transition"
                />
                <span className="hidden xl:inline text-sm group-hover:text-white transition">
                  {t("nav.home")}
                </span>
              </Link>
            </motion.div>

            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.92 }} transition={{ type: "spring", damping: 14, stiffness: 350 }}>
              <Link
                href="/pricing"
                aria-label={t("nav.buy")}
                title={t("nav.buy")}
                className="flex items-center gap-2 cursor-pointer group"
              >
                <ShoppingCartSimple
                  size={24}
                  weight="fill"
                  className="group-hover:text-purple-300 transition"
                />
                <span className="hidden xl:inline text-sm group-hover:text-white transition">
                  {t("nav.buy")}
                </span>
              </Link>
            </motion.div>

            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.92 }} transition={{ type: "spring", damping: 14, stiffness: 350 }}>
              <Link
                href="/leaderboard"
                aria-label={t("nav.top")}
                title={t("nav.top")}
                className="flex items-center gap-2 cursor-pointer group"
              >
                <Trophy
                  size={24}
                  weight="fill"
                  className="group-hover:text-purple-300 transition"
                />
                <span className="hidden xl:inline text-sm group-hover:text-white transition">
                  {t("nav.top")}
                </span>
              </Link>
            </motion.div>

            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.92 }} transition={{ type: "spring", damping: 14, stiffness: 350 }}>
              <Link
                href="/community"
                aria-label={t("nav.community")}
                title={t("nav.community")}
                className="flex items-center gap-2 cursor-pointer group"
              >
                <UsersThree
                  size={24}
                  weight="fill"
                  className="group-hover:text-purple-300 transition"
                />
                <span className="hidden xl:inline text-sm group-hover:text-white transition">
                  {t("nav.community")}
                </span>
              </Link>
            </motion.div>

            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.92 }} transition={{ type: "spring", damping: 14, stiffness: 350 }}>
              <Link
                href="/faq"
                aria-label={t("nav.faq")}
                title={t("nav.faq")}
                className="flex items-center gap-2 cursor-pointer group"
              >
                <Question
                  size={24}
                  weight="fill"
                  className="group-hover:text-purple-300 transition"
                />
                <span className="hidden xl:inline text-sm group-hover:text-white transition">
                  {t("nav.faq")}
                </span>
              </Link>
            </motion.div>

            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.92 }} transition={{ type: "spring", damping: 14, stiffness: 350 }}>
              <Link
                href="/reviews"
                aria-label={t("nav.reviews")}
                title={t("nav.reviews")}
                className="flex items-center gap-2 cursor-pointer group"
              >
                <Star
                  size={24}
                  weight="fill"
                  className="group-hover:text-purple-300 transition"
                />
                <span className="hidden xl:inline text-sm group-hover:text-white transition">
                  {t("nav.reviews")}
                </span>
              </Link>
            </motion.div>

            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.92 }} transition={{ type: "spring", damping: 14, stiffness: 350 }}>
              <Link
                href="/support"
                aria-label={t("nav.support")}
                title={t("nav.support")}
                className="flex items-center gap-2 cursor-pointer group"
              >
                <Headset
                  size={24}
                  weight="fill"
                  className="group-hover:text-purple-300 transition"
                />
                <span className="hidden xl:inline text-sm group-hover:text-white transition">
                  {t("nav.support")}
                </span>
                {supportUnread > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-purple-500 text-white text-[10px] font-bold grid place-items-center">
                    {supportUnread > 99 ? "99+" : supportUnread}
                  </span>
                )}
              </Link>
            </motion.div>

            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.92 }} transition={{ type: "spring", damping: 14, stiffness: 350 }}>
              <Link
                href="/status"
                aria-label={t("nav.status")}
                title={t("nav.status")}
                className={`flex items-center gap-2 cursor-pointer group ${
                  pathname === "/status" ? "text-purple-300" : ""
                }`}
              >
                <Pulse
                  size={24}
                  weight="fill"
                  className="group-hover:text-purple-300 transition"
                />
                <span className="hidden xl:inline text-sm group-hover:text-white transition">
                  {t("nav.status")}
                </span>
              </Link>
            </motion.div>
          </div>
        </div>

        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ type: "spring", damping: 15, stiffness: 350 }}>
          <div className="flex items-center gap-2 sm:gap-3">
            <OnlineBadge withLabel />
            <LanguageSwitcher />
            {loggedIn && <NotificationBell />}
            <Link
              className="hidden sm:flex items-center"
              href={loggedIn ? "/dashboard" : "/login"}
            >
              <p
                className="
                  text-white text-xs sm:text-sm font-medium
                  px-3 sm:px-5 py-2
                  rounded-xl
                  bg-white/10
                  hover:bg-white/20
                  transition-colors
                  backdrop-blur-xl
                  whitespace-nowrap
                "
              >
                {loggedIn ? t("nav.profile") : t("nav.login")}
              </p>
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-label={menuOpen ? t("common.close") : t("nav.menu")}
              aria-expanded={menuOpen}
              className="lg:hidden w-10 h-10 grid place-items-center rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
            >
              {menuOpen ? <X size={22} /> : <List size={22} />}
            </button>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.button
              type="button"
              aria-label={t("common.close")}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              className="lg:hidden fixed inset-0 z-[24] bg-black/60 backdrop-blur-sm cursor-default"
            />
            <motion.nav
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden absolute left-0 right-0 top-full z-[26] max-h-[calc(100vh-5rem)] overflow-y-auto border-b border-white/10 bg-[#0a0710]/95 backdrop-blur-xl px-4 py-4"
            >
              <div className="grid grid-cols-2 gap-2">
                {[
                  { href: "/", label: t("nav.home"), icon: <House size={20} weight="fill" /> },
                  { href: "/pricing", label: t("nav.buy"), icon: <ShoppingCartSimple size={20} weight="fill" /> },
                  { href: "/leaderboard", label: t("nav.top"), icon: <Trophy size={20} weight="fill" /> },
                  { href: "/community", label: t("nav.community"), icon: <UsersThree size={20} weight="fill" /> },
                  { href: "/reviews", label: t("nav.reviews"), icon: <Star size={20} weight="fill" /> },
                  { href: "/support", label: t("nav.support"), icon: <Headset size={20} weight="fill" /> },
                  { href: "/faq", label: t("nav.faq"), icon: <Question size={20} weight="fill" /> },
                  { href: "/status", label: t("nav.status"), icon: <Pulse size={20} weight="fill" /> },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-3 text-sm font-medium transition ${
                      pathname === item.href
                        ? "border-purple-400/40 bg-purple-500/15 text-purple-200"
                        : "border-white/10 bg-white/[0.03] text-white/75 hover:bg-white/10"
                    }`}
                  >
                    <span className="text-purple-300">{item.icon}</span>
                    {item.label}
                    {item.href === "/support" && supportUnread > 0 && (
                      <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-purple-500 text-white text-[10px] font-bold grid place-items-center">
                        {supportUnread > 99 ? "99+" : supportUnread}
                      </span>
                    )}
                  </Link>
                ))}
              </div>

              <Link
                href={loggedIn ? "/dashboard" : "/login"}
                className="mt-3 flex items-center justify-center rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-3 text-sm font-semibold transition"
              >
                {loggedIn ? t("nav.profile") : t("nav.login")}
              </Link>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

type NotificationItem = {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

function NotificationBell() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      if (!data.ok) return;
      setItems(data.items || []);
      setUnread(data.unread || 0);
    } catch {
      // тихо игнорируем сетевые ошибки
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [load]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      await load();
      setLoading(false);
      if (unread > 0) {
        try {
          await fetch("/api/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ all: true }),
          });
          setUnread(0);
          setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
        } catch {
          // не критично
        }
      }
    }
  }

  function openItem(item: NotificationItem) {
    setOpen(false);
    if (item.link) router.push(item.link);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={t("nav.notifications")}
        className="relative w-10 h-10 grid place-items-center rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
      >
        <BellSimple size={20} weight={unread > 0 ? "fill" : "regular"} className={unread > 0 ? "text-purple-300" : "text-white/70"} />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-purple-500 text-white text-[10px] font-bold grid place-items-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label={t("nav.closeNotifications")}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-black/20"
          />
          <div className="absolute right-0 mt-3 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-black/90 backdrop-blur-xl shadow-2xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <p className="text-sm font-semibold">{t("nav.notifications")}</p>
              {items.length > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-white/40">
                  <Check size={12} /> {t("nav.read")}
                </span>
              )}
            </div>

            <div className="max-h-[22rem] overflow-y-auto">
              {loading ? (
                <p className="px-4 py-8 text-center text-sm text-white/40">{t("common.loading")}</p>
              ) : items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-white/40">{t("nav.noNotifications")}</p>
              ) : (
                items.map((item) => {
                  const copy = localizeNotification(item, lang);
                  return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openItem(item)}
                    className={`w-full text-left px-4 py-3 border-b border-white/5 last:border-0 transition hover:bg-white/5 ${
                      item.read_at ? "opacity-70" : "bg-purple-500/[0.07]"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!item.read_at && (
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0 mt-1.5" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug break-words">{copy.title}</p>
                        {copy.body && (
                          <p className="text-xs text-white/50 leading-relaxed mt-0.5 break-words">{copy.body}</p>
                        )}
                        <p className="text-[10px] text-white/25 mt-1">
                          {new Date(item.created_at).toLocaleString(lang === "ru" ? "ru-RU" : "en-US", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
