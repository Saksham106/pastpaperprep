import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const track = vi.hoisted(() => vi.fn());
vi.mock("@/lib/product-analytics", async (importOriginal) => ({ ...(await importOriginal<object>()), trackProductEvent: track }));

import { PricingContent } from "@/components/PricingContent";
import { CheckoutReturnTracker } from "@/components/CheckoutReturnTracker";

const eventsNamed = (name: string) => track.mock.calls.filter(([event]) => event === name);

describe("pricing and checkout funnel events", () => {
  afterEach(() => track.mockReset());

  it("reports one pricing view with the preselected bank and the prompt that sent them", () => {
    const { rerender } = render(<PricingContent authenticated={false} hasPaidAccess={false} initialProductId="bank_igcse" source="top_note" />);
    rerender(<PricingContent authenticated={false} hasPaidAccess={false} initialProductId="bank_igcse" source="top_note" />);
    expect(eventsNamed("pricing_view")).toEqual([["pricing_view", { product: "bank_igcse", from: "top_note", interval: "monthly", signedIn: false, hasPaidAccess: false, bankCount: 1 }]]);
    expect(eventsNamed("checkout_cancelled")).toHaveLength(0);
  });

  it("reports a cancelled checkout when Stripe sends them back", () => {
    render(<PricingContent authenticated hasPaidAccess={false} checkoutStatus="cancelled" />);
    expect(eventsNamed("checkout_cancelled")).toHaveLength(1);
    expect(eventsNamed("pricing_view")[0][1]).toMatchObject({ signedIn: true, bankCount: 0 });
  });

  it("reports a completed checkout return once", () => {
    const { rerender } = render(<CheckoutReturnTracker status="success" />);
    rerender(<CheckoutReturnTracker status="success" />);
    expect(eventsNamed("checkout_returned")).toEqual([["checkout_returned", { status: "success" }]]);
  });

  it("clears the checkout status from the address so a reload is not counted again", () => {
    window.history.replaceState({}, "", "/account?checkout=success&x=1");
    render(<CheckoutReturnTracker status="success" />);
    expect(window.location.search).toBe("?x=1");
    window.history.replaceState({}, "", "/pricing?checkout=cancelled");
    render(<PricingContent authenticated={false} hasPaidAccess={false} checkoutStatus="cancelled" />);
    expect(window.location.search).toBe("");
  });

  it("reports no preselected banks for subscribers, whose builder starts empty", () => {
    render(<PricingContent authenticated hasPaidAccess initialProductId="bank_igcse" />);
    expect(eventsNamed("pricing_view")[0][1]).toMatchObject({ bankCount: 0 });
  });
});
