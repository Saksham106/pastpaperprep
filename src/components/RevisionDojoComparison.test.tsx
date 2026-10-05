import { describe, expect, it } from "vitest";
import { ALL_ARTICLES } from "@/lib/articles";

describe("RevisionDojo vs Revision Village article", () => {
  const article = ALL_ARTICLES.find(({ slug }) => slug === "revisiondojo-vs-revision-village");

  it("is an integrated, review-ready comparison with direct evidence and honest tradeoffs", () => {
    expect(article).toBeDefined();
    expect(article).toMatchObject({
      draft: false,
      title: "RevisionDojo vs Revision Village: Which Is Better for IB Practice?",
      publishedAt: "2026-10-05",
      updatedAt: "2026-10-05",
      answerLink: { href: "/#question-banks" },
      comparison: { headings: ["Dimension", "RevisionDojo", "Revision Village"] },
    });
    const text = JSON.stringify(article);
    expect(text).toContain("revisiondojo.com/help-center/whats-free");
    expect(text).toContain("revisionvillage.com/revision-village-gold");
    expect(text).toContain("10 question walkthroughs");
    expect(text).toContain("monthly-equivalent");
    expect(text).toContain("printable real-paper practice");
    expect(text).toContain("revision-village-pricing");
    expect(text).toContain("best-revision-village-alternatives");
    expect(article?.sections[0].heading).toMatch(/printable topic practice/i);
  });
});
