import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PricingContent } from "@/components/PricingContent";

describe("PricingPage", () => {
  it("shows three concise paid plans with annual pricing expressed per month", () => {
    const { container } = render(<PricingContent authenticated hasPaidAccess={false} />);

    expect(screen.getByRole("heading", { name: /choose how much maths you need/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /annual save 33%/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("$3.33")).toBeInTheDocument();
    expect(screen.getByText("$5.33")).toBeInTheDocument();
    expect(screen.getByText("$8")).toBeInTheDocument();
    expect(screen.getByText(/billed \$40 once a year/i)).toBeInTheDocument();
    expect(screen.getByText(/billed \$64 once a year/i)).toBeInTheDocument();
    expect(screen.getByText(/billed \$96 once a year/i)).toBeInTheDocument();
    expect(screen.getByText(/most popular/i)).toBeInTheDocument();
    expect(screen.getByText(/simple access/i)).toBeInTheDocument();
    expect(screen.getByText(/existing all-access subscribers keep their current price/i)).toBeInTheDocument();

    const options = container.querySelectorAll(".pricing-option");
    expect(options).toHaveLength(3);
    expect(container.querySelector(".pricing-free-strip")).toBeInTheDocument();
  });

  it("does not call free the current plan for a paid account", () => {
    render(<PricingContent authenticated hasPaidAccess />);
    expect(screen.queryByText(/current plan/i)).not.toBeInTheDocument();
    expect(screen.getByText(/paid access is active/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /manage your access/i })).toHaveLength(3);
  });
});
