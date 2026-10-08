import { describe, expect, it, vi } from "vitest";
import { finishLifetimeConversion } from "@/lib/lifetime-conversion-fulfillment";
type MockQuery = { select: () => MockQuery; eq: () => MockQuery; maybeSingle: () => Promise<{ data: unknown; error: null }> };
const intentId = "150a3d0e-4c34-45cc-9748-68252f0fb8f1";
const userId = "250a3d0e-4c34-45cc-9748-68252f0fb8f1";
function fixture(status = "pending", purchaseStatus = "paid") {
  const row = { intent_id: intentId, user_id: userId, customer_id: "cus_1", subscription_id: "sub_1", subscription_snapshot: { itemId: "si_1", priceId: "price_1", quantity: 1, productId: "bundle_all", selectedBankIds: [] as string[] }, checkout_session_id: "cs_test_1", payment_intent_id: (status === "renewals_stopped" ? "pi_1" : null) as string | null, status };
  const from = vi.fn((table: string) => { const query: MockQuery = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: table === "lifetime_conversions" ? row : { user_id: userId, checkout_session_id: "cs_test_1", payment_intent_id: "pi_1", status: purchaseStatus }, error: null }) }; return query; });
  const rpc = vi.fn(async () => ({ data: true, error: null }));
  const sub = { id: "sub_1", customer: "cus_1", status: "active", cancel_at_period_end: false, metadata: { user_id: userId, product_id: "bundle_all" }, items: { data: [{ id: "si_1", price: { id: "price_1" }, quantity: 1 }] } };
  const subscriptions = { retrieve: vi.fn().mockResolvedValue(sub), update: vi.fn().mockResolvedValue({ ...sub, cancel_at_period_end: true }) };
  return { admin: { from, rpc }, stripe: { subscriptions }, row, sub, rpc };
}
describe("finishLifetimeConversion", () => {
  it("requires a durably paid purchase before canceling", async () => {
    const f = fixture(); f.admin.from = vi.fn((table: string) => { const query: MockQuery = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: table === "lifetime_conversions" ? f.row : { status: "pending" }, error: null }) }; return query; });
    await expect(finishLifetimeConversion(f.admin as unknown as Parameters<typeof finishLifetimeConversion>[0], f.stripe as unknown as Parameters<typeof finishLifetimeConversion>[1], { intentId, userId, customerId: "cus_1", sessionId: "cs_test_1", paymentIntentId: "pi_1" })).rejects.toThrow("Paid lifetime purchase");
    expect(f.stripe.subscriptions.update).not.toHaveBeenCalled();
  });
  it("stops only the verified subscription and persists completion fences", async () => {
    const f = fixture();
    f.stripe.subscriptions.retrieve.mockResolvedValueOnce(f.sub).mockResolvedValueOnce({ ...f.sub, cancel_at_period_end: true });
    await expect(finishLifetimeConversion(f.admin as unknown as Parameters<typeof finishLifetimeConversion>[0], f.stripe as unknown as Parameters<typeof finishLifetimeConversion>[1], { intentId, userId, customerId: "cus_1", sessionId: "cs_test_1", paymentIntentId: "pi_1" })).resolves.toMatchObject({ completed: true });
    expect(f.stripe.subscriptions.update).toHaveBeenCalledWith("sub_1", { cancel_at_period_end: true }, expect.objectContaining({ idempotencyKey: `ppp-lifetime-stop-${intentId}` }));
    expect(f.rpc).toHaveBeenNthCalledWith(1, "mark_lifetime_conversion_paid", expect.any(Object));
    expect(f.rpc).toHaveBeenNthCalledWith(2, "complete_lifetime_conversion", expect.any(Object));
  });
  it("does not cancel a subscription whose stored item identity changed", async () => {
    const f = fixture(); f.stripe.subscriptions.retrieve.mockResolvedValue({ ...f.sub, items: { data: [{ id: "si_changed", price: { id: "price_1" }, quantity: 1 }] } });
    await expect(finishLifetimeConversion(f.admin as unknown as Parameters<typeof finishLifetimeConversion>[0], f.stripe as unknown as Parameters<typeof finishLifetimeConversion>[1], { intentId, userId, customerId: "cus_1", sessionId: "cs_test_1", paymentIntentId: "pi_1" })).rejects.toThrow("snapshot");
    expect(f.stripe.subscriptions.update).not.toHaveBeenCalled();
  });
  it("stops a fixed-bank subscription whose banks are represented by its product rather than custom metadata", async () => {
    const f = fixture(); f.row.subscription_snapshot.productId = "bank_igcse"; f.row.subscription_snapshot.selectedBankIds.push("igcse"); f.sub.metadata.product_id = "bank_igcse";
    f.stripe.subscriptions.retrieve.mockResolvedValueOnce(f.sub).mockResolvedValueOnce({ ...f.sub, cancel_at_period_end: true });
    await expect(finishLifetimeConversion(f.admin as unknown as Parameters<typeof finishLifetimeConversion>[0], f.stripe as unknown as Parameters<typeof finishLifetimeConversion>[1], { intentId, userId, customerId: "cus_1", sessionId: "cs_test_1", paymentIntentId: "pi_1" })).resolves.toMatchObject({ completed: true });
  });
  it("does not call Stripe when the durable payment fence is denied", async () => {
    const f = fixture(); f.rpc.mockResolvedValue({ data: false, error: null });
    await expect(finishLifetimeConversion(f.admin as unknown as Parameters<typeof finishLifetimeConversion>[0], f.stripe as unknown as Parameters<typeof finishLifetimeConversion>[1], { intentId, userId, customerId: "cus_1", sessionId: "cs_test_1", paymentIntentId: "pi_1" })).rejects.toThrow("payment fence");
    expect(f.stripe.subscriptions.update).not.toHaveBeenCalled();
  });
  it("recovers a paid conversion on webhook retry after a temporary snapshot mismatch", async () => {
    const f = fixture();
    f.rpc.mockImplementation(async (name?: string) => {
      if (name === "mark_lifetime_conversion_paid") { f.row.status = "paid"; f.row.payment_intent_id = "pi_1"; }
      if (name === "complete_lifetime_conversion") f.row.status = "renewals_stopped";
      return { data: true, error: null };
    });
    f.stripe.subscriptions.retrieve.mockResolvedValueOnce({ ...f.sub, items: { data: [{ id: "si_changed", price: { id: "price_1" }, quantity: 1 }] } })
      .mockResolvedValueOnce(f.sub).mockResolvedValueOnce({ ...f.sub, cancel_at_period_end: true });
    const input = { intentId, userId, customerId: "cus_1", sessionId: "cs_test_1", paymentIntentId: "pi_1" };
    await expect(finishLifetimeConversion(f.admin as unknown as Parameters<typeof finishLifetimeConversion>[0], f.stripe as unknown as Parameters<typeof finishLifetimeConversion>[1], input)).rejects.toThrow("snapshot");
    expect(f.row.status).toBe("paid");
    expect(f.stripe.subscriptions.update).not.toHaveBeenCalled();
    await expect(finishLifetimeConversion(f.admin as unknown as Parameters<typeof finishLifetimeConversion>[0], f.stripe as unknown as Parameters<typeof finishLifetimeConversion>[1], input)).resolves.toMatchObject({ completed: true });
    expect(f.row.status).toBe("renewals_stopped");
    expect(f.stripe.subscriptions.update).toHaveBeenCalledTimes(1);
  });
  it("retries a transient cancellation failure using the same idempotency key", async () => {
    const f = fixture(); f.stripe.subscriptions.update.mockRejectedValueOnce(Error("provider unavailable"));
    f.stripe.subscriptions.retrieve.mockResolvedValueOnce(f.sub).mockResolvedValueOnce(f.sub).mockResolvedValueOnce({ ...f.sub, cancel_at_period_end: true });
    const input = { intentId, userId, customerId: "cus_1", sessionId: "cs_test_1", paymentIntentId: "pi_1" };
    await expect(finishLifetimeConversion(f.admin as unknown as Parameters<typeof finishLifetimeConversion>[0], f.stripe as unknown as Parameters<typeof finishLifetimeConversion>[1], input)).rejects.toThrow("provider unavailable");
    await expect(finishLifetimeConversion(f.admin as unknown as Parameters<typeof finishLifetimeConversion>[0], f.stripe as unknown as Parameters<typeof finishLifetimeConversion>[1], input)).resolves.toMatchObject({ completed: true });
    expect(f.stripe.subscriptions.update.mock.calls[0][2].idempotencyKey).toEqual(f.stripe.subscriptions.update.mock.calls[1][2].idempotencyKey);
  });
  it("acknowledges an owned completed conversion after its Lifetime purchase was refunded without touching billing", async () => {
    const f = fixture("renewals_stopped", "refunded");
    await expect(finishLifetimeConversion(f.admin as unknown as Parameters<typeof finishLifetimeConversion>[0], f.stripe as unknown as Parameters<typeof finishLifetimeConversion>[1], { intentId, userId, customerId: "cus_1", sessionId: "cs_test_1", paymentIntentId: "pi_1" })).resolves.toMatchObject({ alreadyCompleted: true });
    expect(f.stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(f.stripe.subscriptions.update).not.toHaveBeenCalled();
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("does not newly stop renewals for a refunded purchase whose conversion was not completed", async () => {
    const f = fixture("pending", "refunded");
    await expect(finishLifetimeConversion(f.admin as unknown as Parameters<typeof finishLifetimeConversion>[0], f.stripe as unknown as Parameters<typeof finishLifetimeConversion>[1], { intentId, userId, customerId: "cus_1", sessionId: "cs_test_1", paymentIntentId: "pi_1" })).rejects.toThrow("Paid lifetime purchase");
    expect(f.stripe.subscriptions.update).not.toHaveBeenCalled();
  });
  it("rejects a different payment even for a completed conversion", async () => {
    const f = fixture("renewals_stopped", "refunded"); f.row.payment_intent_id = "pi_other";
    await expect(finishLifetimeConversion(f.admin as unknown as Parameters<typeof finishLifetimeConversion>[0], f.stripe as unknown as Parameters<typeof finishLifetimeConversion>[1], { intentId, userId, customerId: "cus_1", sessionId: "cs_test_1", paymentIntentId: "pi_1" })).rejects.toThrow("identity mismatch");
    expect(f.stripe.subscriptions.update).not.toHaveBeenCalled();
  });
  it("does not repeat provider cancellation for a completed conversion", async () => {
    const f = fixture("renewals_stopped");
    await expect(finishLifetimeConversion(f.admin as unknown as Parameters<typeof finishLifetimeConversion>[0], f.stripe as unknown as Parameters<typeof finishLifetimeConversion>[1], { intentId, userId, customerId: "cus_1", sessionId: "cs_test_1", paymentIntentId: "pi_1" })).resolves.toMatchObject({ alreadyCompleted: true });
    expect(f.stripe.subscriptions.update).not.toHaveBeenCalled();
  });
});
