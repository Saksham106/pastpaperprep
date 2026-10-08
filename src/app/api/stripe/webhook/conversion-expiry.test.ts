import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
vi.mock("server-only", () => ({}));
const user = "150a3d0e-4c34-45cc-9748-68252f0fb8f1";
const intent = "250a3d0e-4c34-45cc-9748-68252f0fb8f1";
const mocks = vi.hoisted(() => ({ event: vi.fn(), retrieve: vi.fn(), target: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/stripe-config", () => ({ getStripeConfig: () => ({ secretKey: "test-fixture", webhookSecret: "fixture" }) }));
vi.mock("@/lib/stripe", () => ({ createStripeClient: () => ({ webhooks: { constructEvent: mocks.event }, checkout: { sessions: { retrieve: mocks.retrieve } } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.target }) }) }) }) }));
const session = () => ({ id: "cs_test_expire", mode: "payment", status: "expired", payment_status: "unpaid", customer: "cus_owned", client_reference_id: user,
 metadata: { user_id: user, billing_intent_id: intent, conversion_intent_id: intent, purchase_type: "lifetime", product_id: "lifetime_all_access" } });
beforeEach(() => {
 vi.clearAllMocks();
 mocks.event.mockReturnValue({ type: "checkout.session.expired", data: { object: session() } });
 mocks.retrieve.mockResolvedValue(session());
 mocks.target.mockResolvedValue({ data: { user_id: user, customer_id: "cus_owned", checkout_session_id: "cs_test_expire", status: "pending" }, error: null });
 mocks.rpc.mockResolvedValue({ data: true, error: null });
});
const deliver = () => POST(new Request("https://fixture.test/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": "fixture" }, body: "fixture" }));
describe("conversion expiry fencing", () => {
 it("releases only the provider-verified unpaid expired conversion", async () => {
  expect((await deliver()).status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith("expire_lifetime_conversion", { p_session_id: "cs_test_expire" });
  expect(mocks.rpc).toHaveBeenCalledWith("release_billing_checkout", { p_user_id: user, p_intent_id: intent });
 });
 it("ignores a stale expiry delivery if the provider session is already paid", async () => {
  mocks.retrieve.mockResolvedValue({ ...session(), status: "complete", payment_status: "paid" });
  expect((await deliver()).status).toBe(200); expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("does not release a foreign customer's target", async () => {
  mocks.target.mockResolvedValue({ data: { user_id: user, customer_id: "cus_foreign", checkout_session_id: "cs_test_expire", status: "pending" }, error: null });
  expect((await deliver()).status).toBe(503); expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it("leaves unrelated free-user expiry delivery untouched", async () => {
  mocks.event.mockReturnValue({ type: "checkout.session.expired", data: { object: { id: "cs_test_free", metadata: {} } } });
  expect((await deliver()).status).toBe(200); expect(mocks.retrieve).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled();
 });
});
