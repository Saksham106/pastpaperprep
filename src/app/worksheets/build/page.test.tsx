import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { createClient, fetchAccessEntitlements } = vi.hoisted(() => ({ createClient: vi.fn(), fetchAccessEntitlements: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));
vi.mock("@/lib/custom-bundle-access", () => ({ fetchAccessEntitlements }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock("@/lib/banks", () => ({ getAvailableBanks: () => [
  { slug: "igcse-chemistry-0620", shortName: "Chemistry 0620" },
  { slug: "igcse-physics-0625", shortName: "Physics 0625" },
  { slug: "igcse-biology-0610", shortName: "Biology 0610" },
] }));
vi.mock("@/lib/access", () => ({ hasBankAccess: (slug: string) => slug === "igcse-chemistry-0620" || slug === "igcse-biology-0610" }));
vi.mock("@/lib/question-index", () => ({ publicBankIndexUrl: (slug: string) => `/bank-index/${slug}.json` }));

import BuildPage from "@/app/worksheets/build/page";

describe("worksheet builder access", () => {
  it("redirects anonymous users before exposing the builder", async () => {
    createClient.mockResolvedValue({ auth: { getClaims: async () => ({ data: { claims: null } }) } });
    await expect(BuildPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/login?next=%2Fworksheets%2Fbuild");
  });
  it("offers only the user’s entitled banks and not the full catalogue", async () => {
    createClient.mockResolvedValue({ auth: { getClaims: async () => ({ data: { claims: { sub: "u-1" } } }) } });
    fetchAccessEntitlements.mockResolvedValue({ rows: [], error: null });
    const html = renderToStaticMarkup(await BuildPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Chemistry 0620");
    expect(html).not.toContain("Physics 0625");
  });
  it("fails closed when entitlement lookup fails", async () => {
    createClient.mockResolvedValue({ auth: { getClaims: async () => ({ data: { claims: { sub: "u-1" } } }) } });
    fetchAccessEntitlements.mockResolvedValue({ rows: [], error: new Error("offline") });
    await expect(BuildPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("offline");
  });
  it("keeps the requested bank through login", async () => {
    createClient.mockResolvedValue({ auth: { getClaims: async () => ({ data: { claims: null } }) } });
    await expect(BuildPage({ searchParams: Promise.resolve({ bank: "igcse-chemistry-0620" }) }))
      .rejects.toThrow("REDIRECT:/login?next=%2Fworksheets%2Fbuild%3Fbank%3Digcse-chemistry-0620");
    await expect(BuildPage({ searchParams: Promise.resolve({ bank: "../evil" }) }))
      .rejects.toThrow("REDIRECT:/login?next=%2Fworksheets%2Fbuild");
  });

  it("preselects a requested bank only when the user can access it", async () => {
    createClient.mockResolvedValue({ auth: { getClaims: async () => ({ data: { claims: { sub: "u-1" } } }) } });
    fetchAccessEntitlements.mockResolvedValue({ rows: [], error: null });
    const allowed = renderToStaticMarkup(await BuildPage({ searchParams: Promise.resolve({ bank: "igcse-biology-0610" }) }));
    expect(allowed).toMatch(/<option value="igcse-biology-0610" selected="">/);
    const blocked = renderToStaticMarkup(await BuildPage({ searchParams: Promise.resolve({ bank: "igcse-physics-0625" }) }));
    expect(blocked).not.toContain("Physics 0625");
    expect(blocked).toMatch(/<option value="igcse-chemistry-0620" selected="">/);
  });
});
