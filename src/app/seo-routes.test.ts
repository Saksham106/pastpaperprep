import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { ALL_ARTICLES, ARTICLES, isPublicArticle } from "@/lib/articles";
import { BANKS } from "@/lib/banks";
import { getLandingManifests, paperPath, topicPath } from "@/lib/search-landing";

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

  it("lists every canonical public landing page without fake freshness signals", async () => {
    const entries = await sitemap();
    const urls = entries.map(({ url }) => url);

    expect(urls).toContain("https://pastpaperprep.com");
    expect(urls).toContain("https://pastpaperprep.com/pricing");
    expect(urls).toContain("https://pastpaperprep.com/articles");
    expect(urls).toContain("https://pastpaperprep.com/faq");
    expect(urls).toContain("https://pastpaperprep.com/about");
    expect(urls).toContain("https://pastpaperprep.com/cambridge-igcse");
    expect(urls).toContain("https://pastpaperprep.com/ib");
    for (const bank of BANKS) {
      expect(urls).toContain(`https://pastpaperprep.com/banks/${bank.slug}`);
      expect(urls).toContain(`https://pastpaperprep.com/syllabus/${bank.slug}`);
    }
    for (const manifest of await getLandingManifests()) {
      for (const topic of manifest.topics) {
        expect(urls).toContain(`https://pastpaperprep.com${topicPath(manifest.bankSlug, topic)}`);
      }
      for (const paper of manifest.papers) {
        expect(urls).toContain(`https://pastpaperprep.com${paperPath(manifest.bankSlug, paper)}`);
      }
    }
    for (const article of ARTICLES) {
      const entry = entries.find(({ url }) => url === `https://pastpaperprep.com/articles/${article.slug}`);
      expect(entry).toBeDefined();
      expect(entry?.lastModified).toBe(article.updatedAt);
    }
    for (const draft of ALL_ARTICLES.filter((article) => !isPublicArticle(article))) {
      expect(urls).not.toContain(`https://pastpaperprep.com/articles/${draft.slug}`);
    }
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.every((url) => !url.includes("?"))).toBe(true);
    expect(entries.filter(({ url }) => !url.includes("/articles/")).every((entry) => entry.lastModified === undefined)).toBe(true);
    expect(entries.every((entry) => entry.changeFrequency === undefined)).toBe(true);
    expect(entries.every((entry) => entry.priority === undefined)).toBe(true);
  }, 30_000);
});
