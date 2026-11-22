import { describe, expect, it } from "vitest";
import { ARTICLES, getArticleIndexDetail } from "@/lib/articles";
import { articlesForBank } from "@/lib/article-links";
import { A_LEVEL_ARTICLES } from "@/lib/article-clusters/a-level-articles-2026-11";

const A_LEVEL_BANKS = ["a-level-maths-9709", "a-level-physics-9702", "a-level-chemistry-9701", "a-level-biology-9700", "a-level-economics-9708"] as const;

describe("A Level articles (2026-11-21)", () => {
  it("publishes every article as a Cambridge A Level guide", () => {
    for (const article of A_LEVEL_ARTICLES) {
      expect(ARTICLES.some((entry) => entry.slug === article.slug), article.slug).toBe(true);
      expect(getArticleIndexDetail(article.slug)?.exam, article.slug).toBe("Cambridge A Level");
    }
  });

  it("links every article from a bank page or another guide, so none is an orphan", () => {
    const fromBanks = new Set(A_LEVEL_BANKS.flatMap((slug) => articlesForBank(slug).map((link) => link.href)));
    const fromGuides = new Set(ARTICLES.flatMap((article) => [
      ...article.sections.flatMap((section) => section.links ?? []),
      ...article.relatedBanks,
    ].map((link) => link.href)));
    for (const article of A_LEVEL_ARTICLES) {
      const href = `/articles/${article.slug}`;
      expect(fromBanks.has(href) || fromGuides.has(href), `${article.slug} has no inbound link`).toBe(true);
    }
  });

  it("dates its competitor checks and never links the redirected GCE Guide address", () => {
    const comparisons = A_LEVEL_ARTICLES.filter((article) => article.sources?.some((source) => !source.href.includes("cambridgeinternational.org")));
    expect(comparisons.length).toBeGreaterThanOrEqual(3);
    for (const article of A_LEVEL_ARTICLES) {
      const hrefs = [...(article.sources ?? []), ...article.relatedBanks, ...article.sections.flatMap((section) => section.links ?? [])].map((link) => link.href);
      expect(hrefs.some((href) => href.includes("gceguide")), article.slug).toBe(false);
    }
    const best = A_LEVEL_ARTICLES.find((article) => article.slug === "best-cambridge-a-level-past-paper-websites")!;
    expect(best.comparison?.caption).toContain("21 November 2026");
  });

  it("keeps explanation claims to 9709 Pure 1 to 3", () => {
    const text = JSON.stringify(A_LEVEL_ARTICLES);
    expect(text).not.toMatch(/explanations? (?:for|on|in) (?:every|all) (?:A Level|9702|9701|9700|9708)/i);
    for (const match of text.matchAll(/[^.]*worked explanations?[^.]*/gi)) {
      if (/A Level|970[0-9]/.test(match[0])) expect(match[0], match[0]).toMatch(/Pure 1|Pure 2|Pure 3/);
    }
  });

  it("points MCQ links at a multiple-choice paper, and bank links only use topic and paper filters", () => {
    const links = A_LEVEL_ARTICLES.flatMap((article) => article.sections.flatMap((section) => section.links ?? []).map((link) => ({ ...link, slug: article.slug })));
    for (const link of links.filter((entry) => entry.href.startsWith("/banks/"))) {
      const url = new URL(link.href, "https://pastpaperprep.com");
      for (const key of url.searchParams.keys()) expect(["topic", "paper"], `${link.slug}: ${link.href}`).toContain(key);
      const paper = url.searchParams.get("paper");
      if (paper !== null) expect(paper, `${link.slug}: ${link.href}`).toMatch(/^[1-6]$/);
    }
    const mcq = links.filter((link) => /\bMCQs?\b/.test(link.label) && link.href.startsWith("/banks/a-level-economics-9708"));
    expect(mcq.length).toBeGreaterThan(0);
    for (const link of mcq) {
      const paper = new URL(link.href, "https://pastpaperprep.com").searchParams.get("paper");
      expect(["1", "3"], `${link.slug}: ${link.href} should open a multiple-choice paper`).toContain(paper);
    }
  });
});
