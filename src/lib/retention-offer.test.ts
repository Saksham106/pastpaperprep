import { describe, expect, it } from "vitest";
import { acceptedDiscountRecently, chooseRetentionOffer, isRetentionHoldout, planShapeFromMetadata, predictCancelReason } from "./retention-offer";

const now = new Date("2026-11-26T00:00:00Z");
const base = { reason: null, plan: "single" as const, interval: "monthly" as const, discountEligible: true, holdout: false, lastActivityAt: null, now };

describe("retention offer", () => {
  it("maps each reason to at most one offer", () => {
    expect(chooseRetentionOffer({ ...base, reason: "too_expensive" }).offer).toEqual({ kind: "discount", percentOff: 30 });
    expect(chooseRetentionOffer({ ...base, reason: "too_expensive", interval: "annual" }).offer).toBeNull();
    expect(chooseRetentionOffer({ ...base, reason: "too_expensive", interval: "annual", plan: "builder" }).offer).toEqual({ kind: "fewer_banks" });
    expect(chooseRetentionOffer({ ...base, reason: "too_expensive", discountEligible: false, plan: "all" }).offer).toEqual({ kind: "fewer_banks" });
    expect(chooseRetentionOffer({ ...base, reason: "not_studying", plan: "all" }).offer).toEqual({ kind: "fewer_banks" });
    expect(chooseRetentionOffer({ ...base, reason: "not_studying" }).offer).toBeNull();
    expect(chooseRetentionOffer({ ...base, reason: "missing_subject" }).offer).toEqual({ kind: "updates" });
  });
  it("predicts a reason when the student skips or picks something else", () => {
    const old = new Date("2026-09-01T00:00:00Z");
    expect(chooseRetentionOffer({ ...base, reason: "other", lastActivityAt: old, plan: "builder" })).toMatchObject({ basis: "not_studying", predicted: true, offer: { kind: "fewer_banks" } });
    expect(chooseRetentionOffer({ ...base, lastActivityAt: new Date("2026-11-20T00:00:00Z") })).toMatchObject({ basis: "too_expensive", predicted: true, offer: { kind: "discount" } });
    expect(predictCancelReason(null, now)).toBe("too_expensive");
    expect(predictCancelReason(new Date("invalid"), now)).toBe("too_expensive");
  });
  it("hides the offer from the holdout but keeps what it qualified for", () => {
    expect(chooseRetentionOffer({ ...base, reason: "too_expensive", holdout: true })).toMatchObject({ offer: null, eligibleOffer: { kind: "discount" }, holdout: true });
  });
  it("splits accounts roughly in half, stably", () => {
    const ids = Array.from({ length: 2000 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
    const share = ids.filter(isRetentionHoldout).length / ids.length;
    expect(share).toBeGreaterThan(0.45); expect(share).toBeLessThan(0.55);
    expect(isRetentionHoldout(ids[7])).toBe(isRetentionHoldout(ids[7]));
  });
  it("enforces the 12-month cooldown and fails closed on an unreadable marker", () => {
    expect(acceptedDiscountRecently([{ metadata: { retention_offer_accepted_at: "2026-06-01T00:00:00Z" } }], now)).toBe(true);
    expect(acceptedDiscountRecently([{ metadata: { retention_offer_accepted_at: "2025-06-01T00:00:00Z" } }], now)).toBe(false);
    expect(acceptedDiscountRecently([{ metadata: { retention_offer_accepted_at: "garbage" } }], now)).toBe(true);
    expect(acceptedDiscountRecently([{ metadata: {} }, { metadata: null }], now)).toBe(false);
  });
  it("reads the plan shape from subscription metadata", () => {
    expect(planShapeFromMetadata({ product_id: "bundle_all" })).toBe("all");
    expect(planShapeFromMetadata({ product_id: "bank_igcse" })).toBe("single");
    expect(planShapeFromMetadata({ product_id: "bundle_custom", selected_bank_ids: '["igcse"]' })).toBe("single");
    expect(planShapeFromMetadata({ product_id: "bundle_custom", selected_bank_ids: '["igcse","ib-hl"]' })).toBe("builder");
    expect(planShapeFromMetadata({ product_id: "bundle_custom", selected_bank_ids: "nope" })).toBeNull();
    expect(planShapeFromMetadata({ product_id: "bundle_ib_aa" })).toBe("builder");
    expect(planShapeFromMetadata({})).toBeNull();
  });
});
