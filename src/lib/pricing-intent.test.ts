import { afterEach, describe, expect, it } from "vitest";
import { parsePricingAccount } from "@/lib/pricing-account";
import { parsePricingIntent, PRICING_INTENT_HINT_SCRIPT } from "@/lib/pricing-intent";

const banks = [{ slug: "igcse" }, { slug: "ib-sl" }, { slug: "ib-hl" }] as const;
const intent = (search: string) => parsePricingIntent(new URLSearchParams(search), banks);

describe("parsePricingIntent", () => {
  it("defaults to the plain monthly grid", () => {
    expect(intent("")).toEqual({ initialInterval: "monthly", initialLifetimeSelected: false, initialProductId: undefined, initialBankIds: undefined, addOnIntent: false, source: undefined, checkoutStatus: undefined });
  });

  it("keeps only allowlisted products, available banks and known placements", () => {
    expect(intent("?product=bank_evil&banks=igcse,nope,igcse,ib-sl&from=email&interval=weekly")).toMatchObject({ initialProductId: undefined, initialBankIds: ["igcse", "ib-sl"], addOnIntent: true, source: undefined, initialInterval: "monthly" });
    expect(intent("?product=bank_igcse&from=locked_card&interval=annual&checkout=cancelled")).toMatchObject({ initialProductId: "bank_igcse", source: "locked_card", initialInterval: "annual", checkoutStatus: "cancelled", addOnIntent: true });
    expect(intent("?plan=lifetime")).toMatchObject({ initialLifetimeSelected: true, addOnIntent: false });
  });
});

describe("PRICING_INTENT_HINT_SCRIPT", () => {
  afterEach(() => { delete document.documentElement.dataset.pricingIntent; window.history.replaceState(null, "", "/"); });
  const run = (search: string) => { window.history.replaceState(null, "", `/pricing${search}`); new Function(PRICING_INTENT_HINT_SCRIPT)(); return document.documentElement.dataset.pricingIntent; };

  it("flags URLs that change the first screen", () => {
    for (const search of ["?interval=annual", "?plan=lifetime", "?product=bank_igcse", "?banks=igcse,ib-sl"]) {
      delete document.documentElement.dataset.pricingIntent;
      expect(run(search), search).toBe("1");
    }
  });

  it("leaves the CDN default visible for plain, monthly, tracking-only and cancel-only URLs", () => {
    for (const search of ["", "?interval=monthly", "?from=dashboard", "?checkout=cancelled", "?utm_source=x"]) expect(run(search), search).toBeUndefined();
  });
});

describe("parsePricingAccount", () => {
  const valid = { authenticated: true, hasPaidAccess: true, ownedBankIds: ["ib-sl"], currentPlanNames: ["IB Mathematics AA SL"], currentPlanProductIds: ["bank_ib_sl"], complimentaryAccess: false, manualAccess: false };

  it("accepts the API's shape", () => {
    expect(parsePricingAccount(valid)).toEqual(valid);
  });

  it("rejects anything malformed instead of guessing access", () => {
    for (const body of [null, [], "x", { ...valid, hasPaidAccess: "yes" }, { ...valid, ownedBankIds: [1] }, { ...valid, currentPlanProductIds: ["Bank IB"] }, { error: "access_check_delayed" }]) {
      expect(parsePricingAccount(body)).toBeNull();
    }
  });
});
