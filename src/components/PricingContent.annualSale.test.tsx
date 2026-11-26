import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PricingContent } from "@/components/PricingContent";

const card = (name: string) => screen.getByRole("heading", { name }).closest("article") as HTMLElement;
const saleNote = (name: string) => card(name).querySelector(".plan-sale-note")?.textContent ?? null;

describe("annual sale on the pricing page", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-28T12:00:00Z"));
    document.documentElement.setAttribute("data-annual-sale", "live");
  });
  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.removeAttribute("data-annual-sale");
  });

  it("strikes the real annual charge and shows the first-year sale charge", () => {
    render(<PricingContent authenticated={false} hasPaidAccess={false} initialInterval="annual" />);

    expect(saleNote("One Bank")).toBe("$48 $36 for your first year (25% off), then $48/yr");
    expect(saleNote("All Access")).toBe("$216 $129.60 for your first year (40% off), then $216/yr");
    expect(card("One Bank").querySelector(".plan-sale-note s")?.textContent).toBe("$48");
    expect(screen.getByRole("status")).toHaveTextContent("One Bank 25% off · 2–3 banks 30% off · 4–5 banks 35% off · All Access 40% off · first year · ends 1 Dec");
  });

  it("prices the builder from the selected quantity", () => {
    render(<PricingContent authenticated={false} hasPaidAccess={false} initialInterval="annual" />);
    const checkboxes = within(card("Build Your Plan")).getAllByRole("checkbox");

    expect(saleNote("Build Your Plan")).toBe("30–35% off your first year");
    checkboxes.slice(0, 3).forEach((checkbox) => fireEvent.click(checkbox));
    expect(saleNote("Build Your Plan")).toBe("$120 $84 for your first year (30% off), then $120/yr");
    fireEvent.click(checkboxes[3]);
    expect(saleNote("Build Your Plan")).toBe("$156 $101.40 for your first year (35% off), then $156/yr");
    fireEvent.click(checkboxes[4]);
    fireEvent.click(checkboxes[5]);
    expect(saleNote("Build Your Plan")).toBe("$216 $129.60 for your first year (40% off), then $216/yr");
  });

  it("nudges one more bank per month at sale prices, up to All Access", () => {
    render(<PricingContent authenticated={false} hasPaidAccess={false} initialInterval="annual" />);
    const builder = card("Build Your Plan");
    const checkboxes = within(builder).getAllByRole("checkbox");
    const nudge = () => builder.querySelector(".plan-upgrade-nudge")?.textContent ?? null;

    expect(nudge()).toBeNull();
    checkboxes.slice(0, 3).forEach((checkbox) => fireEvent.click(checkbox));
    expect(nudge()).toBe("Add 1 more bank for $1.45/mo more ($17.40/yr), and get 35% off");
    checkboxes.slice(3, 5).forEach((checkbox) => fireEvent.click(checkbox));
    expect(nudge()).toBe("Add 1 more bank for $0.40/mo more ($4.80/yr) and get All Access: every bank, including new ones");
    fireEvent.click(checkboxes[5]);
    expect(nudge()).toBeNull();
  });

  it("prices the bank-focus card's second-bank and All Access chips at sale prices", () => {
    const { container } = render(<PricingContent authenticated={false} hasPaidAccess={false} initialInterval="annual" initialProductId="bank_igcse" />);
    const focus = container.querySelector(".pricing-bank-focus") as HTMLElement;

    expect(within(focus).getByText("Add one for just $1.90/month, and get 30% off.")).toBeInTheDocument();
    expect(focus.querySelector(".pricing-bank-focus-all")?.textContent).toMatch(/banks · \$10\.80\/mo$/);
  });

  it("shows nothing on monthly beyond the annual toggle badge", () => {
    const { container } = render(<PricingContent authenticated={false} hasPaidAccess={false} initialInterval="monthly" />);

    expect(container.querySelector(".plan-sale-note, .pricing-sale-note")).toBeNull();
    expect(screen.getByRole("button", { name: /Annual/ })).toHaveTextContent("Up to 40% off");
  });

  it.each([
    ["after the window", () => vi.setSystemTime(new Date("2026-12-02T00:00:00Z"))],
    ["when no sale is configured", () => document.documentElement.removeAttribute("data-annual-sale")],
  ])("shows standard annual pricing %s", (_label, setup) => {
    setup();
    const { container } = render(<PricingContent authenticated={false} hasPaidAccess={false} initialInterval="annual" />);

    expect(container.querySelector(".plan-sale-note, .pricing-sale-note")).toBeNull();
    expect(card("All Access").querySelector(".plan-billing-note")?.textContent).toBe("Billed $216 once a year. Save 28%");
  });
});

describe("upgrade nudge without a sale", () => {
  it("prices one more bank per month on monthly and annual plans", () => {
    const { rerender } = render(<PricingContent authenticated={false} hasPaidAccess={false} initialInterval="monthly" />);
    const nudge = () => card("Build Your Plan").querySelector(".plan-upgrade-nudge")?.textContent ?? null;
    within(card("Build Your Plan")).getAllByRole("checkbox").slice(0, 2).forEach((checkbox) => fireEvent.click(checkbox));
    expect(nudge()).toBe("Add 1 more bank for $4/mo more");

    rerender(<PricingContent authenticated={false} hasPaidAccess={false} initialInterval="annual" />);
    expect(nudge()).toBe("Add 1 more bank for $3/mo more ($36/yr)");
  });

  it("links One Bank to the builder with that bank kept", () => {
    render(<PricingContent authenticated={false} hasPaidAccess={false} initialInterval="annual" initialProductId="bank_igcse" />);
    const link = within(card("One Bank")).getByRole("link", { name: /Add a second bank for \$3\/mo more/ });
    expect(link.getAttribute("href")).toBe("/pricing?banks=igcse&interval=annual#plan-builder");
  });

  it("is not shown to subscribers buying an add-on", () => {
    const { container } = render(<PricingContent authenticated hasPaidAccess addOnIntent currentPlanProductIds={["bank_ib_sl"]} ownedBankIds={["ib-sl"]} initialBankIds={["igcse", "ib-hl"]} />);
    expect(container.querySelector(".plan-upgrade-nudge")).toBeNull();
  });
});
