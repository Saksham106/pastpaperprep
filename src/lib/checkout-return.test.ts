import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { expectedPurchaseFromSession } from "@/lib/checkout-return";

const session = (overrides: Record<string, unknown> = {}, metadata: Record<string, string> = {}) => ({
  status: "complete", mode: "subscription", client_reference_id: "user-1",
  ...overrides,
  metadata: { user_id: "user-1", product_id: "bank_ib_sl", ...metadata },
});

describe("expectedPurchaseFromSession", () => {
  it("reads the product and banks this user's completed session bought", () => {
    expect(expectedPurchaseFromSession(session(), "user-1")).toEqual({ productId: "bank_ib_sl" });
    expect(expectedPurchaseFromSession(session({}, { product_id: "bundle_custom", selected_bank_ids: JSON.stringify(["igcse", "ib-sl"]) }), "user-1"))
      .toEqual({ productId: "bundle_custom", bankIds: ["ib-sl", "igcse"] });
    expect(expectedPurchaseFromSession(session({}, { product_id: "bundle_all" }), "user-1")).toEqual({ productId: "bundle_all" });
    expect(expectedPurchaseFromSession(session({ mode: "payment" }, { product_id: "lifetime_all_access", purchase_type: "lifetime" }), "user-1"))
      .toEqual({ productId: "lifetime_all_access" });
  });

  it("refuses sessions it cannot tie to this user's finished purchase", () => {
    expect(expectedPurchaseFromSession(session({ client_reference_id: "someone-else" }), "user-1")).toBeNull();
    expect(expectedPurchaseFromSession(session({}, { user_id: "someone-else" }), "user-1")).toBeNull();
    expect(expectedPurchaseFromSession(session({ status: "open" }), "user-1")).toBeNull();
    expect(expectedPurchaseFromSession(session({ mode: "payment" }, { product_id: "lifetime_all_access" }), "user-1")).toBeNull();
    expect(expectedPurchaseFromSession(session({}, { product_id: "bundle_custom", selected_bank_ids: "not json" }), "user-1")).toBeNull();
  });
});
