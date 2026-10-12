import { afterEach, describe, expect, it, vi } from "vitest";

const serverLog = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server-logs", () => ({ serverLog }));

import { fetchAccessEntitlements, mergeCustomBundleAccess } from "@/lib/custom-bundle-access";

const row = (product_id: string, source: string | null, overrides: Record<string, unknown> = {}) => ({
  product_id, source, status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: "2026-12-01T00:00:00Z", ...overrides,
});

afterEach(() => { vi.useRealTimers(); serverLog.mockReset(); });

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
    // Recovered retries are invisible to the page, so they are logged.
    expect(serverLog.mock.calls).toEqual([
      ["warn", "entitlement_read_retry", { attempt: 1, error_code: "PGRST303" }],
      ["info", "entitlement_read_recovered", { attempts: 2 }],
    ]);
  });

  it("recovers on the final allowed attempt when both reads initially reject the JWT", async () => {
    vi.useFakeTimers();
    const futureJwt = { code: "PGRST303", message: "JWT issued at future" };
    const query = vi.fn().mockResolvedValueOnce({ data: null, error: futureJwt })
      .mockResolvedValueOnce({ data: null, error: futureJwt })
      .mockResolvedValue({ data: [row("bank_igcse", "manual")], error: null });
    const rpc = vi.fn().mockResolvedValueOnce({ data: null, error: futureJwt })
      .mockResolvedValueOnce({ data: null, error: futureJwt })
      .mockResolvedValue({ data: [], error: null });
    const pending = fetchAccessEntitlements({ from: () => ({ select: () => ({ eq: query }) }), rpc }, "owner");
    await vi.runAllTimersAsync();
    expect((await pending).error).toBeNull();
    expect((await pending).rows).toHaveLength(1);
    expect(query).toHaveBeenCalledTimes(3);
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it("stops retrying immediately when the error changes after a clock rejection", async () => {
    vi.useFakeTimers();
    const denied = { code: "42501", message: "permission denied" };
    const query = vi.fn().mockResolvedValueOnce({ data: null, error: { code: "PGRST303", message: "JWT issued at future" } })
      .mockResolvedValue({ data: null, error: denied });
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const pending = fetchAccessEntitlements({ from: () => ({ select: () => ({ eq: query }) }), rpc }, "owner");
    await vi.runAllTimersAsync();
    expect(await pending).toEqual({ rows: [], error: denied });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("stops within the original budget even if a later replay might succeed", async () => {
    vi.useFakeTimers();
    const futureJwt = { code: "PGRST303", message: "JWT issued at future" };
    const query = vi.fn().mockResolvedValueOnce({ data: null, error: futureJwt })
      .mockResolvedValueOnce({ data: null, error: futureJwt })
      .mockResolvedValueOnce({ data: null, error: futureJwt })
      .mockResolvedValue({ data: [row("bank_igcse", "manual")], error: null });
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const start = Date.now();
    const pending = fetchAccessEntitlements({ from: () => ({ select: () => ({ eq: query }) }), rpc }, "owner");
    await vi.runAllTimersAsync();
    expect(await pending).toEqual({ rows: [], error: futureJwt });
    expect(Date.now() - start).toBe(3000);
    expect(query).toHaveBeenCalledTimes(3);
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(query).toHaveBeenLastCalledWith("user_id", "owner");
    expect(rpc).toHaveBeenLastCalledWith("get_custom_bundle_access", { p_user_id: "owner" });
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
    expect(serverLog).toHaveBeenLastCalledWith("error", "entitlement_read_failed", { attempts: 3, error_code: "PGRST303" });
  });

  it("does not retry an unrelated error when another parallel query has a future-issued JWT", async () => {
    const query = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST303", message: "JWT issued at future" } });
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "42501", message: "permission denied" } });
    const result = await fetchAccessEntitlements({ from: () => ({ select: () => ({ eq: query }) }), rpc }, "owner");
    expect(result.rows).toEqual([]);
    expect(result.error).toEqual({ code: "42501", message: "permission denied" });
    expect(query).toHaveBeenCalledTimes(1);
  });
  it("does not retry or offer clock recovery when the other read is malformed", async () => {
    vi.useFakeTimers();
    const query = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST303", message: "JWT issued at future" } });
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const pending = fetchAccessEntitlements({ from: () => ({ select: () => ({ eq: query }) }), rpc }, "owner");
    await vi.runAllTimersAsync();
    const result = await pending;
    expect(result.error).toEqual(new Error("Invalid billing access response"));
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
