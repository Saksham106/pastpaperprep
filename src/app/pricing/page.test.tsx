import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PricingPage from "@/app/pricing/page";

describe("PricingPage", () => {
  it("presents the approved founding all-access price without enabling checkout", () => {
    render(<PricingPage />);

    expect(screen.getByRole("heading", { name: /all three question banks/i })).toBeInTheDocument();
    expect(screen.getByText("$4.99")).toBeInTheDocument();
    expect(screen.getByText("$39.99")).toBeInTheDocument();
    expect(screen.getByText(/founding price/i)).toBeInTheDocument();
    expect(screen.getByText(/future students may pay more/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /create free account/i })).toHaveAttribute("href", "/login?next=/pricing");
  });
});
