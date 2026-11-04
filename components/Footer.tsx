"use client";

import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";

const columns = [
  {
    title: "footer.platform",
    links: [
      { label: "footer.home", href: "/" },
      { label: "footer.buy", href: "/pricing" },
      { label: "footer.community", href: "/community" },
      { label: "footer.status", href: "/status" },
      { label: "footer.faq", href: "/faq" },
      { label: "footer.guides", href: "/guides" },
      { label: "footer.changelog", href: "/changelog" },
    ],
  },
  {
    title: "footer.account",
    links: [
      { label: "footer.login", href: "/login" },
      { label: "footer.register", href: "/register" },
    ],
  },
  {
    title: "footer.contacts",
    links: [
      { label: "Telegram", href: "https://t.me/+YSGwKHFMrQAxZWVi", external: true },
      {
        label: "Discord",
        href: "https://discord.gg/W5KTanZnh",
        external: true,
      },
    ],
  },
  {
    title: "footer.legal",
    links: [
      { label: "footer.userAgreement", href: "/legal/user-agreement" },
      { label: "footer.eula", href: "/legal/eula" },
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
  const { t } = useI18n();
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
        className="relative z-10 px-4 sm:px-8 lg:px-16 xl:px-48 py-12 sm:py-16 lg:py-20 flex flex-col lg:flex-row lg:justify-between items-start gap-10 text-white/70"
      >
        <motion.div variants={colVar} className="flex flex-col gap-3 max-w-xs">
          <h3 className="text-xl font-semibold text-white">Stellar Client</h3>
          <p className="text-sm text-white/50 leading-relaxed">
            © {new Date().getFullYear()} Stellar Client.
            <br />
            {t("footer.rights")}
          </p>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex gap-8 sm:gap-10 lg:gap-16 xl:gap-20 w-full lg:w-auto">
          {columns.map((col) => (
            <motion.div
              key={col.title}
              variants={colVar}
              className="flex flex-col gap-3"
            >
              <h4 className="text-lg font-semibold text-white">{t(col.title)}</h4>
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
                    {t(link.label)}
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
