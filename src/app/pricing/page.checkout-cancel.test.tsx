import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkoutCancelUrl, lifetimeCheckoutCancelUrl } from "@/lib/stripe-checkout";
import { pricingTestUrl, renderPricingPage, routeAccountRequestsToHandler, setSignedIn } from "./pricing-page-harness";

const mocks = vi.hoisted(() => ({ getClaims: vi.fn(), fetchAccessEntitlements: vi.fn(), trackProductEvent: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims: mocks.getClaims } }) }));
vi.mock("@/lib/custom-bundle-access", () => ({ fetchAccessEntitlements: mocks.fetchAccessEntitlements }));
vi.mock("@/lib/product-analytics", () => ({ trackProductEvent: mocks.trackProductEvent }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), useSearchParams: () => new URLSearchParams(pricingTestUrl.search), useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));

/** The query string Stripe's back link opens. */
const searchOf = (url: string) => new URL(url).search;

beforeEach(() => {
  vi.clearAllMocks();
  setSignedIn(true);
  routeAccountRequestsToHandler();
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "buyer" } } });
  mocks.fetchAccessEntitlements.mockResolvedValue({ rows: [], error: null });
});
afterEach(() => { setSignedIn(false); vi.unstubAllGlobals(); });

describe("pricing after a cancelled checkout", () => {
  it("restores the annual interval and every bank picked in the builder", async () => {
    renderPricingPage(searchOf(checkoutCancelUrl("https://pastpaperprep.com", { interval: "annual", productId: "bundle_custom", bankIds: ["igcse", "ib-hl", "ib-sl"] })));

    expect(await screen.findByRole("button", { name: /^Annual/ })).toHaveAttribute("aria-pressed", "true");
    const builder = document.querySelector<HTMLElement>("#plan-builder")!;
    const checked = [...builder.querySelectorAll<HTMLInputElement>("input[type=checkbox]:checked")].map((input) => input.closest("label")?.dataset.bankId);
    expect(checked.sort()).toEqual(["ib-hl", "ib-sl", "igcse"]);
    expect(screen.getByRole("button", { name: "Continue with 3 banks" })).toBeEnabled();
    expect(mocks.trackProductEvent).toHaveBeenCalledWith("checkout_cancelled", {});
  });

  it("returns a single-bank buyer to that bank", async () => {
    renderPricingPage(searchOf(checkoutCancelUrl("https://pastpaperprep.com", { interval: "monthly", productId: "bank_ib_sl" })));

    expect(await screen.findByRole("heading", { name: "Unlock every IB Math AA SL paper" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Monthly" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("button", { name: "Unlock IB Math AA SL" }).length).toBeGreaterThan(0);
  });

  it("reopens the Lifetime offer after a cancelled Lifetime checkout", async () => {
    renderPricingPage(searchOf(lifetimeCheckoutCancelUrl("https://pastpaperprep.com")));

    expect(await screen.findByRole("button", { name: "Lifetime" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("region", { name: "Lifetime access offer" })).toBeInTheDocument();
  });

  it("applies the URL's selection for anonymous visitors too", () => {
    setSignedIn(false);
    renderPricingPage("?product=bank_ib_sl&from=locked_card");
    expect(screen.getByRole("heading", { name: "Unlock every IB Math AA SL paper" })).toBeInTheDocument();
    expect(mocks.trackProductEvent).toHaveBeenCalledWith("pricing_view", expect.objectContaining({ product: "bank_ib_sl", from: "locked_card", signedIn: false }));
  });
});
