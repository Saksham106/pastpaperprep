import type { MetadataRoute } from "next";

const SITE_URL = "https://pastpaperprep.com";

// Paper pages carry the search value; their PDF route only costs a function call and an R2 read per crawl.
const DISALLOW = ["/api/", "/past-papers/*/*/document"];

/**
 * AI search and assistant crawlers, named so their access is explicit. A crawler that finds its
 * own group ignores the "*" group, so each named group repeats the same disallow list.
 */
export const AI_CRAWLERS = [
  "meta-webindexer", "meta-externalfetcher",
  "OAI-SearchBot", "ChatGPT-User",
  "Claude-SearchBot", "Claude-User",
  "PerplexityBot", "Perplexity-User",
  "Applebot", "Bingbot", "DuckAssistBot",
] as const;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      { userAgent: [...AI_CRAWLERS], allow: "/", disallow: DISALLOW },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
