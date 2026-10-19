"use client";

import { motion } from "framer-motion";

const columns = [
  {
    title: "Платформа",
    links: [
      { label: "Главная", href: "/" },
      { label: "Покупка", href: "/pricing" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    title: "Аккаунт",
    links: [
      { label: "Вход", href: "/login" },
      { label: "Регистрация", href: "/register" },
    ],
  },
  {
    title: "Контакты",
    links: [
      { label: "Telegram", href: "https://t.me/+YSGwKHFMrQAxZWVi", external: true },
      {
        label: "Discord",
        href: "https://discord.gg/wf2NuypGS",
        external: true,
      },
    ],
  },
  {
    title: "Правовое",
    links: [
      { label: "Пользовательское соглашение", href: "/legal/user-agreement" },
      { label: "Лицензионное соглашение", href: "/legal/eula" },
    ],
  },
];

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const colVar = {
  hidden: { opacity: 0, y: 24, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring" as const, damping: 18, stiffness: 200 },
  },
};

const linkVar = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0 },
};

export default function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      viewport={{ once: true }}
      className="
        w-full
        relative
        bg-black/50
        backdrop-blur-md
        border-t border-white/10
        overflow-hidden
      "
    >
      <motion.div
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
        className="relative z-10 px-48 py-20 flex justify-between items-start text-white/70"
      >
        <motion.div variants={colVar} className="flex flex-col gap-3 max-w-xs">
          <h3 className="text-xl font-semibold text-white">Stellar Client</h3>
          <p className="text-sm text-white/50 leading-relaxed">
            © {new Date().getFullYear()} Stellar Client.
            <br />
            Все права защищены.
          </p>
        </motion.div>

        <div className="flex gap-20">
          {columns.map((col) => (
            <motion.div
              key={col.title}
              variants={colVar}
              className="flex flex-col gap-3"
            >
              <h4 className="text-lg font-semibold text-white">{col.title}</h4>
              {col.links.map((link) => (
                <motion.a
                  key={link.label}
                  href={link.href}
                  {...("external" in link && link.external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  variants={linkVar}
                  whileHover={{ x: 6, color: "rgba(216,180,254,1)" }}
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: "spring", damping: 15, stiffness: 350 }}
                  className="relative inline-block w-fit text-white/60"
                >
                  <span className="relative">
                    {link.label}
                    <motion.span
                      className="absolute -bottom-0.5 left-0 h-px bg-purple-300"
                      initial={{ width: 0 }}
                      whileHover={{ width: "100%" }}
                    />
                  </span>
                </motion.a>
              ))}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.footer>
  );
}
