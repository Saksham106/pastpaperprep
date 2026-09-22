import type { MetadataRoute } from "next";
import { ARTICLES } from "@/lib/articles";
import { getCatalogBanksForDisplay } from "@/lib/catalog";

const SITE_URL = "https://pastpaperprep.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL },
    { url: `${SITE_URL}/pricing` },
    { url: `${SITE_URL}/articles` },
    { url: `${SITE_URL}/faq` },
    ...ARTICLES.map(({ slug, updatedAt }) => ({
      url: `${SITE_URL}/articles/${slug}`,
      lastModified: updatedAt,
    })),
    ...getCatalogBanksForDisplay().map(({ slug }) => ({ url: `${SITE_URL}/banks/${slug}` })),
  ];
}
