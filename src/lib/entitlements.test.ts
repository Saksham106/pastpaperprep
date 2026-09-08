import { describe, expect, it } from "vitest";
import { normalizeEntitlements } from "@/lib/entitlements";

describe("entitlement row normalization", () => {
  it("keeps only known products and valid statuses", () => {
    expect(normalizeEntitlements([
      { product_id: "bank_ib_sl", status: "active", starts_at: "2026-08-01T00:00:00Z", expires_at: null },
      { product_id: "bank_igcse_additional", status: "active", starts_at: "2026-08-01T00:00:00Z", expires_at: null },
      { product_id: "bundle_all", status: "trialing", starts_at: "2026-08-01T00:00:00Z", expires_at: "2026-09-01T00:00:00Z" },
      { product_id: "bundle_ib_aa", status: "active", starts_at: "2026-08-01T00:00:00Z", expires_at: null },
      { product_id: "bank_ib_physics_hl", status: "active", starts_at: "2026-08-01T00:00:00Z", expires_at: null },
      { product_id: "bundle_ib_physics", status: "active", starts_at: "2026-08-01T00:00:00Z", expires_at: null },
      { product_id: "bundle_custom", selected_bank_ids: ["ib-sl", "igcse"], status: "active", starts_at: "2026-08-01T00:00:00Z", expires_at: null },
      { product_id: "bank_ib_hl", status: "active", starts_at: "not-a-date", expires_at: null },
      { product_id: "admin", status: "active", expires_at: null },
      { product_id: "bank_ib_hl", status: "pending", expires_at: null },
    ])).toEqual([
      { productId: "bank_ib_sl", status: "active", startsAt: "2026-08-01T00:00:00Z", expiresAt: null },
      { productId: "bank_igcse_additional", status: "active", startsAt: "2026-08-01T00:00:00Z", expiresAt: null },
      { productId: "bundle_all", status: "trialing", startsAt: "2026-08-01T00:00:00Z", expiresAt: "2026-09-01T00:00:00Z" },
      { productId: "bundle_ib_aa", status: "active", startsAt: "2026-08-01T00:00:00Z", expiresAt: null },
      { productId: "bank_ib_physics_hl", status: "active", startsAt: "2026-08-01T00:00:00Z", expiresAt: null },
      { productId: "bundle_ib_physics", status: "active", startsAt: "2026-08-01T00:00:00Z", expiresAt: null },
      { productId: "bundle_custom", selectedBankIds: ["ib-sl", "igcse"], status: "active", startsAt: "2026-08-01T00:00:00Z", expiresAt: null },
    ]);
  });

  it("fails closed when a custom bundle has invalid selected banks", () => {
    expect(normalizeEntitlements([
      { product_id: "bundle_custom", selected_bank_ids: ["igcse", "igcse"], status: "active", starts_at: "2026-08-01T00:00:00Z", expires_at: null },
      { product_id: "bundle_custom", selected_bank_ids: ["unknown"], status: "active", starts_at: "2026-08-01T00:00:00Z", expires_at: null },
      { product_id: "bundle_custom", status: "active", starts_at: "2026-08-01T00:00:00Z", expires_at: null },
    ])).toEqual([]);
  });
});
