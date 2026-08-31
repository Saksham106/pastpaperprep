import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { ARTICLES } from "@/lib/articles";
import { BANKS } from "@/lib/banks";

describe("search crawler routes", () => {
  it("publishes the sitemap, blocks API crawling, and lets crawlers see private-page noindex metadata", () => {
    const result = robots();

    expect(result.sitemap).toBe("https://pastpaperprep.com/sitemap.xml");
    expect(result.host).toBe("https://pastpaperprep.com");
    expect(result.rules).toEqual({
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    });
  });

  it("lists every canonical public landing page without fake freshness signals", () => {
    const entries = sitemap();
    const urls = entries.map(({ url }) => url);

    expect(urls).toContain("https://pastpaperprep.com");
    expect(urls).toContain("https://pastpaperprep.com/pricing");
    expect(urls).toContain("https://pastpaperprep.com/articles");
    for (const bank of BANKS) {
      expect(urls).toContain(`https://pastpaperprep.com/banks/${bank.slug}`);
    }
    for (const article of ARTICLES) {
      const entry = entries.find(({ url }) => url === `https://pastpaperprep.com/articles/${article.slug}`);
      expect(entry).toBeDefined();
      expect(entry?.lastModified).toBe(article.updatedAt);
    }
    expect(new Set(urls).size).toBe(urls.length);
    expect(entries.filter(({ url }) => !url.includes("/articles/")).every((entry) => entry.lastModified === undefined)).toBe(true);
    expect(entries.every((entry) => entry.changeFrequency === undefined)).toBe(true);
    expect(entries.every((entry) => entry.priority === undefined)).toBe(true);
  });
});
