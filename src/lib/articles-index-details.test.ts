import { describe, expect, it } from "vitest";
import { ALL_ARTICLES, ARTICLES, ARTICLE_INDEX_DETAILS, getArticleIndexDetail } from "@/lib/articles";
import { BANK_CATALOG, getCatalogBank } from "@/lib/catalog";
import { loadBankQuestions } from "@/lib/question-fixtures";

const DIFFICULTIES = new Set(["Foundational", "Intermediate", "Advanced"]);

function parsePracticeHref(href: string): { slug: string; topic: string | null } {
  const match = /^\/banks\/([a-z0-9-]+)(?:\?topic=([^&]+))?$/.exec(href);
  if (!match) throw new Error(`Practice link is not a bank route with an optional topic: ${href}`);
  return { slug: match[1], topic: match[2] ? decodeURIComponent(match[2]) : null };
}

describe("articles index enrichment", () => {
  it("enriches every published article with structured difficulty, exam, and read time", () => {
    expect(ARTICLES.length).toBeGreaterThan(0);
    for (const article of ARTICLES) {
      const detail = getArticleIndexDetail(article.slug);
      expect(detail, `missing index detail for ${article.slug}`).toBeDefined();
      expect(DIFFICULTIES.has(detail!.difficulty)).toBe(true);
      expect(["Cambridge IGCSE", "IB Diploma"]).toContain(detail!.exam);
      expect(article.readingMinutes).toBeGreaterThan(0);
      expect(detail!.practiceLinks.length).toBeGreaterThan(0);
    }
  });

  it("keeps exactly one detail entry per published article, with no orphans", () => {
    const published = new Set(ARTICLES.map((article) => article.slug));
    const known = new Set(ALL_ARTICLES.map((article) => article.slug));
    for (const slug of Object.keys(ARTICLE_INDEX_DETAILS)) {
      expect(known.has(slug), `detail entry references an unknown article: ${slug}`).toBe(true);
    }
    for (const slug of published) expect(ARTICLE_INDEX_DETAILS[slug], `missing detail for published ${slug}`).toBeDefined();
    // Drafts are enriched ahead of publication; the published set must be fully covered.
    expect([...published].every((slug) => slug in ARTICLE_INDEX_DETAILS)).toBe(true);
  });

  it("never invents an article count or a route", () => {
    expect(ARTICLES.every((article) => /^[a-z0-9-]+$/.test(article.slug))).toBe(true);
    expect(new Set(ARTICLES.map((article) => article.slug)).size).toBe(ARTICLES.length);
    for (const detail of Object.values(ARTICLE_INDEX_DETAILS)) {
      for (const link of detail.practiceLinks) {
        const { slug } = parsePracticeHref(link.href);
        expect(getCatalogBank(slug), `unknown bank in a practice link: ${link.href}`).toBeDefined();
        expect(BANK_CATALOG.some((bank) => bank.slug === slug)).toBe(true);
      }
    }
  });

  it("points every 'Practice this topic' link at a topic the bank's own runtime exposes", async () => {
    const topicsByBank = new Map<string, Set<string>>();
    for (const detail of Object.values(ARTICLE_INDEX_DETAILS)) {
      for (const link of detail.practiceLinks) {
        const { slug, topic } = parsePracticeHref(link.href);
        if (!topic) continue;
        if (!topicsByBank.has(slug)) {
          const questions = loadBankQuestions(slug as never);
          topicsByBank.set(slug, new Set(questions.flatMap((question) => [question.primaryTopic, ...question.secondaryTopics])));
        }
        expect(topicsByBank.get(slug)!.has(topic), `${slug} does not expose topic "${topic}"`).toBe(true);
      }
    }
    expect(topicsByBank.size).toBeGreaterThan(0);
  }, 60_000);

  it("labels the index practice links with the bank and topic they open", () => {
    for (const [slug, detail] of Object.entries(ARTICLE_INDEX_DETAILS)) {
      for (const link of detail.practiceLinks) {
        expect(link.label.length).toBeGreaterThan(0);
        expect(link.label).not.toMatch(/\d{4}\s*$/);
      }
      expect(detail.practiceLinks.length).toBeGreaterThanOrEqual(1);
      expect(slug).toBe(slug.trim());
    }
  });
});
