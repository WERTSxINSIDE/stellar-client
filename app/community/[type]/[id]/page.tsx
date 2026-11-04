import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { queryOne } from "@/lib/db";
import ItemClient from "./item-client";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stellar-client.vercel.app";

type PageProps = {
  params: Promise<{ type: string; id: string }>;
};

type Item = {
  id: number;
  user_id: number;
  type: "config" | "video";
  title: string;
  description: string | null;
  url: string | null;
  file_name: string | null;
  price: number;
  tags: string[] | null;
  views: number | null;
  created_at: string;
  username: string;
  avatar_url: string | null;
  game: string | null;
  version: string | null;
};

async function loadItem(type: string, id: string): Promise<Item | null> {
  const itemId = Number(id);
  if (!Number.isInteger(itemId) || itemId <= 0) return null;
  if (type !== "config" && type !== "video") return null;

  try {
    return (await queryOne(
      `SELECT s.id, s.user_id, s.type, s.title, s.description, s.url, s.file_name,
              s.price, s.tags, s.views, s.created_at,
              s.game, s.version,
              u.username, u.avatar_url
       FROM showcase_items s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1 AND s.type = $2 AND s.status = 'approved'
         AND COALESCE(u.banned, 0) = 0`,
      [itemId, type]
    )) as Item | null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { type, id } = await params;
  const item = await loadItem(type, id);

  if (!item) {
    return { title: "Материал не найден", robots: { index: false, follow: false } };
  }

  const kind = item.type === "config" ? "конфиг" : "видео-отзыв";
  const title = `${item.title} — ${kind} от ${item.username}`;
  const description =
    item.description?.slice(0, 160) ||
    `${kind === "конфиг" ? "Конфиг" : "Видео-отзыв"} от ${item.username} в Stellar Client.`;
  const url = `${SITE_URL}/community/${item.type}/${item.id}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Stellar Client",
      type: "article",
      locale: "ru_RU",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ShowcaseItemPage({ params }: PageProps) {
  const { type, id } = await params;
  const item = await loadItem(type, id);
  if (!item) notFound();

  return <ItemClient initialItem={item} />;
}
