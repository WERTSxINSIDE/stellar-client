import type { Metadata } from "next";
import { queryOne } from "@/lib/db";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stellar-client.vercel.app";

type PageProps = {
  params: Promise<{ username: string }> | { username: string };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolved = await params;
  const raw = typeof resolved?.username === "string" ? resolved.username : "";
  const name = decodeURIComponent(raw).trim();

  if (!name) {
    return { title: "Профиль не найден", robots: { index: false } };
  }

  const url = `${SITE_URL}/u/${encodeURIComponent(name)}`;

  let user: { username: string; bio: string | null } | null = null;
  try {
    user = (await queryOne(
      `SELECT username, bio FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
      [name]
    )) as { username: string; bio: string | null } | null;
  } catch {
    user = null;
  }

  if (!user) {
    return {
      title: "Профиль не найден",
      description: "Игрок с таким ником не найден.",
      robots: { index: false, follow: false },
    };
  }

  const title = `${user.username} — профиль игрока`;
  const description = user.bio
    ? user.bio.slice(0, 160)
    : `Достижения, статистика и активность игрока ${user.username} в Stellar Client.`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Stellar Client",
      type: "profile",
      locale: "ru_RU",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
