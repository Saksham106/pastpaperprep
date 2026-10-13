import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { postAuthDestination } from "./post-auth-destination";

function client(entitlements: unknown[] | null, error: unknown = null) {
  return {
    from: () => ({ select: () => ({ eq: async () => ({ data: entitlements, error }) }) }),
    rpc: async () => ({ data: [], error: null }),
  } as never;
}

const activeAllAccess = { product_id: "bundle_all", status: "active", starts_at: "2026-01-01T00:00:00Z", expires_at: null, source: "stripe" };

describe("postAuthDestination", () => {
  it("sends paid users from the generic pricing default to their dashboard", async () => {
    await expect(postAuthDestination(client([activeAllAccess]), "user-1", "/pricing")).resolves.toBe("/dashboard");
  });

  it("keeps pricing for free users and for expired access", async () => {
    await expect(postAuthDestination(client([]), "user-1", "/pricing")).resolves.toBe("/pricing");
    const expired = { ...activeAllAccess, expires_at: "2026-02-01T00:00:00Z" };
    await expect(postAuthDestination(client([expired]), "user-1", "/pricing")).resolves.toBe("/pricing");
  });

  it("never overrides an explicit destination, including a chosen plan", async () => {
    const paid = client([activeAllAccess]);
    await expect(postAuthDestination(paid, "user-1", "/pricing?interval=annual&product=bundle_all")).resolves.toBe("/pricing?interval=annual&product=bundle_all");
    await expect(postAuthDestination(paid, "user-1", "/banks/ib-hl")).resolves.toBe("/banks/ib-hl");
  });

  it("falls back to pricing when access can't be read or the user is unknown", async () => {
    await expect(postAuthDestination(client(null, { code: "XX000" }), "user-1", "/pricing")).resolves.toBe("/pricing");
    await expect(postAuthDestination({} as never, "user-1", "/pricing")).resolves.toBe("/pricing");
    await expect(postAuthDestination(client([activeAllAccess]), undefined, "/pricing")).resolves.toBe("/pricing");
  });
});
