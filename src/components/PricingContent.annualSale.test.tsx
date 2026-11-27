import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PricingContent } from "@/components/PricingContent";

const card = (name: string) => screen.getByRole("heading", { name }).closest("article") as HTMLElement;
const text = (root: Element | null, selector: string) => root?.querySelector(selector)?.textContent ?? null;
const headline = (name: string) => ({ was: text(card(name), ".plan-price-was"), now: text(card(name), ".plan-price strong"), tag: text(card(name), ".plan-sale-tag") });
const saleNote = (name: string) => text(card(name), ".plan-sale-note");
const nudge = (name: string) => text(card(name), ".plan-upgrade-nudge-text");

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

  it("strikes the standard per-month price and shows the sale price, tag and first-year charge", () => {
    render(<PricingContent authenticated={false} hasPaidAccess={false} initialInterval="annual" />);

    expect(headline("One Bank")).toEqual({ was: "$4", now: "$3", tag: "−25% first year" });
    expect(saleNote("One Bank")).toBe("$36 for your first year, then $48/yr");
    expect(headline("All Access")).toEqual({ was: "$18", now: "$10.80", tag: "−40% first year" });
    expect(saleNote("All Access")).toBe("$129.60 for your first year, then $216/yr");
    expect(screen.getByRole("status")).toHaveTextContent("One Bank 25% off · 2–3 banks 30% off · 4–5 banks 35% off · All Access 40% off · first year · ends 1 Dec");
  });

  it("prices the builder from the selected quantity", () => {
    render(<PricingContent authenticated={false} hasPaidAccess={false} initialInterval="annual" />);
    const checkboxes = within(card("Build Your Plan")).getAllByRole("checkbox");

    expect(saleNote("Build Your Plan")).toBe("30–35% off your first year");
    checkboxes.slice(0, 3).forEach((checkbox) => fireEvent.click(checkbox));
    expect(headline("Build Your Plan")).toEqual({ was: "$10", now: "$7", tag: "−30% first year" });
    expect(saleNote("Build Your Plan")).toBe("$84 for your first year, then $120/yr");
    fireEvent.click(checkboxes[3]);
    expect(headline("Build Your Plan")).toEqual({ was: "$13", now: "$8.45", tag: "−35% first year" });
    fireEvent.click(checkboxes[4]);
    fireEvent.click(checkboxes[5]);
    expect(headline("Build Your Plan")).toEqual({ was: "$18", now: "$10.80", tag: "−40% first year" });
  });

  it("nudges one more bank per month at sale prices, with the ladder, up to All Access", () => {
    render(<PricingContent authenticated={false} hasPaidAccess={false} initialInterval="annual" />);
    const builder = card("Build Your Plan");
    const checkboxes = within(builder).getAllByRole("checkbox");
    const ladderState = () => [...builder.querySelectorAll(".plan-sale-ladder li")].map((item) => item.getAttribute("data-state"));

    expect(nudge("Build Your Plan")).toBeNull();
    checkboxes.slice(0, 3).forEach((checkbox) => fireEvent.click(checkbox));
    expect(nudge("Build Your Plan")).toBe("Add 1 more bank for just $1.45/mo moreUnlock 35% off your whole plan");
    expect(ladderState()).toEqual(["current", "next", "next"]);
    checkboxes.slice(3, 5).forEach((checkbox) => fireEvent.click(checkbox));
    expect(nudge("Build Your Plan")).toBe("Add 1 more bank for just $0.40/mo moreGet All Access: every bank, including new ones");
    expect(ladderState()).toEqual(["passed", "current", "next"]);
    fireEvent.click(checkboxes[5]);
    expect(nudge("Build Your Plan")).toBeNull();
  });

  it("opens the bank list from the nudge's Add a bank button", () => {
    render(<PricingContent authenticated={false} hasPaidAccess={false} initialInterval="annual" />);
    const builder = card("Build Your Plan");
    within(builder).getAllByRole("checkbox").slice(0, 2).forEach((checkbox) => fireEvent.click(checkbox));
    const picker = builder.querySelector("details") as HTMLDetailsElement;
    picker.open = false;
    Element.prototype.scrollIntoView = vi.fn();

    fireEvent.click(within(builder).getByRole("button", { name: /Add 1 more bank/ }));
    expect(picker.open).toBe(true);
  });

  it("prices the bank-focus card's second-bank and All Access chips at sale prices", () => {
    const { container } = render(<PricingContent authenticated={false} hasPaidAccess={false} initialInterval="annual" initialProductId="bank_igcse" />);
    const focus = container.querySelector(".pricing-bank-focus") as HTMLElement;

    expect(text(focus, ".plan-price-was")).toBe("$4");
    expect(text(focus, ".plan-price strong")).toBe("$3");
    expect(within(focus).getByText("Add one for just $1.90/month, and get 30% off.")).toBeInTheDocument();
    expect(focus.querySelector(".pricing-bank-focus-all")?.textContent).toMatch(/banks · \$10\.80\/mo$/);
  });

  it("shows nothing on monthly beyond the annual toggle badge", () => {
    const { container } = render(<PricingContent authenticated={false} hasPaidAccess={false} initialInterval="monthly" />);

    expect(container.querySelector(".plan-sale-note, .pricing-sale-note, .plan-price-was, .plan-sale-ladder")).toBeNull();
    expect(screen.getByRole("button", { name: /Annual/ })).toHaveTextContent("Up to 40% off");
  });

  it.each([
    ["after the window", () => vi.setSystemTime(new Date("2026-12-02T00:00:00Z"))],
    ["when no sale is configured", () => document.documentElement.removeAttribute("data-annual-sale")],
  ])("shows standard annual pricing %s", (_label, setup) => {
    setup();
    const { container } = render(<PricingContent authenticated={false} hasPaidAccess={false} initialInterval="annual" />);

    expect(container.querySelector(".plan-sale-note, .pricing-sale-note, .plan-price-was, .plan-sale-ladder")).toBeNull();
    expect(card("All Access").querySelector(".plan-billing-note")?.textContent).toBe("Billed $216 once a year. Save 28%");
  });
});

describe("upgrade nudge without a sale", () => {
  it("prices one more bank per month on monthly and annual plans, without a ladder", () => {
    const { rerender } = render(<PricingContent authenticated={false} hasPaidAccess={false} initialInterval="monthly" />);
    within(card("Build Your Plan")).getAllByRole("checkbox").slice(0, 2).forEach((checkbox) => fireEvent.click(checkbox));
    expect(nudge("Build Your Plan")).toBe("Add 1 more bank for just $4/mo more");

    rerender(<PricingContent authenticated={false} hasPaidAccess={false} initialInterval="annual" />);
    expect(nudge("Build Your Plan")).toBe("Add 1 more bank for just $3/mo more");
    expect(card("Build Your Plan").querySelector(".plan-sale-ladder")).toBeNull();
  });

  it("links One Bank to the builder with that bank kept", () => {
    render(<PricingContent authenticated={false} hasPaidAccess={false} initialInterval="annual" initialProductId="bank_igcse" />);
    expect(nudge("One Bank")).toBe("Add a second bank for just $3/mo more");
    const link = within(card("One Bank")).getByRole("link", { name: /Add a second bank/ });
    expect(link.getAttribute("href")).toBe("/pricing?banks=igcse&interval=annual#plan-builder");
  });

  it("is not shown to subscribers buying an add-on", () => {
    const { container } = render(<PricingContent authenticated hasPaidAccess addOnIntent currentPlanProductIds={["bank_ib_sl"]} ownedBankIds={["ib-sl"]} initialBankIds={["igcse", "ib-hl"]} />);
    expect(container.querySelector(".plan-upgrade-nudge")).toBeNull();
  });
});
