import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccountPlanOverview } from "@/components/AccountPlanOverview";

describe("AccountPlanOverview", () => {
  it("sends accounts without bank access to plans without inventing a subscription", () => {
    render(<AccountPlanOverview hasBankAccess={false} />);
    expect(screen.getByRole("link", { name: /view plans/i })).toHaveAttribute("href", "/pricing");
    expect(screen.queryByRole("button", { name: /manage billing/i })).not.toBeInTheDocument();
  });

  it("calls complimentary or paid entitlements bank access, not automatically a paid plan", () => {
    render(<AccountPlanOverview hasBankAccess />);
    expect(screen.getByText(/bank access is active/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /subscription details/i })).toHaveAttribute("href", "/account/subscription");
    expect(screen.queryByText(/paid access is active/i)).not.toBeInTheDocument();
  });
});
