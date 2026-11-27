import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  user: { id: "user_1", email: "u@example.com" } as { id: string; email: string } | null,
  rpc: vi.fn(), list: vi.fn(), update: vi.fn(), retrieve: vi.fn(), sessions: vi.fn(), invoices: vi.fn(), invoice: vi.fn(), preview: vi.fn(), prices: vi.fn(), coupons: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: mocks.user } }) } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/stripe-config", () => ({ getStripeConfig: () => ({ secretKey: "sk_test_x", webhookSecret: "whsec_x", monthlyPriceId: "price_fm", annualPriceId: "price_fa", customMonthlyPriceId: "price_cm", customAnnualPriceId: "price_ca", singleMonthlyPriceId: "price_sm", singleAnnualPriceId: "price_sa", pairMonthlyPriceId: "price_pm", pairAnnualPriceId: "price_pa", allMonthlyPriceId: "price_am", allAnnualPriceId: "price_aa", siteUrl: "https://pastpaperprep.com" }), isStripeBillingEnabled: () => true }));
vi.mock("@/lib/stripe", () => ({ createStripeClient: () => ({
  subscriptions: { list: mocks.list, update: mocks.update, retrieve: mocks.retrieve },
  checkout: { sessions: { list: mocks.sessions } },
  invoices: { list: mocks.invoices, createPreview: mocks.preview, retrieve: mocks.invoice },
  prices: { retrieve: mocks.prices },
  coupons: { retrieve: mocks.coupons },
}) }));

import { POST } from "@/app/api/billing/subscription/annual-switch/route";

const CATALOG: Record<string, { product_id: string; billing_interval: string }> = {
  price_sm: { product_id: "bank_igcse", billing_interval: "monthly" },
  price_sa: { product_id: "bank_igcse", billing_interval: "annual" },
  price_cm: { product_id: "bundle_custom", billing_interval: "monthly" },
  price_ca: { product_id: "bundle_custom", billing_interval: "annual" },
};
const monthly = { id: "price_sm", currency: "usd", recurring: { interval: "month", interval_count: 1 } };
const sub = { id: "sub_1", customer: "cus_1", status: "active", metadata: { user_id: "user_1", product_id: "bank_igcse", billing_interval: "monthly", price_id: "price_sm" }, schedule: null, pending_update: null, pause_collection: null, cancel_at_period_end: false, cancel_at: null, items: { data: [{ id: "si_1", quantity: 1, price: monthly, current_period_end: 1_900_000_000 }] } };
const line = (amount: number) => ({ amount, currency: "usd", parent: { subscription_item_details: { proration: true, subscription_item: "si_1" } } });
const goodPreview = { currency: "usd", amount_due: 3000, total: 3000, subtotal: 3000, total_taxes: [], lines: { data: [line(-600), line(3600)], has_more: false } };

function request(body: unknown, origin = "https://pastpaperprep.com") {
  return new Request("https://pastpaperprep.com/api/billing/subscription/annual-switch", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
}
async function previewSnapshot() {
  const response = await POST(request({ intent: "preview" }));
  expect(response.status).toBe(200);
  return (await response.json()).snapshot;
}

describe("annual sale switch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-28T12:00:00Z"));
    vi.stubEnv("STRIPE_PLAN_EDITOR_ENABLED", "true");
    vi.stubEnv("STRIPE_SALE_COUPON_SINGLE", "bf-25");
    vi.stubEnv("STRIPE_SALE_COUPON_BUILDER_SMALL", "bf-30");
    vi.stubEnv("STRIPE_SALE_COUPON_BUILDER_LARGE", "bf-35");
    vi.stubEnv("STRIPE_SALE_COUPON_ALL", "bf-40");
    mocks.user = { id: "user_1", email: "u@example.com" };
    mocks.rpc.mockImplementation(async (name: string, args: { p_price_id?: string }) => {
      if (name === "get_stripe_customer_id") return { data: "cus_1", error: null };
      if (name === "get_checkout_price_catalog") {
        const row = CATALOG[String(args.p_price_id)];
        return { data: row ? [{ price_id: args.p_price_id, ...row, active: true, grandfathered: false }] : [], error: null };
      }
      if (name === "reserve_billing_checkout" || name === "release_billing_checkout") return { data: true, error: null };
      return { data: null, error: new Error("Unexpected RPC") };
    });
    mocks.list.mockResolvedValue({ data: [sub], has_more: false });
    mocks.sessions.mockResolvedValue({ data: [], has_more: false });
    mocks.invoices.mockResolvedValue({ data: [], has_more: false });
    mocks.preview.mockResolvedValue(goodPreview);
    mocks.prices.mockResolvedValue({ id: "price_sa", active: true, billing_scheme: "per_unit", unit_amount: 4800, currency: "usd", recurring: { interval: "year", interval_count: 1 } });
    mocks.coupons.mockImplementation(async (id: string) => ({ id, valid: true, percent_off: Number(id.split("-")[1]), amount_off: null, duration: "once" }));
    mocks.update.mockResolvedValue({});
    mocks.retrieve.mockResolvedValue({ ...sub, metadata: { ...sub.metadata, billing_interval: "annual", price_id: "price_sa", annual_sale: "black-friday-2026" }, items: { data: [{ id: "si_1", quantity: 1, price: { id: "price_sa" } }] } });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

  it("quotes the first year at the tier's sale price less this month's credit, without changing anything", async () => {
    const response = await POST(request({ intent: "preview" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    const data = await response.json();
    expect(data.estimate).toMatchObject({ amountDueTodayCents: 3000, creditCents: 600, firstYearCents: 3600, renewsAtCents: 4800, percentOff: 25 });
    expect(mocks.preview).toHaveBeenCalledWith(expect.objectContaining({ discounts: [{ coupon: "bf-25" }], subscription_details: expect.objectContaining({ items: [{ id: "si_1", price: "price_sa", quantity: 1 }], proration_behavior: "always_invoice" }) }));
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("uses the 2–3 bank tier for a three-bank monthly plan", async () => {
    const custom = { ...sub, metadata: { user_id: "user_1", product_id: "bundle_custom", billing_interval: "monthly", price_id: "price_cm", selected_bank_ids: JSON.stringify(["ib-hl", "ib-sl", "igcse"]) }, items: { data: [{ id: "si_1", quantity: 3, price: { ...monthly, id: "price_cm" }, current_period_end: 1_900_000_000 }] } };
    mocks.list.mockResolvedValue({ data: [custom], has_more: false });
    mocks.prices.mockResolvedValue({ id: "price_ca", active: true, billing_scheme: "per_unit", unit_amount: 4000, currency: "usd", recurring: { interval: "year", interval_count: 1 } });
    mocks.preview.mockResolvedValue({ ...goodPreview, amount_due: 7000, lines: { data: [line(-1400), line(8400)], has_more: false } });
    const data = await (await POST(request({ intent: "preview" }))).json();
    expect(data.estimate).toMatchObject({ percentOff: 30, firstYearCents: 8400, renewsAtCents: 12000 });
    expect(mocks.preview).toHaveBeenCalledWith(expect.objectContaining({ discounts: [{ coupon: "bf-30" }] }));
  });

  it("switches immediately, only if paid, with the coupon and the campaign tag", async () => {
    const snapshot = await previewSnapshot();
    const response = await POST(request({ intent: "confirm", snapshot }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "processing" });
    expect(mocks.update).toHaveBeenCalledWith("sub_1", expect.objectContaining({
      items: [{ id: "si_1", price: "price_sa", quantity: 1 }],
      discounts: [{ coupon: "bf-25" }],
      payment_behavior: "pending_if_incomplete",
      proration_behavior: "always_invoice",
      proration_date: snapshot.prorationDate,
      metadata: expect.objectContaining({ billing_interval: "annual", price_id: "price_sa", annual_sale: "black-friday-2026", product_id: "bank_igcse" }),
    }), expect.objectContaining({ idempotencyKey: expect.stringMatching(/^pastpaperprep-annual-switch-user_1-/) }));
    expect(mocks.rpc).toHaveBeenCalledWith("release_billing_checkout", expect.objectContaining({ p_user_id: "user_1" }));
  });

  const pendingUpdate = { subscription_items: [{ id: "si_1", price: { id: "price_sa" }, quantity: 1 }], discounts: ["di_1"], metadata: { ...sub.metadata, billing_interval: "annual", price_id: "price_sa", annual_sale: "black-friday-2026" } };

  it("reports a declined or 3DS payment as pending with Stripe's invoice page, monthly plan unchanged", async () => {
    const snapshot = await previewSnapshot();
    mocks.retrieve.mockResolvedValue({ ...sub, latest_invoice: "in_pending", pending_update: pendingUpdate });
    mocks.invoice.mockResolvedValue({ id: "in_pending", customer: "cus_1", hosted_invoice_url: "https://invoice.stripe.com/i/acct_1/test_1" });
    const response = await POST(request({ intent: "confirm", snapshot }));
    await expect(response.json()).resolves.toEqual({ status: "pending", payUrl: "https://invoice.stripe.com/i/acct_1/test_1" });
  });

  it("rejects a pending update that lost the coupon or the annual metadata", async () => {
    const snapshot = await previewSnapshot();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.retrieve.mockResolvedValue({ ...sub, latest_invoice: "in_pending", pending_update: { ...pendingUpdate, discounts: [] } });
    expect((await POST(request({ intent: "confirm", snapshot }))).status).toBe(503);
  });

  it("accepts Stripe's gross line with discount_amounts as the same sale price", async () => {
    mocks.preview.mockResolvedValue({ ...goodPreview, lines: { data: [line(-600), { ...line(4800), discount_amounts: [{ amount: 1200, discount: "di_1" }] }], has_more: false } });
    const data = await (await POST(request({ intent: "preview" }))).json();
    expect(data.estimate).toMatchObject({ amountDueTodayCents: 3000, firstYearCents: 3600 });
  });

  it("refuses to confirm when the fresh quote differs from the one shown", async () => {
    const snapshot = await previewSnapshot();
    mocks.preview.mockResolvedValue({ ...goodPreview, amount_due: 3100, lines: { data: [line(-500), line(3600)], has_more: false } });
    const response = await POST(request({ intent: "confirm", snapshot }));
    expect(response.status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("release_billing_checkout", expect.objectContaining({ p_user_id: "user_1" }));
  });

  it("refuses an expired quote before any billing call", async () => {
    const snapshot = await previewSnapshot();
    vi.setSystemTime(new Date("2026-11-28T12:06:00Z"));
    vi.clearAllMocks();
    expect((await POST(request({ intent: "confirm", snapshot }))).status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("refuses when Stripe's estimate is not the discounted annual line (coupon not applied)", async () => {
    mocks.preview.mockResolvedValue({ ...goodPreview, amount_due: 4200, lines: { data: [line(-600), line(4800)], has_more: false } });
    expect((await POST(request({ intent: "preview" }))).status).toBe(409);
  });

  it.each([
    ["an annual plan", () => mocks.list.mockResolvedValue({ data: [{ ...sub, metadata: { ...sub.metadata, billing_interval: "annual", price_id: "price_sa" }, items: { data: [{ ...sub.items.data[0], price: { id: "price_sa", recurring: { interval: "year" } } }] } }], has_more: false })],
    ["a plan set to cancel", () => mocks.list.mockResolvedValue({ data: [{ ...sub, cancel_at_period_end: true }], has_more: false })],
    ["an open invoice", () => mocks.invoices.mockImplementation(async ({ status }: { status: string }) => ({ data: status === "open" ? [{ id: "in_open" }] : [], has_more: false }))],
    ["a draft renewal invoice", () => mocks.invoices.mockImplementation(async ({ status }: { status: string }) => ({ data: status === "draft" ? [{ id: "in_draft" }] : [], has_more: false }))],
    ["an existing discount on the plan", () => mocks.list.mockResolvedValue({ data: [{ ...sub, discounts: ["di_retention"] }], has_more: false })],
    ["an open Checkout", () => mocks.sessions.mockResolvedValue({ data: [{ id: "cs_open" }], has_more: false })],
    ["the sale being over", () => vi.setSystemTime(new Date("2026-12-02T00:00:00Z"))],
    ["sale coupons not configured", () => vi.stubEnv("STRIPE_SALE_COUPON_ALL", "")],
  ])("refuses %s without a quote", async (_label, setup) => {
    setup();
    expect((await POST(request({ intent: "preview" }))).status).toBe(409);
    expect(mocks.preview).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("returns SALE_UNAVAILABLE for a deleted sale coupon", async () => {
    mocks.coupons.mockRejectedValue(Object.assign(new Error("No such coupon"), { code: "resource_missing" }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await POST(request({ intent: "preview" }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: "SALE_UNAVAILABLE" });
  });

  it.each([
    ["a cross-origin request", () => request({ intent: "preview" }, "https://evil.example"), 403],
    ["a malformed body", () => request(["preview"]), 400],
    ["a confirm without a snapshot", () => request({ intent: "confirm" }), 400],
  ])("rejects %s before any billing call", async (_label, make, status) => {
    expect((await POST(make())).status).toBe(status);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("is unavailable when the plan editor is off", async () => {
    vi.stubEnv("STRIPE_PLAN_EDITOR_ENABLED", "false");
    expect((await POST(request({ intent: "preview" }))).status).toBe(404);
  });
});
