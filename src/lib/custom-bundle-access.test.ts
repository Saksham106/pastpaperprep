import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAccessEntitlements, mergeCustomBundleAccess } from "@/lib/custom-bundle-access";

const row = (product_id: string, source: string | null, overrides: Record<string, unknown> = {}) => ({
  product_id, source, status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: "2026-12-01T00:00:00Z", ...overrides,
});

afterEach(() => vi.useRealTimers());

describe("per-subscription custom bundle access", () => {
  it("retries only transient future-issued JWT failures before showing access", async () => {
    vi.useFakeTimers();
    const futureJwt = { code: "PGRST303", message: "JWT issued at future" };
    const query = vi.fn().mockResolvedValueOnce({ data: null, error: futureJwt }).mockResolvedValueOnce({ data: [row("bank_igcse", "manual")], error: null });
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const promise = fetchAccessEntitlements({ from: () => ({ select: () => ({ eq: query }) }), rpc }, "owner");
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.error).toBeNull();
    expect(result.rows).toHaveLength(1);
    expect(query).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("retries when only the subscription RPC has the future-issued JWT error", async () => {
    vi.useFakeTimers();
    const futureJwt = { code: "PGRST303", message: "JWT issued at future" };
    const query = vi.fn().mockResolvedValue({ data: [row("bank_igcse", "manual")], error: null });
    const rpc = vi.fn().mockResolvedValueOnce({ data: null, error: futureJwt }).mockResolvedValueOnce({ data: [], error: null });
    const promise = fetchAccessEntitlements({ from: () => ({ select: () => ({ eq: query }) }), rpc }, "owner");
    await vi.runAllTimersAsync();
    expect((await promise).rows).toHaveLength(1);
    expect(query).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("never retries unrelated access errors", async () => {
    const query = vi.fn().mockResolvedValue({ data: null, error: { code: "42501", message: "permission denied" } });
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const result = await fetchAccessEntitlements({ from: () => ({ select: () => ({ eq: query }) }), rpc }, "owner");
    expect(result.rows).toEqual([]);
    expect(result.error).toEqual({ code: "42501", message: "permission denied" });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the future-issued JWT error persists past the bounded retry", async () => {
    vi.useFakeTimers();
    const futureJwt = { code: "PGRST303", message: "JWT issued at future" };
    const query = vi.fn().mockResolvedValue({ data: null, error: futureJwt });
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const promise = fetchAccessEntitlements({ from: () => ({ select: () => ({ eq: query }) }), rpc }, "owner");
    await vi.runAllTimersAsync();
    expect(await promise).toEqual({ rows: [], error: futureJwt });
    expect(query).toHaveBeenCalledTimes(3);
  });

  it("does not retry an unrelated error when another parallel query has a future-issued JWT", async () => {
    const query = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST303", message: "JWT issued at future" } });
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "42501", message: "permission denied" } });
    const result = await fetchAccessEntitlements({ from: () => ({ select: () => ({ eq: query }) }), rpc }, "owner");
    expect(result.rows).toEqual([]);
    expect(query).toHaveBeenCalledTimes(1);
  });
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
