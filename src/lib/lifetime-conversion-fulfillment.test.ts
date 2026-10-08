import { describe, expect, it, vi } from "vitest";
import { finishLifetimeConversion } from "@/lib/lifetime-conversion-fulfillment";
const intentId = "150a3d0e-4c34-45cc-9748-68252f0fb8f1";
const userId = "250a3d0e-4c34-45cc-9748-68252f0fb8f1";
function fixture(status = "pending") {
  const row = { intent_id: intentId, user_id: userId, customer_id: "cus_1", subscription_id: "sub_1", subscription_snapshot: { itemId: "si_1", priceId: "price_1", quantity: 1, productId: "bundle_all", selectedBankIds: ["ib-hl"] }, checkout_session_id: "cs_test_1", payment_intent_id: null, status };
  const from = vi.fn((table: string) => { const query: any = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: table === "lifetime_conversions" ? row : { user_id: userId, checkout_session_id: "cs_test_1", payment_intent_id: "pi_1", status: "paid" }, error: null }) }; return query; });
  const rpc = vi.fn(async () => ({ data: true, error: null }));
  const sub = { id: "sub_1", customer: "cus_1", status: "active", cancel_at_period_end: false, metadata: { user_id: userId, product_id: "bundle_all", selected_bank_ids: '["ib-hl"]' }, items: { data: [{ id: "si_1", price: { id: "price_1" }, quantity: 1 }] } };
  const subscriptions = { retrieve: vi.fn().mockResolvedValue(sub), update: vi.fn().mockResolvedValue({ ...sub, cancel_at_period_end: true }) };
  return { admin: { from, rpc } as any, stripe: { subscriptions } as any, row, sub, rpc };
}
describe("finishLifetimeConversion", () => {
  it("requires a durably paid purchase before canceling", async () => {
    const f = fixture(); f.admin.from = vi.fn((table: string) => { const query: any = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: table === "lifetime_conversions" ? f.row : { status: "pending" }, error: null }) }; return query; });
    await expect(finishLifetimeConversion(f.admin, f.stripe, { intentId, userId, customerId: "cus_1", sessionId: "cs_test_1", paymentIntentId: "pi_1" })).rejects.toThrow("Paid lifetime purchase");
    expect(f.stripe.subscriptions.update).not.toHaveBeenCalled();
  });
  it("stops only the verified subscription and persists completion fences", async () => {
    const f = fixture();
    f.stripe.subscriptions.retrieve.mockResolvedValueOnce(f.sub).mockResolvedValueOnce({ ...f.sub, cancel_at_period_end: true });
    await expect(finishLifetimeConversion(f.admin, f.stripe, { intentId, userId, customerId: "cus_1", sessionId: "cs_test_1", paymentIntentId: "pi_1" })).resolves.toMatchObject({ completed: true });
    expect(f.stripe.subscriptions.update).toHaveBeenCalledWith("sub_1", { cancel_at_period_end: true }, expect.objectContaining({ idempotencyKey: `ppp-lifetime-stop-${intentId}` }));
    expect(f.rpc).toHaveBeenNthCalledWith(1, "mark_lifetime_conversion_paid", expect.any(Object));
    expect(f.rpc).toHaveBeenNthCalledWith(2, "complete_lifetime_conversion", expect.any(Object));
  });
  it("does not cancel a subscription whose stored item identity changed", async () => {
    const f = fixture(); f.stripe.subscriptions.retrieve.mockResolvedValue({ ...f.sub, items: { data: [{ id: "si_changed", price: { id: "price_1" }, quantity: 1 }] } });
    await expect(finishLifetimeConversion(f.admin, f.stripe, { intentId, userId, customerId: "cus_1", sessionId: "cs_test_1", paymentIntentId: "pi_1" })).rejects.toThrow("snapshot");
    expect(f.stripe.subscriptions.update).not.toHaveBeenCalled();
  });
});
