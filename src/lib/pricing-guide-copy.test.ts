import { describe, expect, it } from "vitest";
import { getArticle } from "@/lib/articles";
import { LIFETIME_OFFER } from "@/lib/lifetime-offer";
import { formatPrice, PRICING_MODEL, priceForBankCount } from "@/lib/pricing-model";

describe("pricing guide Lifetime comparison", () => {
  const text = getArticle("pastpaperprep-pricing-which-plan")!.sections.flatMap(({ paragraphs }) => paragraphs).join(" ");
  const twoYears = (banks: number) => 2 * priceForBankCount("annual", banks);

  it("quotes two annual terms for every bundle size from the price model", () => {
    const quoted = [1, 2, 3, 4, 5].map((banks) => formatPrice(twoYears(banks)));
    for (const price of [...quoted, formatPrice(twoYears(PRICING_MODEL.allAccess.minBanks))]) expect(text).toContain(price);
  });

  it("says Lifetime wins only where the arithmetic says it does", () => {
    const lifetime = LIFETIME_OFFER.amountCents;
    expect(twoYears(3)).toBeLessThan(lifetime);
    expect(twoYears(4)).toBeGreaterThan(lifetime);
    expect(3 * priceForBankCount("annual", 3)).toBeGreaterThan(lifetime);
    expect(12 * priceForBankCount("monthly", PRICING_MODEL.allAccess.minBanks)).toBeGreaterThan(lifetime);
    expect(text).toContain("Lifetime saves money only once the yearly plan you need would total more than $299");
  });
});
