import { describe, expect, it } from "vitest";
import { bankYearFacts, upgradeHref, UPGRADE_PRICE_LABEL, yearRangeLabel } from "@/lib/upgrade-copy";

describe("upgrade copy", () => {
  it("labels year runs with an en dash", () => {
    expect(yearRangeLabel([2016, 2017, 2018])).toBe("2016–2018");
    expect(yearRangeLabel([2017])).toBe("2017");
    expect(yearRangeLabel([2016, 2017, 2019])).toBe("2016–2017, 2019");
  });

  it("describes 0580 as old free years and newer paid years", () => {
    expect(bankYearFacts("igcse")).toMatchObject({ freeLabel: "2016–2018", newerPaidLabel: "2019–2026", latestYear: 2026 });
  });

  it("handles a single free year", () => {
    expect(bankYearFacts("ib-sl")).toMatchObject({ freeLabel: "2017", newerPaidLabel: "2018–2026" });
  });

  it("only counts paid years after the free year for IB sciences", () => {
    expect(bankYearFacts("ib-chemistry-hl")?.newerPaidLabel).toBe("2021–2025");
  });

  it("returns null for an unknown bank", () => {
    expect(bankYearFacts("nope")).toBeNull();
  });

  it("links to pricing with the bank preselected", () => {
    expect(upgradeHref("igcse")).toBe("/pricing?product=bank_igcse");
    expect(UPGRADE_PRICE_LABEL).toBe("$6/mo");
  });
});
