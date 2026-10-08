import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLifetimeConversionCheckout as POST } from "@/lib/lifetime-conversion-checkout";
const intent = "150a3d0e-4c34-45cc-9748-68252f0fb8f1";
const m = vi.hoisted(() => ({ rpc: vi.fn(), list: vi.fn(), retrieve: vi.fn(), create: vi.fn(), access: vi.fn(), purchase: vi.fn(), pending: vi.fn(), sessionRetrieve: vi.fn(), sessionsList: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "user_1", email: "u@example.com" } } }) } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: m.rpc, from: (table: string) => ({ select: () => ({ eq: () => table === "lifetime_conversions" ? { in: () => ({ maybeSingle: m.pending }) } : { eq: () => ({ limit: m.purchase }) } }) }) }) }));
vi.mock("@/lib/stripe-config", () => ({ getStripeConfig: () => ({ secretKey: "test-fixture", siteUrl: "https://example.test", singleMonthlyPriceId: "price_month", singleAnnualPriceId: "price_year", customMonthlyPriceId: "price_cm", customAnnualPriceId: "price_ca", allMonthlyPriceId: "price_allm", allAnnualPriceId: "price_ally" }), isStripeBillingEnabled: () => true }));
vi.mock("@/lib/stripe", () => ({ createStripeClient: () => ({ subscriptions: { list: m.list, retrieve: m.retrieve }, checkout: { sessions: { create: m.create, retrieve: m.sessionRetrieve, list: m.sessionsList } } }) }));
vi.mock("@/lib/custom-bundle-access", () => ({ fetchAccessEntitlements: m.access }));
const subscription = () => ({ id: "sub_1", customer: "cus_1", status: "active", metadata: { user_id: "user_1", product_id: "bank_igcse", billing_interval: "monthly", price_id: "price_month" }, schedule: null, pending_update: null, cancel_at_period_end: false, cancel_at: null, items: { data: [{ id: "si_1", current_period_start: 1700000000, current_period_end: 1800000000, quantity: 1, price: { id: "price_month", currency: "usd", recurring: { interval: "month" } } }] } });
const pending = (sessionId: string | null = "cs_test_1") => ({ intent_id: intent, user_id: "user_1", customer_id: "cus_1", subscription_id: "sub_1", status: "pending", checkout_session_id: sessionId, expires_at: new Date(Date.now() + 1860000).toISOString(), subscription_snapshot: { priceId: "price_month", itemId: "si_1", quantity: 1, productId: "bank_igcse", selectedBankIds: ["igcse"], interval: "monthly", periodStart: new Date(1700000000000).toISOString(), periodEnd: new Date(1800000000000).toISOString(), status: "active", customerId: "cus_1" } });
const session = () => ({ id: "cs_test_1", customer: "cus_1", client_reference_id: "user_1", mode: "payment", status: "open", payment_status: "unpaid", url: "https://checkout.test", expires_at: Math.floor(Date.now() / 1000) + 1860, metadata: { user_id: "user_1", billing_intent_id: intent, conversion_intent_id: intent, product_id: "lifetime_all_access", purchase_type: "lifetime" }, line_items: { has_more: false, data: [{ quantity: 1, amount_subtotal: 29900, currency: "usd", price: { unit_amount: 29900, currency: "usd", recurring: null, product: { metadata: { purchase_type: "lifetime", product_id: "lifetime_all_access" } } } }] } });
beforeEach(() => {
 vi.clearAllMocks(); m.pending.mockResolvedValue({ data: null, error: null }); m.purchase.mockResolvedValue({ data: [], error: null }); m.access.mockResolvedValue({ rows: [], error: null });
 m.rpc.mockImplementation(async (name: string) => name === "get_stripe_customer_id" ? { data: "cus_1", error: null } : name === "get_checkout_price_catalog" ? { data: [{ price_id: "price_month", product_id: "bank_igcse", billing_interval: "monthly", active: true }], error: null } : ["reserve_lifetime_conversion", "attach_lifetime_conversion_session", "abort_lifetime_conversion", "expire_lifetime_conversion", "release_billing_checkout"].includes(name) ? { data: true, error: null } : { data: null, error: Error(name) });
 m.list.mockResolvedValue({ data: [subscription()], has_more: false }); m.retrieve.mockResolvedValue(subscription()); m.create.mockResolvedValue(session()); m.sessionRetrieve.mockResolvedValue(session()); m.sessionsList.mockResolvedValue({ data: [], has_more: false });
});
describe("lifetime conversion checkout and recovery", () => {
 it("reserves the owned target before creating a one-time $299 payment session", async () => {
  expect((await POST()).status).toBe(200);
  const reservationCall = m.rpc.mock.calls.findIndex(([name]) => name === "reserve_lifetime_conversion");
  expect(m.rpc.mock.invocationCallOrder[reservationCall]).toBeLessThan(m.create.mock.invocationCallOrder[0]);
  expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ mode: "payment", line_items: [expect.objectContaining({ price_data: expect.objectContaining({ unit_amount: 29900 }) })] }), expect.anything());
  expect(m.rpc).toHaveBeenCalledWith("attach_lifetime_conversion_session", expect.objectContaining({ p_session_id: "cs_test_1" }));
 });
 it("rejects stacked subscriptions before reserving", async () => {
  m.list.mockResolvedValue({ data: [subscription(), { ...subscription(), id: "sub_2" }], has_more: false });
  expect((await POST()).status).toBe(409); expect(m.create).not.toHaveBeenCalled();
 });
 it("retains a fence when session creation has an uncertain result", async () => {
  m.create.mockRejectedValue(Error("timeout")); expect((await POST()).status).toBe(503);
  expect(m.rpc).not.toHaveBeenCalledWith("abort_lifetime_conversion", expect.anything());
 });
 it("resumes an exact verified open session without creating another", async () => {
  m.pending.mockResolvedValue({ data: pending(), error: null });
  expect((await POST()).status).toBe(200); expect(m.create).not.toHaveBeenCalled();
 });
 it("recovers a lost response by finding and attaching the existing session", async () => {
  m.pending.mockResolvedValue({ data: pending(null), error: null }); m.sessionsList.mockResolvedValue({ data: [session()], has_more: false });
  expect((await POST()).status).toBe(200); expect(m.create).not.toHaveBeenCalled();
  expect(m.rpc).toHaveBeenCalledWith("attach_lifetime_conversion_session", expect.objectContaining({ p_intent_id: intent }));
 });
 it("retries the original idempotency key if creation produced no listed session", async () => {
  m.pending.mockResolvedValue({ data: pending(null), error: null });
  expect((await POST()).status).toBe(200);
  expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ conversion_intent_id: intent }) }), expect.objectContaining({ idempotencyKey: `pastpaperprep-lifetime-${intent}` }));
  expect(m.rpc).not.toHaveBeenCalledWith("reserve_lifetime_conversion", expect.anything());
 });
 it("does not start another checkout for a paid session awaiting fulfillment", async () => {
  m.pending.mockResolvedValue({ data: pending(), error: null }); m.sessionRetrieve.mockResolvedValue({ ...session(), status: "complete", payment_status: "paid" });
  expect((await POST()).status).toBe(503); expect(m.create).not.toHaveBeenCalled(); expect(m.rpc).not.toHaveBeenCalledWith("expire_lifetime_conversion", expect.anything());
 });
 it("rejects a wrong one-time line item rather than resuming it", async () => {
  m.pending.mockResolvedValue({ data: pending(), error: null }); const wrong = session(); wrong.line_items.data[0].price.unit_amount = 1; m.sessionRetrieve.mockResolvedValue(wrong);
  expect((await POST()).status).toBe(503); expect(m.create).not.toHaveBeenCalled();
 });
 it("aborts a known unattempted create when the target changed under reservation", async () => {
  m.retrieve.mockResolvedValue({ ...subscription(), status: "past_due" });
  expect((await POST()).status).toBe(409); expect(m.create).not.toHaveBeenCalled();
  expect(m.rpc).toHaveBeenCalledWith("abort_lifetime_conversion", expect.objectContaining({ p_user_id: "user_1" }));
 });
});
