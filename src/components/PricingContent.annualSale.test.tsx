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
    expect(screen.getByRole("status")).toHaveTextContent("One Bank 25% off · Build your plan 35% off · All Access 40% off · first year · ends 1 Dec");
  });

  it("prices the builder from the selected quantity", () => {
    render(<PricingContent authenticated={false} hasPaidAccess={false} initialInterval="annual" />);
    const checkboxes = within(card("Build Your Plan")).getAllByRole("checkbox");

    expect(saleNote("Build Your Plan")).toBe("35% off your first year");
    checkboxes.slice(0, 3).forEach((checkbox) => fireEvent.click(checkbox));
    expect(saleNote("Build Your Plan")).toBe("$120 $78 for your first year (35% off), then $120/yr");
    checkboxes.slice(3, 6).forEach((checkbox) => fireEvent.click(checkbox));
    expect(saleNote("Build Your Plan")).toBe("$216 $129.60 for your first year (40% off), then $216/yr");
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
