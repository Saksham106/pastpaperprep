import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PricingContent } from "@/components/PricingContent";

describe("PricingPage", () => {
  it("shows free, annual, and monthly as separate plans with annual emphasized in the middle", () => {
    const { container } = render(<PricingContent authenticated hasPaidAccess={false} />);

    expect(screen.getByRole("heading", { name: /start free\. upgrade when it is useful/i })).toBeInTheDocument();
    expect(screen.getByText("$4.99")).toBeInTheDocument();
    expect(screen.getByText("$39.99")).toBeInTheDocument();
    expect(screen.getByText("$59.88").tagName).toBe("S");
    expect(screen.getByText(/save \$19\.89/i)).toBeInTheDocument();
    expect(screen.getByText(/equivalent to \$3\.33\/month/i)).toBeInTheDocument();
    expect(screen.getByText(/best value/i)).toBeInTheDocument();
    expect(screen.getByText(/simple access/i)).toBeInTheDocument();
    expect(screen.getByText(/introductory price may change/i)).toBeInTheDocument();
    expect(screen.queryByText(/keep this price/i)).not.toBeInTheDocument();
    expect(screen.getByText(/local currency at checkout/i)).toBeInTheDocument();
    expect(screen.getByText(/Additional Mathematics 0606: 2016-2018/i)).toBeInTheDocument();

    const options = container.querySelectorAll(".pricing-option");
    expect(options).toHaveLength(3);
    expect(within(options[0] as HTMLElement).getByRole("heading", { name: "Free" })).toBeInTheDocument();
    expect(within(options[0] as HTMLElement).getByText(/current plan/i)).toBeInTheDocument();
    expect(within(options[1] as HTMLElement).getByRole("heading", { name: "Annual" })).toBeInTheDocument();
    expect(within(options[1] as HTMLElement).getByRole("button", { name: /choose annual/i })).toBeInTheDocument();
    expect(within(options[2] as HTMLElement).getByRole("heading", { name: "Monthly" })).toBeInTheDocument();
    expect(within(options[2] as HTMLElement).getByRole("button", { name: /choose monthly/i })).toBeInTheDocument();
  });

  it("does not call free the current plan for a paid account", () => {
    render(<PricingContent authenticated hasPaidAccess />);
    expect(screen.queryByText(/current plan/i)).not.toBeInTheDocument();
    expect(screen.getByText(/paid access is active/i)).toBeInTheDocument();
  });
});
