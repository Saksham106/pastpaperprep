import { beforeEach, describe, expect, it, vi } from "vitest";

const adminRpc = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: adminRpc }) }));

import { consumeHelperAllowance, releaseHelperAllowance } from "@/lib/helper/allowance";
import { withinBudget } from "@/lib/helper/context";

const client = (result: (name: string) => { data: unknown; error: { code?: string } | null }) => ({ rpc: vi.fn(async (name: string) => result(name)) });

describe("helper allowance", () => {
  beforeEach(() => adminRpc.mockReset().mockResolvedValue({ error: null }));

  it("returns the charged day from v2 and maps its statuses", async () => {
    expect(await consumeHelperAllowance(client(() => ({ data: { status: "ok", remaining: 3, usage_date: "2026-11-24" }, error: null })), 5))
      .toEqual({ status: "ok", charge: { remaining: 3, usageDate: "2026-11-24", version: 2 } });
    for (const status of ["limit", "busy", "disabled"]) {
      expect(await consumeHelperAllowance(client(() => ({ data: { status }, error: null })), 5)).toEqual({ status });
    }
    expect(await consumeHelperAllowance(client(() => ({ data: { status: "ok" }, error: null })), 5)).toEqual({ status: "error" });
    expect(await consumeHelperAllowance(client(() => ({ data: null, error: { code: "XX000" } })), 5)).toEqual({ status: "error" });
  });

  it("falls back to v1 only when v2 doesn't exist yet", async () => {
    const fallback = client((name) => name.endsWith("_v2") ? { data: null, error: { code: "PGRST202" } } : { data: -1, error: null });
    expect(await consumeHelperAllowance(fallback, 5)).toEqual({ status: "limit" });
  });

  it("refunds the day that was charged", async () => {
    await releaseHelperAllowance("u1", { remaining: 3, usageDate: "2026-11-24", version: 2 });
    expect(adminRpc).toHaveBeenCalledWith("release_helper_allowance_v2", { p_user_id: "u1", p_usage_date: "2026-11-24" });
  });
});

describe("crop budget", () => {
  it("keeps leading crops that fit and reports what is left", () => {
    expect(withinBudget(["aaaa", "bbbb", "cc"], 9)).toEqual({ kept: ["aaaa", "bbbb"], rest: 1 });
    expect(withinBudget(["aaaa"], 3)).toEqual({ kept: [], rest: 3 });
  });
});
