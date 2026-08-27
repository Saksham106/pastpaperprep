import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccountPlanOverview } from "@/components/AccountPlanOverview";

describe("AccountPlanOverview", () => {
  it("routes plan details and changes to the pricing page", () => {
    render(<AccountPlanOverview hasPaidAccess={false} />);

    expect(screen.getByText(/plan details and billing live together/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view plans/i })).toHaveAttribute("href", "/pricing");
    expect(screen.queryByText(/every available question/i)).not.toBeInTheDocument();
  });
});
