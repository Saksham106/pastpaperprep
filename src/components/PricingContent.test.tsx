import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PricingContent } from "@/components/PricingContent";

describe("approved custom-bank pricing", () => {
  it("shows One Bank, Build Your Plan, and All Access with approved monthly prices", () => {
    const { container } = render(<PricingContent authenticated={false} hasPaidAccess={false} />);

    expect(screen.getByRole("heading", { name: "One Bank" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Build Your Plan" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "All Access" })).toBeInTheDocument();
    expect(within(container.querySelectorAll(".pricing-option")[0] as HTMLElement).getByText("$6")).toBeInTheDocument();
    expect(within(container.querySelectorAll(".pricing-option")[2] as HTMLElement).getByText("$25")).toBeInTheDocument();
    expect(screen.getByText("Most popular")).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(12);
  });

  it("updates the builder total from the exact selected bank count", () => {
    render(<PricingContent authenticated={true} hasPaidAccess={false} />);
    const builder = screen.getByRole("heading", { name: "Build Your Plan" }).closest("article");
    expect(builder).not.toBeNull();
    const checkboxes = within(builder!).getAllByRole("checkbox");
    expect(within(builder!).getByText("1 bank selected.")).toBeInTheDocument();

    fireEvent.click(checkboxes[1]);

    expect(within(builder!).getByText("2 banks selected.")).toBeInTheDocument();
    expect(within(builder!).getByText("$10 / month")).toBeInTheDocument();
  });

  it("shows annual effective monthly prices, exact yearly totals, and annual builder math", () => {
    render(<PricingContent authenticated={false} hasPaidAccess={false} initialInterval="annual" />);

    expect(screen.getAllByText("$4").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Billed $48 once a year.")).toHaveLength(2);
    expect(screen.getByText("$18")).toBeInTheDocument();
    expect(screen.getByText("Select the exact banks you need. The first bank is $4/month billed annually, then $3/month for each additional bank.")).toBeInTheDocument();
    expect(screen.queryByText("Select the exact banks you need. The first bank is $6/month, then $4 for each additional bank.")).not.toBeInTheDocument();
    expect(screen.getAllByText(/Billed/).map((node) => node.textContent).some((text) => text?.includes("$216 once a year"))).toBe(true);
  });

  it("disables Build Your Plan checkout and pricing when no banks are selected", () => {
    render(<PricingContent authenticated={true} hasPaidAccess={false} />);
    const builder = screen.getByRole("heading", { name: "Build Your Plan" }).closest("article") as HTMLElement;
    const checkbox = within(builder).getAllByRole("checkbox")[0];

    fireEvent.click(checkbox);

    expect(within(builder).getByText("Select at least one bank to continue.")).toBeInTheDocument();
    expect(within(builder).queryByRole("button", { name: /choose monthly/i })).not.toBeInTheDocument();
    expect(builder.querySelector(".custom-bundle-effective-price")).toBeNull();
    expect(builder.querySelector(".custom-bundle-total")).toBeNull();
  });

  it("keeps the popular plan first on mobile and all three cards in one grid", () => {
    const { container } = render(<PricingContent authenticated={false} hasPaidAccess={false} />);
    expect(container.querySelector(".pricing-decision-grid")).not.toBeNull();
    expect(container.querySelectorAll(".pricing-decision-grid > .pricing-option")).toHaveLength(3);
    expect(container.querySelector(".pricing-option-popular")).toHaveAttribute("data-mobile-order", "first");
  });

  it("offers exact bank choices and checkout continuations before sign-in", () => {
    render(<PricingContent authenticated={false} hasPaidAccess={false} />);
    expect(screen.getAllByRole("link", { name: /continue to checkout/i })).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "IB Math AI HL" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "IB Math AA HL" })).toBeInTheDocument();
  });

  it("restores a visitor's selected bank after sign-in", () => {
    render(<PricingContent authenticated={false} hasPaidAccess={false} initialInterval="annual" initialProductId="bank_ib_ai_hl" />);
    expect(screen.getByRole("radio", { name: "IB Math AI HL" })).toBeChecked();
    expect(screen.getByRole("button", { name: /annual.*save up to 33%/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps One Bank to exactly one selected canonical bank", () => {
    render(<PricingContent authenticated={false} hasPaidAccess={false} initialBankIds={["ib-sl", "igcse"]} />);
    const oneBank = screen.getByRole("heading", { name: "One Bank" }).closest("article");
    expect(within(oneBank!).getAllByRole("radio", { checked: true })).toHaveLength(1);
    expect(within(oneBank!).getByRole("radio", { name: "IB Math AA SL" })).toBeChecked();
  });

  it("keeps free access compact and preserves the coverage comparison", () => {
    const { container } = render(<PricingContent authenticated={false} hasPaidAccess={false} />);
    expect(container.querySelector(".pricing-free-strip")).not.toBeNull();
    const table = screen.getByRole("table", { name: "Question bank coverage" });
    expect(within(table).getAllByRole("row")).toHaveLength(13);
    expect(container.querySelectorAll("[data-pricing-bank]")).toHaveLength(12);
  });
});
