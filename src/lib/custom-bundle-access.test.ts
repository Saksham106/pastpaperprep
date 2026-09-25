import { describe, expect, it } from "vitest";
import { fetchAccessEntitlements, mergeCustomBundleAccess } from "@/lib/custom-bundle-access";

const row = (product_id: string, source: string | null, overrides: Record<string, unknown> = {}) => ({
  product_id, source, status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: "2026-12-01T00:00:00Z", ...overrides,
});

describe("per-subscription custom bundle access", () => {
  it("keeps independent expiries for two disjoint subscriptions", () => {
    const result = mergeCustomBundleAccess(
      [row("bundle_custom", "stripe", { selected_bank_ids: ["ib-sl"] })],
      [
        row("bundle_custom", null, { selected_bank_ids: ["ib-sl"], expires_at: "2026-06-01T00:00:00Z" }),
        row("bundle_custom", null, { selected_bank_ids: ["ib-hl"], expires_at: "2026-12-01T00:00:00Z" }),
      ],
    );
    expect(result).toHaveLength(2);
    expect(result[0].expiresAt).toBe("2026-06-01T00:00:00Z");
    expect(result[1].expiresAt).toBe("2026-12-01T00:00:00Z");
  });

  it("ignores stale Stripe projections but preserves manual grants", () => {
    const result = mergeCustomBundleAccess(
      [row("bundle_custom", "stripe"), row("bundle_custom", "manual", { selected_bank_ids: ["ib-ai-hl"] })],
      [row("bundle_custom", null, { selected_bank_ids: ["ib-sl"] })],
    );
    expect(result.map((grant) => grant.selectedBankIds)).toEqual([["ib-ai-hl"], ["ib-sl"]]);
  });

  it("retains cancellation status from the subscription RPC", () => {
    const result = mergeCustomBundleAccess([], [row("bundle_custom", null, { status: "canceled", selected_bank_ids: ["ib-sl"] })]);
    expect(result[0].status).toBe("revoked");
  });

  it("fails closed when the subscription RPC has an invalid response shape", async () => {
    const result = await fetchAccessEntitlements({
      from: () => ({ select: () => ({ eq: async () => ({ data: [], error: null }) }) }),
      rpc: async () => ({ data: true as never, error: null }),
    }, "owner");
    expect(result.error).toBeInstanceOf(Error);
    expect(result.rows).toEqual([]);
  });
});
