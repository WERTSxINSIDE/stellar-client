import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GUIDES, getGuide } from "@/lib/guides";
import GuideArticle from "./GuideArticle";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stellar-client.vercel.app";

export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return { title: "Гайд не найден" };

  const url = `${SITE_URL}/guides/${guide.slug}`;

  return {
    title: guide.title.ru,
    description: guide.description.ru,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: {
      title: guide.title.ru,
      description: guide.description.ru,
      url,
      type: "article",
      modifiedTime: guide.updated,
    },
    twitter: {
      card: "summary_large_image",
      title: guide.title.ru,
      description: guide.description.ru,
    },
  };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: guide.title.ru,
    description: guide.description.ru,
    dateModified: guide.updated,
    inLanguage: "ru-RU",
    mainEntityOfPage: `${SITE_URL}/guides/${guide.slug}`,
    author: { "@type": "Organization", name: "Stellar Client" },
    publisher: { "@type": "Organization", name: "Stellar Client" },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <GuideArticle slug={guide.slug} />
    </>
  );
}
