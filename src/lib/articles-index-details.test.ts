import { describe, expect, it } from "vitest";
import { ALL_ARTICLES, ARTICLES, ARTICLE_INDEX_DETAILS, getArticleIndexDetail } from "@/lib/articles";
import { BANK_CATALOG, getCatalogBank } from "@/lib/catalog";
import { loadBankQuestions } from "@/lib/question-fixtures";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
          const privateDataFiles: Record<string, string> = {
            "igcse-biology-0610": "src/data/production/igcse-biology-0610.json",
            "igcse-economics-0455": "src/data/production/igcse-economics-0455.json",
            "igcse-chemistry-0620": "src/data/production/igcse-chemistry-0620.json",
            "igcse-physics-0625": "src/data/production/igcse-physics-0625.json",
            "igcse-coordinated-sciences-0654": "src/data/production/igcse-coordinated-sciences-0654.json",
          };
          const topicLabels = privateDataFiles[slug]
            ? JSON.parse(readFileSync(resolve(process.cwd(), privateDataFiles[slug]), "utf8")).questions.flatMap((question: { primaryTopic: string; secondaryTopics?: string[] }) => [question.primaryTopic, ...(question.secondaryTopics ?? [])])
            : loadBankQuestions(slug as never).flatMap((question) => [question.primaryTopic, ...question.secondaryTopics]);
          topicsByBank.set(slug, new Set(topicLabels));
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
  it("keeps the 2026 and 2027 Economics AO comparisons source-correct and cross-linked", () => {
    const guide = ALL_ARTICLES.find((article) => article.slug === "economics-0455-2027-syllabus-changes-practice-plan")!;
    const body = [guide.answer, ...guide.sections.flatMap((section) => section.paragraphs)].join(" ");
    expect(body).toContain("2026 syllabus allocates 40%, 40%, and 20%");
    expect(body).toContain("AO2 analysis rises from 40% to 47%");
    expect(body).toContain("AO3 evaluation decreases from 20% to 10%");
    expect(body).not.toContain("prior syllabus allocated 40%, 50%, and 10%");
    expect(guide.sources?.some((source) => source.href === "https://www.cambridgeinternational.org/Images/718148-2027-2029-syllabus.pdf")).toBe(true);

    const existing = ALL_ARTICLES.find((article) => article.slug === "best-igcse-economics-0455-question-banks")!;
    expect(existing.sections.flatMap((section) => section.paragraphs).join(" ")).toContain("This does not change the 2026 timings");
    expect(existing.relatedBanks?.some((link) => link.href === `/articles/${guide.slug}`)).toBe(true);
  });

  it("links the existing subject articles to the relevant new practice guides", () => {
    const expectations: Record<string, string> = {
      "best-igcse-biology-0610-question-banks": "biology-0610-paper-6-graphs-data-practice",
      "best-igcse-coordinated-sciences-0654-question-banks": "cambridge-science-0654-vs-0653-paper-practice",
      "best-igcse-economics-0455-question-banks": "economics-0455-2027-syllabus-changes-practice-plan",
      "best-igcse-chemistry-0620-question-banks": "cambridge-science-0654-vs-0653-paper-practice",
      "best-igcse-physics-0625-question-banks": "cambridge-science-0654-vs-0653-paper-practice",
      "best-ib-chemistry-question-banks": "ib-science-past-papers-current-course-compatibility",
      "best-ib-physics-question-banks": "ib-science-past-papers-current-course-compatibility",
      "best-ib-biology-question-banks": "ib-science-past-papers-current-course-compatibility",
    };
    for (const [existingSlug, guideSlug] of Object.entries(expectations)) {
      const article = ALL_ARTICLES.find((candidate) => candidate.slug === existingSlug)!;
      expect(article.relatedBanks?.some((link) => link.href === `/articles/${guideSlug}`), `${existingSlug} should link to ${guideSlug}`).toBe(true);
    }
  });
});
