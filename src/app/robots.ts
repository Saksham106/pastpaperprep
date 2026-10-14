import type { MetadataRoute } from "next";

const SITE_URL = "https://pastpaperprep.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Paper pages carry the search value; their PDF route only costs a function call and an R2 read per crawl.
      disallow: ["/api/", "/past-papers/*/*/document"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
