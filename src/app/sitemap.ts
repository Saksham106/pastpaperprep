import type { MetadataRoute } from "next";
import { ARTICLES } from "@/lib/articles";
import { getCatalogBanksForDisplay } from "@/lib/catalog";
import { getLandingManifests, paperPath, topicPath } from "@/lib/search-landing";

const SITE_URL = "https://pastpaperprep.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const manifests = await getLandingManifests();
  return [
    { url: SITE_URL },
    { url: `${SITE_URL}/pricing` },
    { url: `${SITE_URL}/articles` },
    { url: `${SITE_URL}/articles/ib-past-papers-mistakes-tutoring`, lastModified: "2026-09-26" },
    { url: `${SITE_URL}/faq` },
    { url: `${SITE_URL}/about` },
    { url: `${SITE_URL}/cambridge-igcse` },
    { url: `${SITE_URL}/ib` },
    ...ARTICLES.map(({ slug, updatedAt }) => ({
      url: `${SITE_URL}/articles/${slug}`,
      lastModified: updatedAt,
    })),
    ...getCatalogBanksForDisplay().map(({ slug }) => ({ url: `${SITE_URL}/banks/${slug}` })),
    ...manifests.flatMap((manifest) => [
      { url: `${SITE_URL}/syllabus/${manifest.bankSlug}` },
      ...manifest.topics.map((topic) => ({ url: `${SITE_URL}${topicPath(manifest.bankSlug, topic)}` })),
      ...manifest.papers.map((paper) => ({ url: `${SITE_URL}${paperPath(manifest.bankSlug, paper)}` })),
    ]),
  ];
}
