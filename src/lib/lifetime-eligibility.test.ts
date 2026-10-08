import { describe, expect, it } from "vitest";
import { classifyLifetimeEligibility } from "@/lib/lifetime-eligibility";

const standard = { status: "active", cancel_at_period_end: false, cancel_at: null, pending_update: null, schedule: null, items: { data: [{ id: "si_1", quantity: 1, price: { id: "price_1", currency: "usd", recurring: { interval: "month" } } }] }, metadata: { user_id: "u1", product_id: "bank_igcse" } };

describe("lifetime eligibility", () => {
  it("offers conversion for one catalog-verified standard subscription without credit", () => {
    expect(classifyLifetimeEligibility({ entitlements: [], lifetimeOwned: false, subscriptions: [standard], customerOwned: true, catalogMatches: [true] })).toEqual({ state: "conversion_eligible", priceCents: 29900, currency: "usd", creditCents: 0, renewalStopsAfterPayment: true });
  });
  it("accepts canonical custom bundles of two through five and rejects mismatched selections", () => {
    for (const quantity of [2, 3, 4, 5]) {
      const ids = Array.from({ length: quantity }, (_, i) => `bank-${i}`);
      const custom = { ...standard, metadata: { product_id: "bundle_custom", selected_bank_ids: JSON.stringify(ids) }, items: { data: [{ ...standard.items.data[0], quantity }] } };
      expect(classifyLifetimeEligibility({ entitlements: [], lifetimeOwned: false, subscriptions: [custom], customerOwned: true, catalogMatches: [true] }).state).toBe("conversion_eligible");
      expect(classifyLifetimeEligibility({ entitlements: [], lifetimeOwned: false, subscriptions: [{ ...custom, metadata: { ...custom.metadata, selected_bank_ids: JSON.stringify(ids.slice(1)) } }], customerOwned: true, catalogMatches: [true] }).state).toBe("billing_support");
    }
  });
  it("does not treat expired manual entitlements as current coverage", () => {
    expect(classifyLifetimeEligibility({ entitlements: [{ source: "manual", status: "active", startsAt: "2020-01-01T00:00:00Z", expiresAt: "2020-01-02T00:00:00Z" }], lifetimeOwned: false, subscriptions: [], customerOwned: true, catalogMatches: [] }).state).toBe("eligible");
  });
  it("preserves free checkout eligibility", () => {
    expect(classifyLifetimeEligibility({ entitlements: [], lifetimeOwned: false, subscriptions: [], customerOwned: true, catalogMatches: [] }).state).toBe("eligible");
  });
  it("fails closed for scheduled or stacked subscriptions", () => {
    expect(classifyLifetimeEligibility({ entitlements: [], lifetimeOwned: false, subscriptions: [{ ...standard, schedule: "sched_1" }], customerOwned: true, catalogMatches: [true] }).state).toBe("billing_support");
    expect(classifyLifetimeEligibility({ entitlements: [], lifetimeOwned: false, subscriptions: [standard, standard], customerOwned: true, catalogMatches: [true, true] }).state).toBe("billing_support");
  });
  it("does not sell to accounts already covered by lifetime or complimentary access", () => {
    expect(classifyLifetimeEligibility({ entitlements: [{ source: "manual", status: "active" }], lifetimeOwned: false, subscriptions: [], customerOwned: true, catalogMatches: [] }).state).toBe("covered");
    expect(classifyLifetimeEligibility({ entitlements: [], lifetimeOwned: true, subscriptions: [], customerOwned: true, catalogMatches: [] }).state).toBe("covered");
  });
});
