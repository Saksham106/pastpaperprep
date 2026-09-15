import { describe, expect, it } from "vitest";
import { BANK_CATALOG, getCatalogBank, getCatalogBanksForDisplay, isCatalogBankBillable } from "@/lib/catalog";

describe("canonical bank catalog", () => {
  it("contains every known bank once with stable identity and routes", () => {
    expect(BANK_CATALOG).toHaveLength(19);
    expect(new Set(BANK_CATALOG.map((bank) => bank.slug)).size).toBe(19);
    for (const bank of BANK_CATALOG) {
      expect(bank.subject).toBeTruthy();
      expect(bank.title).not.toMatch(/^Cambridge IGCSE |^International Baccalaureate /);
      expect(bank.route).toBe(`/banks/${bank.slug}`);
      expect(bank.questionCount).toBeGreaterThan(0);
      expect(bank.paperCount).toBeGreaterThan(0);
    }
  });

  it("fails closed for preview banks and omits them from enabled display", () => {
    const preview = getCatalogBank("ib-economics-hl");
    expect(preview?.localPreview).toBe(true);
    expect(isCatalogBankBillable(preview!)).toBe(false);
    expect(getCatalogBanksForDisplay({})).not.toContain(preview);
  });
});
