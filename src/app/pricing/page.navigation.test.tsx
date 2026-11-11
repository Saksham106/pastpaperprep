import { act, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pricingTestUrl, renderPricingPage, routeAccountRequestsToHandler, setSignedIn } from "./pricing-page-harness";

const mocks = vi.hoisted(() => ({ getClaims: vi.fn(), fetchAccessEntitlements: vi.fn(), trackProductEvent: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims: mocks.getClaims } }) }));
vi.mock("@/lib/custom-bundle-access", () => ({ fetchAccessEntitlements: mocks.fetchAccessEntitlements }));
vi.mock("@/lib/product-analytics", () => ({ trackProductEvent: mocks.trackProductEvent }));
vi.mock("next/navigation", () => ({ useSearchParams: () => { if (pricingTestUrl.prerender) throw new Error("Bail out to client rendering"); return new URLSearchParams(pricingTestUrl.search); }, useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));

import PricingPage from "./page";

const active = { productId: "bank_ib_sl", status: "active", startsAt: "2025-01-01T00:00:00.000Z", expiresAt: null, source: "stripe", products: { name: "IB Mathematics AA SL" } };
let fetchMock: ReturnType<typeof routeAccountRequestsToHandler>;
beforeEach(() => {
  vi.clearAllMocks();
  setSignedIn(true);
  fetchMock = routeAccountRequestsToHandler();
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "owner" } } });
  mocks.fetchAccessEntitlements.mockResolvedValue({ rows: [active], error: null });
});
afterEach(() => { setSignedIn(false); vi.unstubAllGlobals(); });

describe("pricing for an existing customer", () => {
  it("keeps verified existing access on pricing with the shared selector and account editor", async () => {
    renderPricingPage();
    expect(await screen.findByRole("region", { name: "Change your current subscription" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Billing period" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /your current access/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /choose one bank/i })).not.toBeInTheDocument();
    expect(mocks.trackProductEvent).toHaveBeenCalledWith("pricing_view", expect.objectContaining({ signedIn: true, hasPaidAccess: true }));
    expect(mocks.trackProductEvent.mock.calls.filter(([name]) => name === "pricing_view")).toHaveLength(1);
  });

  it("keeps a deliberate add-on selection available without treating it as an in-place upgrade", async () => {
    renderPricingPage("?product=bank_ib_hl");
    expect(await screen.findByRole("region", { name: "Change your current subscription" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /your current access/i })).not.toBeInTheDocument();
    expect(screen.getByText(/separate charge and renewal/i)).toBeInTheDocument();
  });

  it("shows a signed-in free account its free plan and the plan grid", async () => {
    mocks.fetchAccessEntitlements.mockResolvedValue({ rows: [], error: null });
    renderPricingPage();
    expect(await screen.findByRole("heading", { name: /your current access/i })).toBeInTheDocument();
    expect(screen.getByText(/^Free$/)).toBeInTheDocument();
    expect(document.querySelector('[aria-label="PastPaperPrep plans"] #plan-builder')).toBeInTheDocument();
    expect(mocks.trackProductEvent).toHaveBeenCalledWith("pricing_view", expect.objectContaining({ signedIn: true, hasPaidAccess: false }));
  });

  it("shows complimentary access as a grant without plan actions", async () => {
    mocks.fetchAccessEntitlements.mockResolvedValue({ rows: [{ ...active, productId: "bundle_all", source: "manual", products: { name: "All Access" } }], error: null });
    renderPricingPage();
    expect(await screen.findByText(/grant, not a billed subscription/i)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Change your current subscription" })).not.toBeInTheDocument();
  });

  it("never shows an earlier session's plan after signing out and back in within the tab", async () => {
    renderPricingPage();
    expect(await screen.findByRole("region", { name: "Change your current subscription" })).toBeInTheDocument();

    setSignedIn(false);
    act(() => { window.dispatchEvent(new Event("ppp:session-change")); });
    expect(screen.queryByRole("region", { name: "Change your current subscription" })).not.toBeInTheDocument();

    let release!: () => void;
    mocks.fetchAccessEntitlements.mockReturnValue(new Promise((resolve) => { release = () => resolve({ rows: [], error: null }); }));
    setSignedIn(true);
    act(() => { window.dispatchEvent(new Event("ppp:session-change")); });
    // The new session's plan is still loading: neither the old subscriber view nor checkout shows.
    expect(document.querySelector(".pricing-account-pending")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Change your current subscription" })).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.fetchAccessEntitlements).toHaveBeenCalledTimes(2));
    release();
    expect(await screen.findByText(/^Free$/)).toBeInTheDocument();
  });

  it("renders the signed-out page for anonymous visitors without any account request", async () => {
    setSignedIn(false);
    renderPricingPage();
    expect(screen.getByRole("group", { name: "Billing period" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /your current access/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /see referral rewards/i })).toHaveAttribute("href", "/login?next=/account/referrals");
    expect(mocks.trackProductEvent).toHaveBeenCalledWith("pricing_view", expect.objectContaining({ signedIn: false, hasPaidAccess: false }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("the CDN HTML", () => {
  it("prerenders the full signed-out plan grid, marked as the replaceable fallback", () => {
    // During prerender useSearchParams bails out to the Suspense fallback; simulate that bailout.
    pricingTestUrl.prerender = true;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const html = renderToStaticMarkup(PricingPage());
    consoleError.mockRestore();
    pricingTestUrl.prerender = false;
    expect(html).toContain('data-pricing-fallback="true"');
    expect(html).toContain('aria-label="Billing period"');
    expect(html).toContain('aria-label="PastPaperPrep plans"');
    expect(html).toContain('id="plan-builder"');
    expect(html).toContain("Common questions");
    expect(html).toContain("dataset.pricingIntent");
    expect(html).not.toContain("Your current access");
  });
});
