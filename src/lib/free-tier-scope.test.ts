import { describe, expect, it } from "vitest";
import { hasFreeTier } from "@/lib/access";
import { getArticle } from "@/lib/articles";
import { getCatalogBanksForDisplay } from "@/lib/catalog";
import { FAQS } from "@/components/FaqContent";
import { freeTierScope } from "@/lib/free-tier-scope";

describe("free-tier copy follows the access policy", () => {
  const banks = getCatalogBanksForDisplay({ ...process.env, PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS: "true", PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED: "true" });

  it("names the banks without free years instead of promising every bank", () => {
    const withoutFree = banks.filter((bank) => !hasFreeTier(bank.slug));
    const scope = freeTierScope(banks);
    if (withoutFree.length === 0) expect(scope).toBe("every bank");
    else for (const subject of new Set(withoutFree.map((bank) => bank.subject))) expect(scope).toContain(subject);
    expect(freeTierScope(banks.filter((bank) => hasFreeTier(bank.slug)))).toBe("every bank");
  });

  it("keeps the FAQ and the pricing guide in step with the policy", () => {
    const cost = FAQS.find(({ question }) => question === "How much does PastPaperPrep cost?")!;
    expect(cost.answer).toContain(`free exam years in ${freeTierScope(getCatalogBanksForDisplay())}`);
    const guide = getArticle("pastpaperprep-pricing-which-plan")!.sections.flatMap(({ paragraphs }) => paragraphs).join(" ");
    const csHasFree = banks.some((bank) => bank.subject === "Computer Science" && hasFreeTier(bank.slug));
    expect(guide.includes("Every topic bank except Computer Science also has free exam years")).toBe(!csHasFree);
  });
});
