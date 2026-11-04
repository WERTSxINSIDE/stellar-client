import type { Metadata } from "next";
import GuidesList from "./GuidesList";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stellar-client.vercel.app";

export const metadata: Metadata = {
  title: "Гайды по Stellar Client",
  description:
    "Инструкции по Stellar Client: как установить лаунчер, выбрать конфиг в витрине и сбросить HWID. Пошаговые руководства без воды.",
  alternates: { canonical: "/guides" },
  openGraph: {
    title: "Гайды по Stellar Client",
    description:
      "Пошаговые инструкции: установка лаунчера, выбор конфига и работа с HWID.",
    url: `${SITE_URL}/guides`,
    type: "website",
  },
};

export default function GuidesPage() {
  return <GuidesList />;
}
