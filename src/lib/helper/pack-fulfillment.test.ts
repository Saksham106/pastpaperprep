import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fulfillHelperPack, revokeHelperPackPayment } from "@/lib/helper/pack-fulfillment";

const USER = "11111111-1111-4111-8111-111111111111";
const meta = { user_id: USER, purchase_type: "helper_credits", pack_id: "credits_1000", credits: "1000", billing_intent_id: "intent-1" };
const session = (overrides: Record<string, unknown> = {}) => ({
  id: "cs_1", mode: "payment", payment_status: "paid", client_reference_id: USER, customer: "cus_1", payment_intent: "pi_1",
  amount_total: 499, currency: "usd", created: 1_795_000_000, metadata: { ...meta }, ...overrides,
}) as never;
const lineItem = (overrides: Record<string, unknown> = {}) => ({
  quantity: 1, amount_subtotal: 499, currency: "usd",
  price: { unit_amount: 499, currency: "usd", recurring: null, product: { metadata: { purchase_type: "helper_credits", pack_id: "credits_1000" } } },
  ...overrides,
});
const intent = (overrides: Record<string, unknown> = {}) => ({ status: "succeeded", customer: "cus_1", amount_received: 499, currency: "usd", metadata: { ...meta }, ...overrides });

const listLineItems = vi.fn();
const retrieve = vi.fn();
const rpc = vi.fn();
const stripe = { checkout: { sessions: { listLineItems } }, paymentIntents: { retrieve } } as never;
const admin = { rpc };

describe("Pepper credit pack fulfilment", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listLineItems.mockResolvedValue({ data: [lineItem()], has_more: false });
    retrieve.mockResolvedValue(intent());
    rpc.mockImplementation(async (name: string) => name === "get_stripe_customer_id" ? { data: "cus_1", error: null } : { data: "credited", error: null });
  });

  it("credits a verified pack once through the SQL function", async () => {
    expect(await fulfillHelperPack(stripe, admin, session(), 1)).toEqual({ status: 200, body: { received: true } });
    expect(rpc).toHaveBeenCalledWith("credit_helper_pack", {
      p_user_id: USER, p_pack_id: "credits_1000", p_credits: 1000, p_session_id: "cs_1", p_payment_intent_id: "pi_1",
      p_amount_cents: 499, p_currency: "usd", p_purchased_at: new Date(1_795_000_000_000).toISOString(),
    });
    rpc.mockImplementation(async (name: string) => name === "get_stripe_customer_id" ? { data: "cus_1", error: null } : { data: "duplicate", error: null });
    expect((await fulfillHelperPack(stripe, admin, session(), 1)).status).toBe(200);
  });

  it("waits for an unpaid asynchronous payment without crediting", async () => {
    expect((await fulfillHelperPack(stripe, admin, session({ payment_status: "unpaid" }), 1)).status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects any mismatch between the session, line item, payment and the fixed pack list", async () => {
    const tampered = [
      session({ metadata: { ...meta, pack_id: "credits_9000" } }),
      session({ metadata: { ...meta, credits: "3000" } }),
      session({ metadata: { ...meta, user_id: "22222222-2222-4222-8222-222222222222" } }),
      session({ amount_total: 100 }),
      session({ currency: "eur" }),
      session({ mode: "subscription" }),
    ];
    for (const bad of tampered) expect((await fulfillHelperPack(stripe, admin, bad, 1)).status).toBe(400);
    listLineItems.mockResolvedValueOnce({ data: [lineItem({ quantity: 3 })], has_more: false });
    expect((await fulfillHelperPack(stripe, admin, session(), 1)).status).toBe(400);
    retrieve.mockResolvedValueOnce(intent({ amount_received: 1 }));
    expect((await fulfillHelperPack(stripe, admin, session(), 1)).status).toBe(400);
    retrieve.mockResolvedValueOnce(intent({ metadata: { ...meta, billing_intent_id: "other" } }));
    expect((await fulfillHelperPack(stripe, admin, session(), 1)).status).toBe(400);
    expect(rpc).not.toHaveBeenCalledWith("credit_helper_pack", expect.anything());
  });

  it("asks Stripe to retry when anything can't be checked or stored", async () => {
    listLineItems.mockRejectedValueOnce(new Error("network"));
    expect((await fulfillHelperPack(stripe, admin, session(), 1)).status).toBe(500);
    rpc.mockImplementation(async (name: string) => name === "get_stripe_customer_id" ? { data: "cus_other", error: null } : { data: "credited", error: null });
    expect((await fulfillHelperPack(stripe, admin, session(), 1)).status).toBe(500);
    rpc.mockImplementation(async (name: string) => name === "get_stripe_customer_id" ? { data: "cus_1", error: null } : { data: null, error: { message: "boom" } });
    expect((await fulfillHelperPack(stripe, admin, session(), 1)).status).toBe(500);
  });

  it("removes a refunded or disputed pack's credits and leaves other payments alone", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await revokeHelperPackPayment(stripe, admin, "pi_1", "refunded")).toBe(true);
    expect(rpc).toHaveBeenCalledWith("revoke_helper_pack", { p_payment_intent_id: "pi_1", p_reason: "refunded" });
    rpc.mockClear();
    retrieve.mockResolvedValueOnce(intent({ metadata: { purchase_type: "lifetime" } }));
    expect(await revokeHelperPackPayment(stripe, admin, "pi_2", "disputed")).toBe(true);
    expect(rpc).not.toHaveBeenCalled();
    retrieve.mockRejectedValueOnce(new Error("network"));
    expect(await revokeHelperPackPayment(stripe, admin, "pi_3", "refunded")).toBe(false);
  });
});
