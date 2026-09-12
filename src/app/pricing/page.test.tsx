import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PricingContent } from "@/components/PricingContent";

describe("PricingPage", () => {
  it("shows three concise paid plans with monthly pricing first", () => {
    const { container } = render(<PricingContent authenticated hasPaidAccess={false} />);

    expect(screen.getByRole("heading", { name: /practice smarter\. score higher\./i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Monthly" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText("$6").length).toBeGreaterThan(0);
    expect(screen.getByText("$25")).toBeInTheDocument();
    expect(screen.getByText("Everything, including future banks.")).toBeInTheDocument();
    expect(screen.queryByText(/unlock every current bank/i)).not.toBeInTheDocument();
    expect(screen.getByText(/most popular/i)).toBeInTheDocument();
    expect(screen.getByText(/every plan includes the same study tools/i)).toBeInTheDocument();
    expect(screen.getByText(/existing subscribers remain grandfathered at their current price and access/i)).toBeInTheDocument();

    const options = container.querySelectorAll(".pricing-option");
    expect(options).toHaveLength(3);
    expect(container.querySelector(".pricing-free-strip")).toBeInTheDocument();
  });

  it("does not call free the current plan for a paid account", () => {
    render(<PricingContent authenticated hasPaidAccess currentPlanNames={["IB Mathematics AI"]} />);
    expect(screen.getByRole("heading", { name: /your current plan/i })).toBeInTheDocument();
    expect(screen.getByText("IB Mathematics AI")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /manage billing/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /manage your access/i })).not.toBeInTheDocument();
  });

  it("makes the free account and upgrade path explicit for signed-in users", () => {
    render(<PricingContent authenticated hasPaidAccess={false} currentPlanNames={[]} />);
    expect(screen.getByRole("heading", { name: /your current plan/i })).toBeInTheDocument();
    expect(screen.getByText(/^Free$/)).toBeInTheDocument();
    expect(screen.getByText(/choose a plan below to unlock every available question/i)).toBeInTheDocument();
  });
});
