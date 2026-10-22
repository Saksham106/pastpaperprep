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
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), useRouter: () => router }));
const cookieJar = vi.hoisted(() => ({ value: undefined as string | undefined }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => name === "ppp_checkout_pending" && cookieJar.value ? { name, value: cookieJar.value } : undefined }) }));

import AccountPage from "@/app/account/page";

describe("AccountPage checkout confirmation", () => {
  beforeEach(() => {
    entitlementQuery.eq.mockResolvedValue({ data: [], error: null });
    rpc.mockResolvedValue({ data: [], error: null });
    getClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } } });
    getUser.mockResolvedValue({ data: { user: { email: "student@example.com" } } });
    cookieJar.value = undefined;
  });

  it("shows neutral post-checkout guidance without trusting the query as payment proof", async () => {
    render(await AccountPage({ searchParams: Promise.resolve({ checkout: "success" }) }));

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/finishing your plan setup/i);
    expect(status).toHaveTextContent(/if you just paid/i);
    expect(status).not.toHaveTextContent(/payment successful/i);
    expect(screen.getByText("Your new plan is being set up. It will show here shortly.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View plans" })).not.toBeInTheDocument();
  });

  it("keeps the pending banner after a refresh drops the checkout param", async () => {
    cookieJar.value = `success.${Date.now() - 20_000}`;
    render(await AccountPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("status")).toHaveTextContent(/finishing your plan setup/i);
    expect(screen.queryByText(/without a paid plan/i)).not.toBeInTheDocument();
  });

  it("shows the plan as ready once a new entitlement lands", async () => {
    cookieJar.value = `success.${Date.now() - 20_000}`;
    entitlementQuery.eq.mockResolvedValue({ data: [{ product_id: "bank_ib_sl", status: "active", starts_at: new Date(Date.now() - 30_000).toISOString(), expires_at: "2099-01-01T00:00:00.000Z", source: "stripe" }], error: null });
    render(await AccountPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("status")).toHaveTextContent("You’re all set.");
    expect(screen.getByRole("link", { name: "Subscription details" })).toBeInTheDocument();
  });

  it("keeps waiting when only an older plan is active", async () => {
    entitlementQuery.eq.mockResolvedValue({ data: [{ product_id: "bank_ib_sl", status: "active", starts_at: "2026-01-01T00:00:00.000Z", expires_at: "2099-01-01T00:00:00.000Z", source: "stripe" }], error: null });
    render(await AccountPage({ searchParams: Promise.resolve({ checkout: "success" }) }));

    expect(screen.getByRole("status")).toHaveTextContent(/finishing your plan setup/i);
  });

  it("shows a Lifetime banner for a Lifetime return", async () => {
    render(await AccountPage({ searchParams: Promise.resolve({ checkout: "lifetime-pending" }) }));

    expect(screen.getByRole("status")).toHaveTextContent(/finishing your lifetime setup/i);
  });

  it("ignores an expired or malformed pending cookie", async () => {
    cookieJar.value = `success.${Date.now() - 31 * 60_000}`;
    render(await AccountPage({ searchParams: Promise.resolve({}) }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("offers a labeled Appearance control from Account Overview", async () => {
    render(await AccountPage({ searchParams: Promise.resolve({}) }));
    const appearance = screen.getByRole("group", { name: "Appearance" });
    expect(appearance).toHaveTextContent(/light or dark/i);
    expect(appearance).not.toHaveTextContent(/follows your device/i);
    expect(appearance.querySelector("button.theme-toggle")).toHaveAccessibleName("Switch to dark theme");
  });

  it("does not show a success message for untrusted checkout values", async () => {
    render(await AccountPage({ searchParams: Promise.resolve({ checkout: "cancelled" }) }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
