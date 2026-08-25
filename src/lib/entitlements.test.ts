import { describe, expect, it } from "vitest";
import { normalizeEntitlements } from "@/lib/entitlements";

describe("entitlement row normalization", () => {
  it("keeps only known products and valid statuses", () => {
    expect(normalizeEntitlements([
      { product_id: "bank_ib_sl", status: "active", starts_at: "2026-08-01T00:00:00Z", expires_at: null },
      { product_id: "bundle_all", status: "trialing", starts_at: null, expires_at: "2026-09-01T00:00:00Z" },
      { product_id: "bank_ib_hl", status: "active", starts_at: "not-a-date", expires_at: null },
      { product_id: "admin", status: "active", expires_at: null },
      { product_id: "bank_ib_hl", status: "pending", expires_at: null },
    ])).toEqual([
      { productId: "bank_ib_sl", status: "active", startsAt: "2026-08-01T00:00:00Z", expiresAt: null },
    ]);
  });

  it("fails closed for malformed rows", () => {
    expect(normalizeEntitlements([
      null,
      {},
      { product_id: 3, status: "active" },
      { product_id: "bank_ib_sl", status: "active", starts_at: 3, expires_at: null },
    ])).toEqual([]);
  });
});
