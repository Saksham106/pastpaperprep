import { describe, expect, it } from "vitest";
import available from "@/data/explanations/available.json";
import { BANK_CATALOG } from "@/lib/catalog";

/**
 * Articles say "every question has a worked explanation" (free-access-section.ts and the guides).
 * If a bank ships, or gains questions, without full explanation coverage, this fails: update the
 * article copy (or finish the explanations) before publishing.
 */
describe("article claim: every question has a worked explanation", () => {
  it("holds for every bank in the catalogue", () => {
    for (const bank of BANK_CATALOG) {
      const explained = (available as Record<string, string[]>)[bank.slug]?.length ?? 0;
      expect(explained, `${bank.slug}: ${explained} explanations for ${bank.questionCount} questions`).toBe(bank.questionCount);
    }
  });
});
