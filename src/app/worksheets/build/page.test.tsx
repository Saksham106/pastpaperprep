import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { createClient, fetchAccessEntitlements } = vi.hoisted(() => ({ createClient: vi.fn(), fetchAccessEntitlements: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/custom-bundle-access", () => ({ fetchAccessEntitlements }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock("@/lib/banks", () => ({ getAvailableBanks: () => [
  { slug: "igcse-chemistry-0620", shortName: "Chemistry 0620" },
  { slug: "igcse-physics-0625", shortName: "Physics 0625" },
] }));
vi.mock("@/lib/access", () => ({ hasBankAccess: (slug: string) => slug === "igcse-chemistry-0620" }));
vi.mock("@/lib/question-index", () => ({ publicBankIndexUrl: (slug: string) => `/bank-index/${slug}.json` }));

import BuildPage from "@/app/worksheets/build/page";

describe("worksheet builder access", () => {
  it("redirects anonymous users before exposing the builder", async () => {
    createClient.mockResolvedValue({ auth: { getClaims: async () => ({ data: { claims: null } }) } });
    await expect(BuildPage()).rejects.toThrow("REDIRECT:/login?next=%2Fworksheets%2Fbuild");
  });
  it("offers only the user’s entitled banks and not the full catalogue", async () => {
    createClient.mockResolvedValue({ auth: { getClaims: async () => ({ data: { claims: { sub: "u-1" } } }) } });
    fetchAccessEntitlements.mockResolvedValue({ rows: [], error: null });
    const html = renderToStaticMarkup(await BuildPage());
    expect(html).toContain("Chemistry 0620");
    expect(html).not.toContain("Physics 0625");
  });
  it("fails closed when entitlement lookup fails", async () => {
    createClient.mockResolvedValue({ auth: { getClaims: async () => ({ data: { claims: { sub: "u-1" } } }) } });
    fetchAccessEntitlements.mockResolvedValue({ rows: [], error: new Error("offline") });
    await expect(BuildPage()).rejects.toThrow("offline");
  });
});
