import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkoutCancelUrl, lifetimeCheckoutCancelUrl } from "@/lib/stripe-checkout";

const mocks = vi.hoisted(() => ({ getClaims: vi.fn(), fetchAccessEntitlements: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims: mocks.getClaims } }) }));
vi.mock("@/lib/custom-bundle-access", () => ({ fetchAccessEntitlements: mocks.fetchAccessEntitlements }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));

import PricingPage from "./page";

/** What the pricing page receives when Stripe's back link opens a cancel URL. */
function searchParamsOf(url: string) {
  return Promise.resolve(Object.fromEntries(new URL(url).searchParams));
}

beforeEach(() => {
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "buyer" } } });
  mocks.fetchAccessEntitlements.mockResolvedValue({ rows: [], error: null });
});

describe("pricing after a cancelled checkout", () => {
  it("restores the annual interval and every bank picked in the builder", async () => {
    const cancelUrl = checkoutCancelUrl("https://pastpaperprep.com", { interval: "annual", productId: "bundle_custom", bankIds: ["igcse", "ib-hl", "ib-sl"] });
    render(await PricingPage({ searchParams: searchParamsOf(cancelUrl) }));

    expect(screen.getByRole("button", { name: /^Annual/ })).toHaveAttribute("aria-pressed", "true");
    const builder = document.querySelector<HTMLElement>("#plan-builder")!;
    const checked = [...builder.querySelectorAll<HTMLInputElement>("input[type=checkbox]:checked")].map((input) => input.closest("label")?.dataset.bankId);
    expect(checked.sort()).toEqual(["ib-hl", "ib-sl", "igcse"]);
    expect(screen.getByRole("button", { name: "Continue with 3 banks" })).toBeEnabled();
  });

  it("returns a single-bank buyer to that bank", async () => {
    const cancelUrl = checkoutCancelUrl("https://pastpaperprep.com", { interval: "monthly", productId: "bank_ib_sl" });
    render(await PricingPage({ searchParams: searchParamsOf(cancelUrl) }));

    expect(screen.getByRole("button", { name: "Monthly" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Unlock every IB Math AA SL paper" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Unlock IB Math AA SL" }).length).toBeGreaterThan(0);
  });

  it("reopens the Lifetime offer after a cancelled Lifetime checkout", async () => {
    render(await PricingPage({ searchParams: searchParamsOf(lifetimeCheckoutCancelUrl("https://pastpaperprep.com")) }));

    expect(screen.getByRole("button", { name: "Lifetime" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("region", { name: "Lifetime access offer" })).toBeInTheDocument();
  });
});
