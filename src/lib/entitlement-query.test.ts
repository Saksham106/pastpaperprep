import { describe, expect, it } from "vitest";
import { requireEntitlementRows } from "@/lib/entitlement-query";

describe("entitlement query handling", () => {
  it("fails closed instead of turning query errors into unpaid state", () => {
    expect(() => requireEntitlementRows({ data: null, error: new Error("database unavailable") }))
      .toThrow("Unable to verify current access");
  });

  it("returns verified rows", () => {
    const rows = [{ product_id: "bundle_all", status: "active", starts_at: null, expires_at: null }];
    expect(requireEntitlementRows({ data: rows, error: null })).toBe(rows);
  });
});