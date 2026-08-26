import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PricingContent } from "@/components/PricingContent";

describe("PricingPage", () => {
  it("shows free, one-bank, subject-pair, and all-bank plans with the pair emphasized", () => {
    const { container } = render(<PricingContent authenticated hasPaidAccess={false} />);

    expect(screen.getByRole("heading", { name: /pay for the maths you actually need/i })).toBeInTheDocument();
    expect(screen.getByText("$29.99")).toBeInTheDocument();
    expect(screen.getByText("$49.99")).toBeInTheDocument();
    expect(screen.getByText("$89.99")).toBeInTheDocument();
    expect(screen.getByText("$2.99 monthly")).toBeInTheDocument();
    expect(screen.getByText("$4.99 monthly")).toBeInTheDocument();
    expect(screen.getByText("$8.99 monthly")).toBeInTheDocument();
    expect(screen.getByText(/most popular/i)).toBeInTheDocument();
    expect(screen.getByText(/simple access/i)).toBeInTheDocument();
    expect(screen.getByText(/existing all-access subscribers keep their current price/i)).toBeInTheDocument();
    expect(screen.getByText(/local currency at checkout/i)).toBeInTheDocument();
    expect(screen.getByText(/IGCSE Mathematics and Additional Mathematics: 2016-2018/i)).toBeInTheDocument();

    const options = container.querySelectorAll(".pricing-option");
    expect(options).toHaveLength(4);
    expect(within(options[0] as HTMLElement).getByRole("heading", { name: "Free" })).toBeInTheDocument();
    expect(within(options[0] as HTMLElement).getByText(/current plan/i)).toBeInTheDocument();
    expect(within(options[1] as HTMLElement).getByRole("heading", { name: "One bank" })).toBeInTheDocument();
    expect(within(options[2] as HTMLElement).getByRole("heading", { name: "Subject pair" })).toBeInTheDocument();
    expect(options[2]).toHaveClass("pricing-option-annual");
    expect(within(options[3] as HTMLElement).getByRole("heading", { name: "All banks" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /choose annual/i })).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: /choose monthly/i })).toHaveLength(3);
  });

  it("does not call free the current plan for a paid account", () => {
    render(<PricingContent authenticated hasPaidAccess />);
    expect(screen.queryByText(/current plan/i)).not.toBeInTheDocument();
    expect(screen.getByText(/paid access is active/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /manage your access/i })).toHaveLength(3);
  });
});
