import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getClaims: vi.fn(), fetchAccessEntitlements: vi.fn(), redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims: mocks.getClaims } }) }));
vi.mock("@/lib/custom-bundle-access", () => ({ fetchAccessEntitlements: mocks.fetchAccessEntitlements }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import PricingPage from "./page";
const active = { productId: "bank_ib_sl", status: "active", startsAt: "2025-01-01T00:00:00.000Z", expiresAt: null, source: "stripe" };
beforeEach(() => {
  mocks.getClaims.mockReset(); mocks.redirect.mockClear(); mocks.fetchAccessEntitlements.mockReset();
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "owner" } } });
  mocks.fetchAccessEntitlements.mockResolvedValue({ rows: [active], error: null });
});

describe("pricing for an existing customer", () => {
  it("keeps verified existing access on pricing with the shared selector and account editor", async () => {
    const html = renderToStaticMarkup(await PricingPage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain('aria-label="Billing period"');
    expect(html).toContain('aria-label="Change your current subscription"');
    expect(html).not.toContain('id="current-plan-heading"');
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("keeps a deliberate add-on selection available without treating it as an in-place upgrade", async () => {
    const html = renderToStaticMarkup(await PricingPage({ searchParams: Promise.resolve({ product: "bank_ib_hl" }) }));
    expect(html).toContain('aria-label="Change your current subscription"');
    expect(html).not.toContain('id="current-plan-heading"');
    expect(html).toContain("separate charge and renewal");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("keeps first-purchase pricing open to free and anonymous students", async () => {
    mocks.fetchAccessEntitlements.mockResolvedValue({ rows: [], error: null });
    const free = renderToStaticMarkup(await PricingPage({ searchParams: Promise.resolve({}) }));
    expect(free).not.toContain("Pay only for what you study");
    expect(free).toContain('aria-label="Billing period"');
    expect(mocks.redirect).not.toHaveBeenCalled();
    mocks.getClaims.mockResolvedValue({ data: { claims: null } });
    const anonymous = renderToStaticMarkup(await PricingPage({ searchParams: Promise.resolve({}) }));
    expect(anonymous).not.toContain("Pay only for what you study");
    expect(anonymous).toContain('aria-label="Billing period"');
  });
});
