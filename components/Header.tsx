"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { House, ShoppingCartSimple, Question, Trophy, Headset, Star, BellSimple, Check, UsersThree, Pulse, List, X, Robot, Shield } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import OnlineBadge from "@/components/OnlineBadge";
import { useI18n } from "@/lib/i18n";
import { localizeNotification } from "@/lib/notification-i18n";

const navItems = [
  { href: "/", labelKey: "nav.home", icon: House },
  { href: "/pricing", labelKey: "nav.buy", icon: ShoppingCartSimple },
  { href: "/leaderboard", labelKey: "nav.top", icon: Trophy },
  { href: "/community", labelKey: "nav.community", icon: UsersThree },
  { href: "/clans", labelKey: "nav.clans", icon: Shield },
  { href: "/assistant", labelKey: "nav.assistant", icon: Robot },
  { href: "/reviews", labelKey: "nav.reviews", icon: Star },
  { href: "/support", labelKey: "nav.support", icon: Headset },
  { href: "/faq", labelKey: "nav.faq", icon: Question },
  { href: "/status", labelKey: "nav.status", icon: Pulse },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

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
    <header className="fixed inset-x-0 top-0 z-[25] border-b border-white/[0.08] bg-[#0a0a0c]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <Image src="/icon.png" alt="Stellar Client" width={34} height={34} priority />
            <span className="hidden font-display text-[15px] font-semibold tracking-tight text-white sm:block">
              Stellar Client
            </span>
          </Link>

          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Main">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={t(item.labelKey)}
                  className={`group relative flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] transition-colors ${
                    active
                      ? "bg-white/[0.07] text-white"
                      : "text-white/55 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  <Icon size={17} weight={active ? "fill" : "regular"} />
                  {item.href === "/support" && supportUnread > 0 && (
                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-purple-400" />
                  )}
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-lg border border-white/10 bg-[#111114] px-2.5 py-1 text-[11px] font-medium text-white shadow-xl opacity-0 transition duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
                  >
                    {t(item.labelKey)}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <OnlineBadge withLabel />
          <LanguageSwitcher />
          {loggedIn && <NotificationBell />}
          <Link
            href={loggedIn ? "/dashboard" : "/login"}
            className="hidden h-9 items-center rounded-lg border border-white/10 bg-white/[0.05] px-4 text-sm font-medium text-white transition-colors hover:bg-white/[0.09] sm:flex"
          >
            {loggedIn ? t("nav.profile") : t("nav.login")}
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label={menuOpen ? t("common.close") : t("nav.menu")}
            aria-expanded={menuOpen}
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white/80 transition-colors hover:bg-white/[0.08] lg:hidden"
          >
            {menuOpen ? <X size={20} /> : <List size={20} />}
          </button>
        </div>
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
              className="fixed inset-0 top-16 z-[24] cursor-default bg-black/60 lg:hidden"
            />
            <motion.nav
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-x-0 top-full z-[26] max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-white/[0.08] bg-[#0b0b0e] px-4 py-4 lg:hidden"
            >
              <div className="grid grid-cols-2 gap-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                        active
                          ? "bg-white/[0.07] text-white"
                          : "text-white/65 hover:bg-white/[0.04] hover:text-white"
                      }`}
                    >
                      <span className={active ? "text-purple-300" : "text-white/40"}>
                        <Icon size={18} weight={active ? "fill" : "regular"} />
                      </span>
                      {t(item.labelKey)}
                      {item.href === "/support" && supportUnread > 0 && (
                        <span className="ml-auto grid h-[18px] min-w-[18px] place-items-center rounded-full bg-purple-600 px-1 text-[10px] font-bold text-white">
                          {supportUnread > 99 ? "99+" : supportUnread}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>

              <Link
                href={loggedIn ? "/dashboard" : "/login"}
                className="mt-3 flex items-center justify-center rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-500"
              >
                {loggedIn ? t("nav.profile") : t("nav.login")}
              </Link>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </header>
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
        className="relative grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] transition-colors hover:bg-white/[0.08]"
      >
        <BellSimple size={18} weight={unread > 0 ? "fill" : "regular"} className={unread > 0 ? "text-purple-300" : "text-white/70"} />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-purple-600 px-1 text-[10px] font-bold text-white">
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
          <div className="absolute right-0 z-50 mt-3 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-white/10 bg-[#111114] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
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
                    className={`w-full border-b border-white/5 px-4 py-3 text-left transition last:border-0 hover:bg-white/5 ${
                      item.read_at ? "opacity-70" : "bg-purple-500/[0.07]"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!item.read_at && (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug break-words">{copy.title}</p>
                        {copy.body && (
                          <p className="mt-0.5 text-xs leading-relaxed text-white/50 break-words">{copy.body}</p>
                        )}
                        <p className="mt-1 text-[10px] text-white/25">
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
