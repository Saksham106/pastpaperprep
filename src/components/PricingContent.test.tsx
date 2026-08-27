import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PricingContent } from "@/components/PricingContent";

describe("bank-based pricing", () => {
  it("shows monthly prices first and keeps annual savings one click away", () => {
    render(<PricingContent authenticated={false} hasPaidAccess={false} />);

    expect(screen.getByRole("button", { name: "Monthly" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "One bank" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Subject pair" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "All banks" })).toBeInTheDocument();
    expect(screen.getByText("$5")).toBeInTheDocument();
    expect(screen.getByText("$8")).toBeInTheDocument();
    expect(screen.getByText("$12")).toBeInTheDocument();
    expect(screen.queryByText(/billed .* once a year/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /annual.*save up to 33%/i }));
    expect(screen.getByText("$4")).toBeInTheDocument();
    expect(screen.getByText("$6")).toBeInTheDocument();
    expect(screen.getByText("$8")).toBeInTheDocument();
    expect(screen.getByText("Billed $48 once a year · Save 20%")).toBeInTheDocument();
    expect(screen.getByText("Billed $72 once a year · Save 25%")).toBeInTheDocument();
    expect(screen.getByText("Billed $96 once a year · Save 33%")).toBeInTheDocument();
  });

  it("marks the popular plan for responsive first-position styling", () => {
    const { container } = render(<PricingContent authenticated={false} hasPaidAccess={false} />);
    expect(container.querySelector(".pricing-option-popular")).toHaveAttribute("data-mobile-order", "first");
  });

  it("keeps free access compact instead of rendering a fourth full plan card", () => {
    const { container } = render(<PricingContent authenticated={false} hasPaidAccess={false} />);
    expect(container.querySelector(".pricing-free-strip")).not.toBeNull();
    expect(container.querySelector(".pricing-option-free")).toBeNull();
  });

  it("offers only controlled bank and subject-pair choices", () => {
    render(<PricingContent authenticated={true} hasPaidAccess={false} />);
    const selects = screen.getAllByRole("combobox");
    expect(selects).toHaveLength(2);
    expect(screen.getByRole("option", { name: "IB Mathematics AA HL" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "IB Mathematics AA (SL + HL)" })).toBeInTheDocument();
  });
});
