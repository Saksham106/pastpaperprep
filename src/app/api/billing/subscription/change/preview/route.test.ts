import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/billing/subscription/change/preview/route";

const mocks = vi.hoisted(() => ({ user: { id: "user_1", email: "u@example.com" } as { id: string; email: string } | null, rpc: vi.fn(), list: vi.fn(), sessions: vi.fn(), invoices: vi.fn(), preview: vi.fn(), prices: vi.fn(), access: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: mocks.user } }) } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/stripe-config", () => ({ getStripeConfig: () => ({ secretKey: "sk_test_x", webhookSecret: "whsec_x", monthlyPriceId: "price_fm", annualPriceId: "price_fa", customMonthlyPriceId: "price_cm", customAnnualPriceId: "price_ca", singleMonthlyPriceId: "price_sm", singleAnnualPriceId: "price_sa", pairMonthlyPriceId: "price_pm", pairAnnualPriceId: "price_pa", allMonthlyPriceId: "price_am", allAnnualPriceId: "price_aa", siteUrl: "https://pastpaperprep.com" }), isStripeBillingEnabled: () => true }));
vi.mock("@/lib/stripe", () => ({ createStripeClient: () => ({ subscriptions: { list: mocks.list }, checkout: { sessions: { list: mocks.sessions } }, invoices: { list: mocks.invoices, createPreview: mocks.preview }, prices: { retrieve: mocks.prices } }) }));
vi.mock("@/lib/custom-bundle-access", () => ({ fetchAccessEntitlements: mocks.access }));

const price = { id: "price_sm", currency: "usd", recurring: { interval: "month", interval_count: 1 } };
const sub = { id: "sub_1", customer: "cus_1", status: "active", metadata: { user_id: "user_1", product_id: "bank_igcse", billing_interval: "monthly", price_id: "price_sm" }, schedule: null, pending_update: null, cancel_at_period_end: false, cancel_at: null, items: { data: [{ id: "si_1", quantity: 1, price, current_period_end: 1900000000 }] } };
function request(body: unknown = { selectedBankIds: ["igcse", "ib-hl"], allAccess: false, interval: "monthly" }, origin = "https://pastpaperprep.com") { return new Request("https://pastpaperprep.com/api/billing/subscription/change/preview", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) }); }

beforeEach(() => {
  vi.clearAllMocks(); process.env.STRIPE_PLAN_EDITOR_ENABLED = "true";
  mocks.user = { id: "user_1", email: "u@example.com" };
  mocks.rpc.mockImplementation(async (name: string, args: { p_price_id?: string }) => name === "get_stripe_customer_id"
    ? { data: "cus_1", error: null }
    : name === "get_checkout_price_catalog"
      ? { data: args.p_price_id === "price_sm"
        ? [{ price_id: "price_sm", product_id: "bank_igcse", billing_interval: "monthly", active: true, grandfathered: false }]
        : [{ price_id: "price_cm", product_id: "bundle_custom", billing_interval: "monthly", active: true, grandfathered: false }], error: null }
      : { data: null, error: new Error("Unexpected RPC") });
  mocks.list.mockResolvedValue({ data: [sub], has_more: false });
  mocks.sessions.mockResolvedValue({ data: [], has_more: false });
  mocks.invoices.mockResolvedValue({ data: [], has_more: false });
  mocks.access.mockResolvedValue({ rows: [{ productId: "bank_igcse", status: "active", startsAt: "2020-01-01T00:00:00Z", expiresAt: null }], error: null });
  mocks.preview.mockResolvedValue({ currency: "usd", amount_due: 500, total: 500, subtotal: 500, total_taxes: [], lines: { data: [{ proration: true, amount: 500, currency: "usd", parent: { subscription_item_details: { proration: true, subscription_item: "si_1" } } }], has_more: false } });
  mocks.prices.mockResolvedValue({ id: "price_cm", active: true, billing_scheme: "tiered", tiers_mode: "graduated", currency: "usd", recurring: { interval: "month", interval_count: 1 }, tiers: [{ up_to: 1, unit_amount: 600, flat_amount: 0 }, { up_to: null, unit_amount: 400, flat_amount: 0 }] });
});

describe("subscription change preview", () => {
  it("returns a no-store estimated expansion quote without changing the subscription", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    const data = await response.json();
    expect(data.estimate.amountDueTodayCents).toBe(500);
    expect(data.estimate.recurringSubtotalCents).toBe(1000);
    expect(mocks.preview).toHaveBeenCalledTimes(1);
  });
  it("rejects cross-origin requests before Stripe calls", async () => {
    expect((await POST(request(undefined, "https://evil.example"))).status).toBe(403);
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("rejects when editor feature flag is not explicitly enabled", async () => {
    process.env.STRIPE_PLAN_EDITOR_ENABLED = "false";
    expect((await POST(request())).status).toBe(404);
  });
  it("rejects open checkout sessions", async () => {
    mocks.sessions.mockResolvedValue({ data: [{ id: "cs_open" }], has_more: false });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.preview).not.toHaveBeenCalled();
  });
  it("rejects a pending subscription update", async () => {
    mocks.list.mockResolvedValue({ data: [{ ...sub, pending_update: { expires_at: 123 } }], has_more: false });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.preview).not.toHaveBeenCalled();
  });
  it("refuses to quote an upgrade while an earlier invoice remains open", async () => {
    mocks.invoices.mockResolvedValue({ data: [{ id: "in_open", customer: "cus_1", status: "open" }], has_more: false });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.preview).not.toHaveBeenCalled();
  });
  it("rejects unrecognized invoice lines rather than quoting renewal charges", async () => {
    mocks.preview.mockResolvedValue({ currency: "usd", amount_due: 500, total: 500, subtotal: 500, total_taxes: [], lines: { data: [{ amount: 500, currency: "usd", parent: { subscription_item_details: { proration: false } } }], has_more: false } });
    expect((await POST(request())).status).toBe(409);
  });
  it("rejects incomplete Stripe pagination", async () => {
    mocks.sessions.mockResolvedValue({ data: [], has_more: true });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.preview).not.toHaveBeenCalled();
  });
  it("rejects a manual grant overlapping the selected expansion", async () => {
    mocks.access.mockResolvedValue({ rows: [{ productId: "bank_ib_hl", status: "active", startsAt: "2020-01-01T00:00:00Z", expiresAt: null }], error: null });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.preview).not.toHaveBeenCalled();
  });
  it("can estimate a current fixed Checkout plan whose metadata omits interval and price", async () => {
    mocks.list.mockResolvedValue({ data: [{ ...sub, metadata: { user_id: "user_1", product_id: "bank_igcse" } }], has_more: false });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.preview).toHaveBeenCalledTimes(1);
  });
  it("rejects missing Stripe subscription ownership metadata", async () => {
    mocks.list.mockResolvedValue({ data: [{ ...sub, metadata: { product_id: "bank_igcse", price_id: "price_sm" } }], has_more: false });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.preview).not.toHaveBeenCalled();
  });
  it("rejects a grandfathered or inactive catalog tuple without previewing a price", async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === "get_stripe_customer_id" ? { data: "cus_1", error: null } : { data: [{ price_id: "price_sm", product_id: "bank_igcse", billing_interval: "monthly", active: false, grandfathered: true }], error: null });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.preview).not.toHaveBeenCalled();
  });
  it("shows the actual credit lines separately from the net adjustment", async () => {
    mocks.preview.mockResolvedValue({ currency: "usd", amount_due: 977, total: 977, subtotal: 977, total_taxes: [], lines: { data: [
      { amount: -976, currency: "usd", parent: { subscription_item_details: { proration: true } } },
      { amount: 1953, currency: "usd", parent: { subscription_item_details: { proration: true } } },
    ], has_more: false } });
    const response = await POST(request());
    expect((await response.json()).estimate.estimatedCreditCents).toBe(976);
  });
});
