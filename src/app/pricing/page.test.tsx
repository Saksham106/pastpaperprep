import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PricingPage from "@/app/pricing/page";

describe("PricingPage", () => {
  it("presents the approved founding all-access price and both checkout intervals", () => {
    const { container } = render(<PricingPage />);

    expect(screen.getByRole("heading", { name: /all three question banks/i })).toBeInTheDocument();
    expect(screen.getByText("$4.99")).toBeInTheDocument();
    expect(screen.getByText("$39.99")).toBeInTheDocument();
    expect(screen.getByText(/introductory all-access/i)).toBeInTheDocument();
    expect(screen.getByText(/introductory price may change/i)).toBeInTheDocument();
    expect(screen.queryByText(/keep this price/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /choose annual/i })).toBeInTheDocument();
    expect(screen.getByText(/local currency at checkout/i)).toBeInTheDocument();
    expect(container.querySelectorAll(".founding-prices > .price-row")).toHaveLength(2);
    expect(container.querySelector(".founding-prices > .billing-actions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /choose monthly/i })).toBeInTheDocument();
  });
});
