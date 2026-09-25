import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.fn();
const getUser = vi.fn();
const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
const entitlementQuery = {
  select: vi.fn(),
  eq: vi.fn(),
  in: vi.fn(),
  lte: vi.fn(),
  or: vi.fn(),
};
entitlementQuery.select.mockReturnValue(entitlementQuery);
entitlementQuery.eq.mockReturnValue(entitlementQuery);
entitlementQuery.in.mockReturnValue(entitlementQuery);
entitlementQuery.lte.mockReturnValue(entitlementQuery);
entitlementQuery.or.mockResolvedValue({ data: [], error: null });

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getClaims, getUser },
    from: vi.fn(() => entitlementQuery),
    rpc,
  })),
}));
vi.mock("@/app/auth/actions", () => ({ signOut: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import AccountPage from "@/app/account/page";

describe("AccountPage checkout confirmation", () => {
  beforeEach(() => {
    entitlementQuery.eq.mockResolvedValue({ data: [], error: null });
    rpc.mockResolvedValue({ data: [], error: null });
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    getUser.mockResolvedValue({ data: { user: { email: "student@example.com" } } });
  });

  it("shows neutral post-checkout guidance without trusting the query as payment proof", async () => {
    render(await AccountPage({ searchParams: Promise.resolve({ checkout: "success" }) }));

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/finishing your plan setup/i);
    expect(status).toHaveTextContent(/if you just completed checkout/i);
    expect(status).toHaveTextContent(/refresh/i);
    expect(status).not.toHaveTextContent(/payment successful/i);
  });

  it("does not show a success message for untrusted checkout values", async () => {
    render(await AccountPage({ searchParams: Promise.resolve({ checkout: "cancelled" }) }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
