"use client";

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

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="relative w-full border-t border-white/[0.08] bg-[#08080a]/60">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:px-6 lg:grid-cols-[1fr_2fr] lg:gap-16">
        <div className="max-w-xs">
          <p className="text-base font-semibold text-white">Stellar Client</p>
          <p className="mt-3 text-sm leading-relaxed text-white/45">
            © {new Date().getFullYear()} Stellar Client.
            <br />
            {t("footer.rights")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {columns.map((col) => (
            <div key={col.title} className="flex flex-col gap-2.5">
              <p className="text-[13px] font-medium text-white">{t(col.title)}</p>
              {col.links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  {...("external" in link && link.external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="w-fit text-[13px] text-white/45 transition-colors hover:text-white"
                >
                  {t(link.label)}
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
