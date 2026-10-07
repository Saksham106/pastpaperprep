import { describe, expect, it } from "vitest";
import { LIFETIME_OFFER, lifetimeCheckoutMetadataIsValid } from "@/lib/lifetime-offer";

describe("lifetime offer contract", () => {
  it("defines a one-time USD 299 All Access offer", () => {
    expect(LIFETIME_OFFER).toEqual({ amountCents: 29900, currency: "usd", productId: "lifetime_all_access" });
  });
  it("rejects malformed, mismatched, and subscription checkout metadata", () => {
    expect(lifetimeCheckoutMetadataIsValid({ user_id: "user-1", product_id: "lifetime_all_access", purchase_type: "lifetime" }, "user-1")).toBe(true);
    expect(lifetimeCheckoutMetadataIsValid({ user_id: "user-2", product_id: "lifetime_all_access", purchase_type: "lifetime" }, "user-1")).toBe(false);
    expect(lifetimeCheckoutMetadataIsValid({ user_id: "user-1", product_id: "bundle_all", purchase_type: "lifetime" }, "user-1")).toBe(false);
    expect(lifetimeCheckoutMetadataIsValid(null, "user-1")).toBe(false);
  });
});
