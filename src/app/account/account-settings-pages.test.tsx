import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { fetchAccessEntitlements } from "@/lib/custom-bundle-access";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getClaims: async () => ({ data: { claims: { sub: "user_example" } } }) } }) }));
vi.mock("@/lib/custom-bundle-access", () => ({ fetchAccessEntitlements: vi.fn().mockResolvedValue({ rows: [], error: null }) }));

import SubscriptionPage from "@/app/account/subscription/page";
import BillingPage from "@/app/account/billing/page";
import SecurityPage from "@/app/account/security/page";

describe("account settings read-only pages", () => {
  it("does not invent an itemized subscription from coarse access data", async () => {
    render(await SubscriptionPage());
    expect(screen.getByRole("heading", { name: /subscription/i })).toBeInTheDocument();
    expect(screen.getByText(/loading subscription details/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /change plan|cancel subscription/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/\$\d+/)).not.toBeInTheDocument();
  });

  it("shows complimentary All Access only for a current manual grant", async () => {
    vi.mocked(fetchAccessEntitlements).mockResolvedValueOnce({ rows: [{ productId: "bundle_all", source: "manual", status: "active", startsAt: "2025-01-01T00:00:00Z", expiresAt: null }], error: null });
    render(await SubscriptionPage());
    expect(screen.getByRole("heading", { name: "Complimentary All Access" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse question banks" })).toHaveAttribute("href", "/dashboard");
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
