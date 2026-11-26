import { describe, expect, it } from "vitest";
import { planUpgradeNudge } from "@/lib/plan-upgrade-nudge";

const step = (interval: "monthly" | "annual", count: number, sale: boolean) => {
  const nudge = planUpgradeNudge(interval, count, sale);
  return nudge && [nudge.nextCount, nudge.extraPerMonthCents, nudge.extraPerYearCents, nudge.unlocksPercentOff, nudge.toAllAccess];
};

describe("plan upgrade nudge", () => {
  it("prices one more bank per month on monthly plans", () => {
    expect([1, 2, 3, 4, 5].map((count) => step("monthly", count, false))).toEqual([
      [2, 400, null, null, false], [3, 400, null, null, false], [4, 400, null, null, false], [5, 400, null, null, false], [6, 300, null, null, true],
    ]);
  });

  it("shows annual steps as the yearly difference ÷ 12, with the yearly charge alongside", () => {
    expect([1, 2, 3, 4, 5].map((count) => step("annual", count, false))).toEqual([
      [2, 300, 3600, null, false], [3, 300, 3600, null, false], [4, 300, 3600, null, false], [5, 300, 3600, null, false], [6, 200, 2400, null, true],
    ]);
  });

  it("uses first-year sale prices and names the bigger discount a step unlocks", () => {
    expect([1, 2, 3, 4, 5].map((count) => step("annual", count, true))).toEqual([
      [2, 190, 2280, 30, false], [3, 210, 2520, null, false], [4, 145, 1740, 35, false], [5, 195, 2340, null, false], [6, 40, 480, 40, true],
    ]);
  });

  it("never discounts monthly, even during the sale", () => {
    expect(step("monthly", 3, true)).toEqual(step("monthly", 3, false));
  });

  it("has no step up from All Access or an empty selection", () => {
    expect(planUpgradeNudge("annual", 6, true)).toBeNull();
    expect(planUpgradeNudge("annual", 0, true)).toBeNull();
  });
});
