import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ rpc: vi.fn(), state: vi.fn(), finish: vi.fn() }));
const userId = "150a3d0e-4c34-45cc-9748-68252f0fb8f1";
const intentId = "250a3d0e-4c34-45cc-9748-68252f0fb8f1";
const metadata = { user_id: userId, product_id: "lifetime_all_access", purchase_type: "lifetime", billing_intent_id: intentId, conversion_intent_id: intentId };
vi.mock("@/lib/stripe-config", async (original) => ({ ...await original<typeof import("@/lib/stripe-config")>(), getStripeConfig: () => ({ secretKey: "test-only-fixture", webhookSecret: "whsec_fixture" }) }));
vi.mock("@/lib/lifetime-conversion-fulfillment", () => ({ finishLifetimeConversion: m.finish }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: m.rpc, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: m.state }) }) }) }) }));
vi.mock("@/lib/stripe", () => ({ createStripeClient: () => ({
  webhooks: { constructEvent: () => ({ id: "evt_1", type: "checkout.session.completed", created: 1790000000, data: { object: { id: "cs_test_1", client_reference_id: userId, customer: "cus_1", payment_intent: "pi_1", mode: "payment", payment_status: "paid", amount_total: 29900, currency: "usd", created: 1790000000, metadata } } }) },
  checkout: { sessions: { listLineItems: async () => ({ has_more: false, data: [{ quantity: 1, amount_subtotal: 29900, currency: "usd", price: { unit_amount: 29900, currency: "usd", recurring: null, product: { metadata: { purchase_type: "lifetime", product_id: "lifetime_all_access" } } } }] }) } },
  paymentIntents: { retrieve: async () => ({ id: "pi_1", customer: "cus_1", status: "succeeded", amount_received: 29900, currency: "usd", metadata }) },
}) }));
import { POST } from "@/app/api/stripe/webhook/route";
const request = () => new Request("https://example.test/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": "fixture" }, body: "{}" });
beforeEach(() => {
  vi.clearAllMocks();
  m.rpc.mockImplementation(async (name: string) => name === "get_stripe_customer_id" ? { data: "cus_1", error: null } : { data: null, error: { code: "P0001", message: "lifetime payment is not eligible for fulfillment" } });
  m.state.mockResolvedValue({ data: { status: "refunded" }, error: null });
});
describe("paid Lifetime replay after durable adverse payment state", () => {
  it.each(["refunded", "lost"])("acknowledges terminal %s without granting access or touching old subscription billing", async (status) => {
    m.state.mockResolvedValue({ data: { status }, error: null });
    expect((await POST(request())).status).toBe(200);
    expect(m.finish).not.toHaveBeenCalled();
  });
  it("keeps an open dispute retryable so a later win can still fulfill", async () => {
    m.state.mockResolvedValue({ data: { status: "disputed" }, error: null });
    expect((await POST(request())).status).toBe(500);
    expect(m.finish).not.toHaveBeenCalled();
  });
  it("does not swallow a missing adverse state", async () => {
    m.state.mockResolvedValue({ data: null, error: null });
    expect((await POST(request())).status).toBe(500);
  });
  it("returns a retryable response for unfinished conversion work and completes the same paid event on retry", async () => {
    m.rpc.mockImplementation(async (name: string) => name === "get_stripe_customer_id" ? { data: "cus_1", error: null } : { data: "duplicate", error: null });
    m.finish.mockRejectedValueOnce(new Error("Subscription no longer matches stored conversion snapshot")).mockResolvedValueOnce({ completed: true });
    expect((await POST(request())).status).toBe(503);
    expect((await POST(request())).status).toBe(200);
    expect(m.finish).toHaveBeenCalledTimes(2);
    expect(m.finish.mock.calls[0][2]).toEqual(m.finish.mock.calls[1][2]);
  });
  it("does not swallow a failed authority read", async () => {
    m.state.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    expect((await POST(request())).status).toBe(500);
  });
});
