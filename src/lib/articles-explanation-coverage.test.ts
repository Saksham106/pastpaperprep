import { describe, expect, it } from "vitest";
import available from "@/data/explanations/available.json";
import { BANK_CATALOG } from "@/lib/catalog";

/**
 * Articles say "every question has a worked explanation" (free-access-section.ts and the guides).
 * If a bank ships, or gains questions, without full explanation coverage, this fails: update the
 * article copy (or finish the explanations) before publishing. A bank staged with pendingStorage
 * ships nowhere yet; it joins this check the moment pendingStorage comes off.
 */
describe("article claim: every question has a worked explanation", () => {
  it("holds for every bank in the catalogue", () => {
    for (const bank of BANK_CATALOG) {
      if ("pendingStorage" in bank && bank.pendingStorage) continue;
      const explained = (available as Record<string, string[]>)[bank.slug]?.length ?? 0;
      expect(explained, `${bank.slug}: ${explained} explanations for ${bank.questionCount} questions`).toBe(bank.questionCount);
    }
  });
});

describe("article copy matches full explanation coverage", () => {
  it("never hedges explanation coverage in a published article", async () => {
    const { ARTICLES } = await import("@/lib/articles");
    const hedge = /not every question has (?:one|a worked explanation)|has one yet|(?:many|some) (?:HL and SL )?questions (?:also )?(?:have|has|include)s? a (?:PastPaperPrep |published )?worked explanation|worked explanations? (?:on|for|cover) (?:many|available|published|supported)|explanations? where published/i;
    for (const article of ARTICLES) {
      const match = hedge.exec(JSON.stringify(article));
      expect(match?.[0], `${article.slug} hedges explanation coverage`).toBeUndefined();
    }
  });
});
