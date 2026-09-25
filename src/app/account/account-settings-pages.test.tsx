import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SubscriptionPage from "@/app/account/subscription/page";
import BillingPage from "@/app/account/billing/page";
import SecurityPage from "@/app/account/security/page";

describe("account settings read-only pages", () => {
  it("does not invent an itemized subscription from coarse access data", () => {
    render(<SubscriptionPage />);
    expect(screen.getByRole("heading", { name: /subscription/i })).toBeInTheDocument();
    expect(screen.getByText(/loading subscription details/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /change plan|cancel subscription/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/\$\d+/)).not.toBeInTheDocument();
  });

  it("keeps billing self-service in the secure Stripe portal", () => {
    render(<BillingPage />);
    expect(screen.getByRole("heading", { name: /billing/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /manage billing/i })).toBeInTheDocument();
    expect(screen.getByText(/payment methods and invoices/i)).toBeInTheDocument();
    expect(screen.getByText(/loading subscription details/i)).toBeInTheDocument();
    expect(screen.queryByText(/visa|mastercard|ending in/i)).not.toBeInTheDocument();
  });

  it("preserves password settings and provides a sign-out action", () => {
    render(<SecurityPage />);
    expect(screen.getByRole("heading", { name: /security/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /password settings/i })).toHaveAttribute("href", "/account/password");
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });
});
