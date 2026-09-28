import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchAccessEntitlements: vi.fn(),
  getClaims: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getClaims: mocks.getClaims } }),
}));
vi.mock("@/lib/custom-bundle-access", () => ({
  fetchAccessEntitlements: mocks.fetchAccessEntitlements,
}));

import PricingPage from "@/app/pricing/page";

beforeEach(() => {
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "owner" } } });
  mocks.fetchAccessEntitlements.mockReset();
});

describe("pricing when Supabase temporarily rejects a fresh session", () => {
  it("shows a retry-only screen rather than crashing or offering checkout after the future-JWT error", async () => {
    mocks.fetchAccessEntitlements.mockResolvedValue({ rows: [], error: { code: "PGRST303", message: "JWT issued at future" } });
    const html = renderToStaticMarkup(await PricingPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("We couldn&#x27;t check your access");
    expect(html).toContain('href="/pricing"');
    expect(html).toContain("Try again");
    expect(html).not.toContain("ONE BANK");
    expect(html).not.toContain("Checkout");
  });

  it("does not hide unrelated access errors behind the recovery screen", async () => {
    const denied = { code: "42501", message: "permission denied" };
    mocks.fetchAccessEntitlements.mockResolvedValue({ rows: [], error: denied });
    await expect(PricingPage({ searchParams: Promise.resolve({}) })).rejects.toEqual(denied);
  });

  it("does not mistake a different PGRST303 failure for the clock bug", async () => {
    const failure = { code: "PGRST303", message: "JWT expired" };
    mocks.fetchAccessEntitlements.mockResolvedValue({ rows: [], error: failure });
    await expect(PricingPage({ searchParams: Promise.resolve({}) })).rejects.toEqual(failure);
  });
});
