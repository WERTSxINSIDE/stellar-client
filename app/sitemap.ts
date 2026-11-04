import type { MetadataRoute } from "next";
import { queryAll } from "@/lib/db";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stellar-client.vercel.app";

export const revalidate = 3600;

const STATIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "", priority: 1, changeFrequency: "weekly" },
  { path: "/pricing", priority: 0.9, changeFrequency: "weekly" },
  { path: "/reviews", priority: 0.7, changeFrequency: "weekly" },
  { path: "/community", priority: 0.8, changeFrequency: "daily" },
  { path: "/leaderboard", priority: 0.7, changeFrequency: "daily" },
  { path: "/faq", priority: 0.6, changeFrequency: "monthly" },
  { path: "/support", priority: 0.5, changeFrequency: "monthly" },
  { path: "/legal", priority: 0.4, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  let profileEntries: MetadataRoute.Sitemap = [];
  try {
    const rows = (await queryAll(
      `SELECT username FROM users
       WHERE COALESCE(banned, 0) = 0 AND username IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 5000`
    )) as { username: string }[];

    profileEntries = rows
      .filter((row) => row.username)
      .map((row) => ({
        url: `${SITE_URL}/u/${encodeURIComponent(row.username)}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.5,
      }));
  } catch {
    profileEntries = [];
  }

  let showcaseEntries: MetadataRoute.Sitemap = [];
  try {
    const rows = (await queryAll(
      `SELECT s.id, s.type, s.created_at
       FROM showcase_items s
       JOIN users u ON u.id = s.user_id
       WHERE s.status = 'approved' AND COALESCE(u.banned, 0) = 0
       ORDER BY s.created_at DESC
       LIMIT 2000`
    )) as { id: number; type: string; created_at: string }[];

    showcaseEntries = rows.map((row) => ({
      url: `${SITE_URL}/community/${row.type}/${row.id}`,
      lastModified: new Date(String(row.created_at).replace(" ", "T")) || now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
  } catch {
    showcaseEntries = [];
  }

  return [...staticEntries, ...profileEntries, ...showcaseEntries];
}
