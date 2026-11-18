import { describe, expect, it } from "vitest";
import available from "@/data/explanations/available.json";
import { BANK_CATALOG } from "@/lib/catalog";

/**
 * Articles say every IGCSE and IB question has a worked explanation (free-access-section.ts and the guides).
 * If one of those banks ships, or gains questions, without full explanation coverage, this fails: update the
 * article copy (or finish the explanations) before publishing.
 *
 * Named exemptions only. Each launched with partial explanations by an explicit owner decision, and no article
 * may claim full coverage for it (checked below). Remove the entry once its explanations are complete.
 */
export const PARTIAL_EXPLANATION_BANKS: Readonly<Record<string, string>> = {
  // Owner, 2026-11-17: "We don't need to do all the explanations… upload and publish all the classifications
  // first and then work on explanations later if people are actually using and buying the banks."
  "a-level-maths-9709": "A Level Maths 9709 launches with explanation batch 1 only (owner decision 2026-11-17).",
  // Owner, 2026-11-17 (9702 plan): explanations are not a launch blocker; they come later if the bank is used.
  "a-level-physics-9702": "A Level Physics 9702 launches without explanations (owner decision 2026-11-17).",
  // Owner decision carried into the 9701 plan (2026-11-18): the Physics rule applies to the sciences.
  "a-level-chemistry-9701": "A Level Chemistry 9701 launches without explanations (owner decision 2026-11-17, carried into the 9701 plan).",
};

describe("article claim: every IGCSE and IB question has a worked explanation", () => {
  it("holds for every bank in the catalogue except the named partial-coverage banks", () => {
    for (const bank of BANK_CATALOG) {
      if (PARTIAL_EXPLANATION_BANKS[bank.slug]) continue;
      if ("pendingStorage" in bank && bank.pendingStorage) continue;
      const explained = (available as Record<string, string[]>)[bank.slug]?.length ?? 0;
      expect(explained, `${bank.slug}: ${explained} explanations for ${bank.questionCount} questions`).toBe(bank.questionCount);
    }
  });

  it("exempts only real banks, and only while they are short of full coverage", () => {
    for (const slug of Object.keys(PARTIAL_EXPLANATION_BANKS)) {
      const bank = BANK_CATALOG.find((entry) => entry.slug === slug);
      expect(bank, `${slug} is not in the catalogue`).toBeDefined();
      const explained = (available as Record<string, string[]>)[slug]?.length ?? 0;
      expect(explained, `${slug} is fully explained: remove its exemption`).toBeLessThan(bank!.questionCount);
    }
  });
});

describe("article copy matches explanation coverage", () => {
  it("never hedges explanation coverage in a published article", async () => {
    const { ARTICLES } = await import("@/lib/articles");
    const hedge = /not every question has (?:one|a worked explanation)|has one yet|(?:many|some) (?:HL and SL )?questions (?:also )?(?:have|has|include)s? a (?:PastPaperPrep |published )?worked explanation|worked explanations? (?:on|for|cover) (?:many|available|published|supported)|explanations? where published/i;
    for (const article of ARTICLES) {
      const match = hedge.exec(JSON.stringify(article));
      expect(match?.[0], `${article.slug} hedges explanation coverage`).toBeUndefined();
    }
  });

  it("never claims full explanation coverage for a partial-coverage bank", async () => {
    const { ARTICLES } = await import("@/lib/articles");
    // A sentence that names A Level / 9709 and says every question is explained.
    const claim = /[^.]*(?:A Level|AS & A Level|9709)[^.]*(?:every|each) (?:\w+ )*question[^.]*explanation[^.]*|[^.]*(?:every|each) (?:\w+ )*question[^.]*explanation[^.]*(?:A Level|9709)[^.]*/i;
    for (const article of ARTICLES) {
      expect(claim.exec(JSON.stringify(article))?.[0], `${article.slug} claims full A Level explanation coverage`).toBeUndefined();
    }
    const { freeAccessSection } = await import("@/lib/article-clusters/free-access-section");
    expect(freeAccessSection([]).paragraphs.join(" ")).toContain("Every IGCSE and IB question has a worked explanation");
  });
});
