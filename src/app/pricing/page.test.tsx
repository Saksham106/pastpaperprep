import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PricingPage from "@/app/pricing/page";

describe("PricingPage", () => {
  it("presents the approved founding all-access price and both checkout intervals", () => {
    render(<PricingPage />);

    expect(screen.getByRole("heading", { name: /all three question banks/i })).toBeInTheDocument();
    expect(screen.getByText("$4.99")).toBeInTheDocument();
    expect(screen.getByText("$39.99")).toBeInTheDocument();
    expect(screen.getByText(/founding price/i)).toBeInTheDocument();
    expect(screen.getByText(/introductory price may change/i)).toBeInTheDocument();
    expect(screen.queryByText(/keep this price/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /choose annual/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /choose monthly/i })).toBeInTheDocument();
  });
});
