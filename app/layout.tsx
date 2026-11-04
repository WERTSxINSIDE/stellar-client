import type { Metadata } from "next";
import { Inter, Unbounded } from "next/font/google";
import "./globals.css";
import LanguageGate from "@/components/LanguageGate";
import RefTracker from "@/components/RefTracker";
import SiteTheme from "@/components/SiteTheme";
import { LanguageProvider } from "@/lib/i18n";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stellar-client.vercel.app";

const TITLE = "Stellar Client";
const DESCRIPTION =
  "Stellar Client — приватный игровой клиент с достижениями, статистикой и сообществом. Подписка, ключи и поддержка в одном месте.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: `%s — ${TITLE}`,
  },
  description: DESCRIPTION,
  applicationName: TITLE,
  keywords: [
    "Stellar Client",
    "игровой клиент",
    "приватный клиент",
    "чит",
    "подписка",
    "достижения",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: "/",
    siteName: TITLE,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${unbounded.variable} font-sans antialiased`}
      >
        <LanguageProvider>
          <SiteTheme />
          <RefTracker />
          {children}
          <LanguageGate />
        </LanguageProvider>
      </body>
    </html>
  );
}
