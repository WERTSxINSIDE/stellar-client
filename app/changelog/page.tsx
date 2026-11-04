import type { Metadata } from "next";
import ChangelogList from "./ChangelogList";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stellar-client.vercel.app";

export const metadata: Metadata = {
  title: "Changelog — обновления Stellar Client",
  description:
    "Публичный журнал обновлений Stellar Client: новые функции, улучшения витрины, промокодов и поддержки.",
  alternates: { canonical: "/changelog" },
  openGraph: {
    title: "Changelog — обновления Stellar Client",
    description:
      "Новые функции, улучшения и исправления Stellar Client в одном списке.",
    url: `${SITE_URL}/changelog`,
    type: "website",
  },
};

export default function ChangelogPage() {
  return <ChangelogList />;
}
