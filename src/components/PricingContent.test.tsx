import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PricingContent } from "@/components/PricingContent";

describe("bank-based pricing", () => {
  it("presents a clear one-bank, subject-pair, and all-bank ladder", () => {
    render(<PricingContent authenticated={false} hasPaidAccess={false} />);

    expect(screen.getByRole("heading", { name: "One bank" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Subject pair" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "All banks" })).toBeInTheDocument();
    expect(screen.getByText("$29.99")).toBeInTheDocument();
    expect(screen.getByText("$49.99")).toBeInTheDocument();
    expect(screen.getByText("$89.99")).toBeInTheDocument();
    expect(screen.getByText("$2.99 monthly")).toBeInTheDocument();
    expect(screen.getByText("$4.99 monthly")).toBeInTheDocument();
    expect(screen.getByText("$8.99 monthly")).toBeInTheDocument();
  });

  it("offers only controlled bank and subject-pair choices", () => {
    render(<PricingContent authenticated={true} hasPaidAccess={false} />);
    const selects = screen.getAllByRole("combobox");
    expect(selects).toHaveLength(2);
    expect(screen.getByRole("option", { name: "IB Mathematics AA HL" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "IB Mathematics AA (SL + HL)" })).toBeInTheDocument();
  });
});
