"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { House, ShoppingCartSimple, Question, Trophy } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

export default function Header() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setLoggedIn(!!d.user))
      .catch(() => {});
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="
        fixed top-0 left-0 z-[25]

        h-20

        w-full
        px-10

        backdrop-blur-xl
        bg-black/60
        border-b border-white/10
      "
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-center gap-24 py-4">
        <div className="flex items-center gap-16">
          <Link
            href="/"
            className="flex items-center gap-3 group transition hover:opacity-100"
          >
            <Image src="/icon.png" alt="Icon" width={45} height={45} priority />
          </Link>

          <div className="flex items-center gap-12 text-white/85">
            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.92 }} transition={{ type: "spring", damping: 14, stiffness: 350 }}>
              <Link
                href="/"
                className="flex items-center gap-2 cursor-pointer group"
              >
                <House
                  size={24}
                  weight="fill"
                  className="group-hover:text-purple-300 transition"
                />
                <span className="text-sm group-hover:text-white transition">
                  Главная
                </span>
              </Link>
            </motion.div>

            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.92 }} transition={{ type: "spring", damping: 14, stiffness: 350 }}>
              <Link
                href="/pricing"
                className="flex items-center gap-2 cursor-pointer group"
              >
                <ShoppingCartSimple
                  size={24}
                  weight="fill"
                  className="group-hover:text-purple-300 transition"
                />
                <span className="text-sm group-hover:text-white transition">
                  Купить
                </span>
              </Link>
            </motion.div>

            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.92 }} transition={{ type: "spring", damping: 14, stiffness: 350 }}>
              <Link
                href="/leaderboard"
                className="flex items-center gap-2 cursor-pointer group"
              >
                <Trophy
                  size={24}
                  weight="fill"
                  className="group-hover:text-purple-300 transition"
                />
                <span className="text-sm group-hover:text-white transition">
                  Топ
                </span>
              </Link>
            </motion.div>

            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.92 }} transition={{ type: "spring", damping: 14, stiffness: 350 }}>
              <Link
                href="/faq"
                className="flex items-center gap-2 cursor-pointer group"
              >
                <Question
                  size={24}
                  weight="fill"
                  className="group-hover:text-purple-300 transition"
                />
                <span className="text-sm group-hover:text-white transition">
                  FAQ
                </span>
              </Link>
            </motion.div>
          </div>
        </div>

        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ type: "spring", damping: 15, stiffness: 350 }}>
          <Link className="flex items-center" href={loggedIn ? "/dashboard" : "/login"}>
            <p
              className="
                text-white text-sm font-medium
                px-5 py-2
                rounded-xl
                bg-white/10
                hover:bg-white/20
                transition-colors
                backdrop-blur-xl
              "
            >
              {loggedIn ? "Профиль" : "Вход"}
            </p>
          </Link>
        </motion.div>
      </div>
    </motion.header>
  );
}
