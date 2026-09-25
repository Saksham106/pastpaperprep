import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/billing/subscription/change/confirm/route";

const m = vi.hoisted(() => ({ user: { id: "user_1" } as { id: string } | null, rpc: vi.fn(), list: vi.fn(), sessions: vi.fn(), invoices: vi.fn(), preview: vi.fn(), update: vi.fn(), retrieve: vi.fn(), access: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: m.user } }) } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: m.rpc }) }));
vi.mock("@/lib/stripe-config", () => ({ getStripeConfig: () => ({ secretKey: "sk_test_x", webhookSecret: "whsec_x", monthlyPriceId: "price_fm", annualPriceId: "price_fa", customMonthlyPriceId: "price_cm", customAnnualPriceId: "price_ca", singleMonthlyPriceId: "price_sm", singleAnnualPriceId: "price_sa", pairMonthlyPriceId: "price_pm", pairAnnualPriceId: "price_pa", allMonthlyPriceId: "price_am", allAnnualPriceId: "price_aa" }), isStripeBillingEnabled: () => true }));
vi.mock("@/lib/stripe", () => ({ createStripeClient: () => ({ subscriptions: { list: m.list, update: m.update, retrieve: m.retrieve }, checkout: { sessions: { list: m.sessions } }, invoices: { list: m.invoices, createPreview: m.preview } }) }));
vi.mock("@/lib/custom-bundle-access", () => ({ fetchAccessEntitlements: m.access }));

const sub = () => ({ id: "sub_1", customer: "cus_1", status: "active", metadata: { user_id: "user_1", product_id: "bank_igcse", billing_interval: "monthly", price_id: "price_sm", referral: "keep" }, schedule: null, pending_update: null, cancel_at_period_end: false, cancel_at: null, items: { data: [{ id: "si_1", quantity: 1, price: { id: "price_sm", currency: "usd", recurring: { interval: "month", interval_count: 1 } }, current_period_end: 1900000000 }] } });
const quote = { prorationDate: Math.floor(Date.now() / 1000), amountDueTodayCents: 500, estimatedCreditCents: 0, estimatedTaxesCents: 0, currency: "usd", currentSubscriptionId: "sub_1", currentItemId: "si_1", currentPriceId: "price_sm", currentQuantity: 1, periodEnd: 1900000000, targetPriceId: "price_cm", targetQuantity: 2, selectedBankIds: ["ib-hl", "igcse"], allAccess: false, interval: "monthly" };
function req(snapshot = quote, origin = "https://pastpaperprep.com") { return new Request("https://pastpaperprep.com/api/billing/subscription/change/confirm", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ selectedBankIds: ["igcse", "ib-hl"], allAccess: false, interval: "monthly", snapshot }) }); }

beforeEach(() => {
  vi.clearAllMocks(); process.env.STRIPE_PLAN_EDITOR_ENABLED = "true"; m.user = { id: "user_1" };
  m.rpc.mockImplementation(async (name: string, args: { p_price_id?: string } = {}) => name === "reserve_billing_checkout" || name === "release_billing_checkout" ? { data: true, error: null } : name === "get_stripe_customer_id" ? { data: "cus_1", error: null } : name === "get_checkout_price_catalog" ? { data: [{ price_id: args.p_price_id, product_id: args.p_price_id === "price_sm" ? "bank_igcse" : "bundle_custom", billing_interval: "monthly", active: true, grandfathered: false }], error: null } : { data: null, error: Error("Unexpected RPC") });
  m.list.mockResolvedValue({ data: [sub()], has_more: false }); m.sessions.mockResolvedValue({ data: [], has_more: false }); m.invoices.mockResolvedValue({ data: [], has_more: false });
  m.access.mockResolvedValue({ rows: [{ productId: "bank_igcse", status: "active" }], error: null });
  m.preview.mockResolvedValue({ currency: "usd", amount_due: 500, total: 500, subtotal: 500, total_taxes: [], lines: { data: [{ amount: 500, currency: "usd", parent: { subscription_item_details: { proration: true, subscription_item: "si_1" } } }], has_more: false } });
  m.update.mockImplementation(async (_id: string, params: Record<string, unknown>) => ({ ...sub(), items: { data: [{ ...sub().items.data[0], quantity: params.items && (params.items as Array<{ quantity: number }>)[0].quantity, price: { id: "price_cm", currency: "usd", recurring: { interval: "month", interval_count: 1 } } }] }, metadata: { ...sub().metadata, ...(params.metadata as object) } }));
  m.retrieve.mockImplementation(async () => m.update.mock.results[0]?.value);
});

describe("same-cadence subscription expansion confirmation", () => {
  it("reserves before reads, updates the existing item pending-if-incomplete, and preserves unrelated metadata", async () => {
    const result = await POST(req());
    expect(result.status).toBe(200);
    expect(m.rpc.mock.calls[0][0]).toBe("reserve_billing_checkout");
    expect(m.update).toHaveBeenCalledWith("sub_1", expect.objectContaining({ payment_behavior: "pending_if_incomplete", proration_behavior: "always_invoice", proration_date: quote.prorationDate, metadata: expect.objectContaining({ referral: "keep", product_id: "bundle_custom", selected_bank_ids: '["ib-hl","igcse"]' }) }), expect.objectContaining({ idempotencyKey: expect.any(String) }));
  });
  it("accepts All Access with Stripe removing selected_bank_ids on apply", async () => {
    const { getBillingBanks } = await import("@/lib/banks");
    m.rpc.mockImplementation(async (name: string, args: { p_price_id?: string } = {}) => name === "reserve_billing_checkout" || name === "release_billing_checkout" ? { data: true, error: null } : name === "get_stripe_customer_id" ? { data: "cus_1", error: null } : { data: [{ price_id: args.p_price_id, product_id: args.p_price_id === "price_sm" ? "bank_igcse" : "bundle_all", billing_interval: "monthly", active: true, grandfathered: false }], error: null });
    const all = getBillingBanks().map(({ slug }) => slug).sort();
    m.update.mockResolvedValue({ ...sub(), metadata: { user_id: "user_1", product_id: "bundle_all", billing_interval: "monthly", price_id: "price_am" }, items: { data: [{ ...sub().items.data[0], price: { id: "price_am" }, quantity: 1 }] } });
    m.retrieve.mockImplementation(async () => m.update.mock.results[0]?.value);
    const snapshot = { ...quote, targetPriceId: "price_am", targetQuantity: 1, selectedBankIds: all, allAccess: true };
    const request = new Request("https://pastpaperprep.com/api/billing/subscription/change/confirm", { method: "POST", headers: { origin: "https://pastpaperprep.com", "content-type": "application/json" }, body: JSON.stringify({ selectedBankIds: [], allAccess: true, interval: "monthly", snapshot }) });
    expect((await POST(request)).status).toBe(200);
  });
  it("rejects an empty Stripe preview rather than confirming an unquoted upgrade", async () => {
    m.preview.mockResolvedValue({ amount_due: 0, total: 0, subtotal: 0, currency: "usd", lines: { data: [], has_more: false }, total_taxes: [] });
    const response = await POST(req({ ...quote, amountDueTodayCents: 0, estimatedCreditCents: 0, estimatedTaxesCents: 0 }));
    expect(response.status).toBe(409);
    expect(m.update).not.toHaveBeenCalled();
  });
  it("rejects stale displayed quote without updating Stripe", async () => {
    expect((await POST(req({ ...quote, amountDueTodayCents: 501 }))).status).toBe(409);
    expect(m.update).not.toHaveBeenCalled();
  });
  it("rejects a subscription owned by another user", async () => {
    m.list.mockResolvedValue({ data: [{ ...sub(), metadata: { ...sub().metadata, user_id: "other" } }], has_more: false });
    expect((await POST(req())).status).toBe(409); expect(m.update).not.toHaveBeenCalled();
  });
  it("does not release the lease after a provider mutation error", async () => {
    m.update.mockRejectedValue(Error("network timeout"));
    expect((await POST(req())).status).toBe(503);
    expect(m.rpc.mock.calls.some(([name]) => name === "release_billing_checkout")).toBe(false);
  });
  it("rejects a duplicate billing operation when the shared lease is unavailable", async () => {
    m.rpc.mockImplementation(async (name: string) => name === "reserve_billing_checkout" ? { data: false, error: null } : { data: true, error: null });
    expect((await POST(req())).status).toBe(409);
    expect(m.list).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled();
  });
  it("rejects an expired quote before reserving", async () => {
    expect((await POST(req({ ...quote, prorationDate: quote.prorationDate - 301 }))).status).toBe(409);
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("rejects an unknown bank before any subscription update", async () => {
    const invalid = new Request("https://pastpaperprep.com/api/billing/subscription/change/confirm", { method: "POST", headers: { origin: "https://pastpaperprep.com", "content-type": "application/json" }, body: JSON.stringify({ selectedBankIds: ["not-a-bank"], allAccess: false, interval: "monthly", snapshot: quote }) });
    expect((await POST(invalid)).status).toBe(409); expect(m.update).not.toHaveBeenCalled();
  });
  it("rejects open Checkout and scheduled updates without mutation", async () => {
    m.sessions.mockResolvedValue({ data: [{ id: "cs_open" }], has_more: false });
    expect((await POST(req())).status).toBe(409); expect(m.update).not.toHaveBeenCalled();
    m.sessions.mockResolvedValue({ data: [], has_more: false });
    m.list.mockResolvedValue({ data: [{ ...sub(), schedule: "sub_sched" }], has_more: false });
    expect((await POST(req())).status).toBe(409); expect(m.update).not.toHaveBeenCalled();
  });
  it("retains the lease when applied Stripe readback has a mismatched price", async () => {
    m.retrieve.mockResolvedValue({ ...sub(), items: { data: [{ ...sub().items.data[0], price: { id: "price_wrong" }, quantity: 2 }] } });
    expect((await POST(req())).status).toBe(503);
    expect(m.rpc.mock.calls.some(([name]) => name === "release_billing_checkout")).toBe(false);
  });
  it("uses the pending response without granting access early", async () => {
    m.update.mockResolvedValue({ ...sub(), pending_update: { expires_at: 9999999999, subscription_items: [{ id: "si_1", price: "price_cm", quantity: 2 }], metadata: { product_id: "bundle_custom", selected_bank_ids: '["ib-hl","igcse"]', billing_interval: "monthly", price_id: "price_cm" } } });
    const response = await POST(req());
    expect(response.status).toBe(200); expect((await response.json()).status).toBe("pending");
    expect(m.retrieve).toHaveBeenCalledWith("sub_1");
  });
  it("does not report a pending change when Stripe has already changed current access metadata", async () => {
    m.update.mockResolvedValue({ ...sub(), metadata: { ...sub().metadata, product_id: "bundle_custom", selected_bank_ids: '["ib-hl","igcse"]' }, pending_update: { subscription_items: [{ id: "si_1", price: "price_cm", quantity: 2 }], metadata: { product_id: "bundle_custom", selected_bank_ids: '["ib-hl","igcse"]', billing_interval: "monthly", price_id: "price_cm" } } });
    expect((await POST(req())).status).toBe(503);
    expect(m.rpc.mock.calls.some(([name]) => name === "release_billing_checkout")).toBe(false);
  });
  it("rejects an applied change if Stripe added a second item", async () => {
    m.update.mockResolvedValue({ ...sub(), metadata: { ...sub().metadata, product_id: "bundle_custom", selected_bank_ids: '["ib-hl","igcse"]', price_id: "price_cm" }, items: { data: [{ ...sub().items.data[0], price: { id: "price_cm" }, quantity: 2 }, { ...sub().items.data[0], id: "si_extra" }] } });
    expect((await POST(req())).status).toBe(503);
    expect(m.rpc.mock.calls.some(([name]) => name === "release_billing_checkout")).toBe(false);
  });
  it("rejects missing Origin before reserving", async () => {
    const request = req(); const headers = new Headers(request.headers); headers.delete("origin");
    expect((await POST(new Request(request, { headers }))).status).toBe(403); expect(m.rpc).not.toHaveBeenCalled();
  });
  it("rejects cross-origin before reserving", async () => {
    expect((await POST(req(quote, "https://evil.example"))).status).toBe(403); expect(m.rpc).not.toHaveBeenCalled();
  });
});
