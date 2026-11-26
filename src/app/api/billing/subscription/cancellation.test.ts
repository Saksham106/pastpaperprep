import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./cancellation/route";

const m = vi.hoisted(() => ({ editor: "true", getUser: vi.fn(), rpc: vi.fn(), reserve: vi.fn(), release: vi.fn(), listSubs: vi.fn(), listSessions: vi.fn(), listInvoices: vi.fn(), update: vi.fn(), retrieve: vi.fn(), billing: true, userId: "user_1", customerId: "cus_1", subscription: null as unknown as ReturnType<typeof sub>, holdout: false, coupon: vi.fn(), customer: vi.fn(), activity: {} as Record<string, string | null> }));
vi.mock("@/lib/retention-offer", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/retention-offer")>()), isRetentionHoldout: () => m.holdout }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: m.getUser } }) }));
const latest = (table: string) => ({ select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: m.activity[table] ? { updated_at: m.activity[table] } : null, error: null }) }) }) }) }) });
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: m.rpc, from: latest }) }));
vi.stubEnv("STRIPE_PLAN_EDITOR_ENABLED", "true");
vi.mock("node:crypto", async (importOriginal) => ({ ...(await importOriginal<typeof import("node:crypto")>()), randomUUID: () => "intent_1" }));
vi.mock("@/lib/stripe-config", () => ({ isStripeBillingEnabled: () => m.billing, getStripeConfig: () => ({ secretKey: "sk_test_fake" }) }));
vi.mock("@/lib/stripe", () => ({ createStripeClient: () => ({ subscriptions: { list: m.listSubs, update: m.update, retrieve: m.retrieve }, coupons: { retrieve: m.coupon }, customers: { retrieve: m.customer }, checkout: { sessions: { list: m.listSessions } }, invoices: { list: m.listInvoices } }) }));
const req = (intent: string = "cancel", origin = "https://app.test", extra: Record<string, unknown> = {}) => new Request("https://app.test/api/billing/subscription/cancellation", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ intent, ...extra }) });
const sub = () => ({ id: "sub_1", customer: "cus_1", status: "active", metadata: { user_id: "user_1", product_id: "bank_igcse" } as Record<string, string>, pending_update: null, schedule: null, discounts: [] as unknown[], cancel_at: null as number | null, cancel_at_period_end: false, items: { data: [{ id: "si_1", current_period_end: 1900000000, price: { recurring: { interval: "month", interval_count: 1 } } }] } });
const COUPON = { id: "keep30", valid: true, percent_off: 30, amount_off: null, duration: "once" };
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("STRIPE_RETENTION_COUPON_ID", "keep30"); m.holdout = false; m.activity = {}; m.coupon.mockResolvedValue(COUPON); m.customer.mockResolvedValue({ id: "cus_1", discount: null }); m.billing = true; m.userId = "user_1"; m.customerId = "cus_1"; m.subscription = sub(); m.getUser.mockResolvedValue({ data: { user: { id: m.userId } } }); m.rpc.mockImplementation(async (name: string) => name === "get_stripe_customer_id" ? { data: m.customerId, error: null } : name === "reserve_billing_checkout" ? { data: m.reserve(), error: null } : name === "release_billing_checkout" ? { data: m.release(), error: null } : { data: true, error: null }); m.reserve.mockReturnValue(true); m.release.mockReturnValue(true); m.listSubs.mockResolvedValue({ data: [m.subscription], has_more: false }); m.listSessions.mockResolvedValue({ data: [], has_more: false }); m.listInvoices.mockResolvedValue({ data: [], has_more: false }); m.update.mockImplementation(async (_id: string, params: { cancel_at_period_end: boolean }) => ({ ...m.subscription, ...params })); m.retrieve.mockImplementation(async () => m.subscription); });
describe("subscription cancellation route", () => {
  it("rejects unauthenticated requests", async () => { m.getUser.mockResolvedValue({ data: { user: null } }); const r = await POST(req()); expect(r.status).toBe(401); expect(m.rpc).not.toHaveBeenCalled(); });
  it("rejects cross-origin requests", async () => { const r = await POST(req("cancel", "https://evil.test")); expect(r.status).toBe(403); expect(m.getUser).not.toHaveBeenCalled(); });
  it("rejects a mismatched subscription owner", async () => { m.subscription.metadata.user_id = "other"; const r = await POST(req()); expect(r.status).toBe(409); expect(m.update).not.toHaveBeenCalled(); });
  it("fails closed when Checkout is open", async () => { m.listSessions.mockResolvedValue({ data: [{ id: "cs_1" }], has_more: false }); const r = await POST(req()); expect(r.status).toBe(409); expect(m.update).not.toHaveBeenCalled(); });
  it("rejects reservation overlap", async () => { m.reserve.mockReturnValue(false); const r = await POST(req()); expect(r.status).toBe(409); expect(m.listSubs).not.toHaveBeenCalled(); });
  it("sets and reads back period-end cancellation", async () => { m.update.mockImplementation(async () => ({ ...m.subscription, cancel_at_period_end: true })); m.retrieve.mockImplementation(async () => ({ ...m.subscription, cancel_at_period_end: true })); const r = await POST(req()); expect(r.status).toBe(200); expect(m.update).toHaveBeenCalledWith("sub_1", { cancel_at_period_end: true }, expect.objectContaining({ idempotencyKey: expect.stringMatching(/^pastpaperprep-cancel-/), timeout: 30000 })); expect(m.release).toHaveBeenCalled(); expect((await r.json()).effectiveAt).toBe(new Date(1900000000 * 1000).toISOString()); });
  it("undoes cancellation without early entitlement mutation", async () => { m.subscription.cancel_at_period_end = true; m.update.mockImplementation(async () => ({ ...m.subscription, cancel_at_period_end: false })); m.retrieve.mockImplementation(async () => ({ ...m.subscription, cancel_at_period_end: false })); const r = await POST(req("undo")); expect(r.status).toBe(200); expect(m.update).toHaveBeenCalledWith("sub_1", { cancel_at_period_end: false }, expect.any(Object)); expect(m.rpc).not.toHaveBeenCalledWith("grant_entitlement", expect.anything()); });
  it("retains lease after ambiguous update failure", async () => { m.update.mockRejectedValue(new Error("timeout")); const r = await POST(req()); expect(r.status).toBe(503); expect(m.release).not.toHaveBeenCalled(); });
  it("returns idempotently when desired state already exists", async () => { m.subscription.cancel_at_period_end = true; m.retrieve.mockImplementation(async () => m.subscription); const r = await POST(req()); expect(r.status).toBe(200); expect(m.update).not.toHaveBeenCalled(); });
  it("stays disabled by default and never reserves billing", async () => { process.env.STRIPE_PLAN_EDITOR_ENABLED = "false"; try { expect((await POST(req())).status).toBe(404); expect(m.reserve).not.toHaveBeenCalled(); } finally { process.env.STRIPE_PLAN_EDITOR_ENABLED = "true"; } });
  it("does not override a separately scheduled cancellation date", async () => { m.subscription.cancel_at = 1800000000; expect((await POST(req())).status).toBe(409); expect(m.update).not.toHaveBeenCalled(); });
  it("does not report success when reservation release fails", async () => { m.release.mockReturnValue(false); m.retrieve.mockResolvedValue({ ...m.subscription, cancel_at_period_end: true }); expect((await POST(req())).status).toBe(503); });
  it("does not claim an old renewal date if the readback period changed", async () => { m.retrieve.mockResolvedValue({ ...m.subscription, cancel_at_period_end: true, items: { data: [{ id: "si_1", current_period_end: 1900000001 }] } }); expect((await POST(req())).status).toBe(503); expect(m.release).not.toHaveBeenCalled(); });
});

describe("cancellation reasons and retention offer", () => {
  const discounted = () => ({ ...m.subscription, metadata: { ...m.subscription.metadata, retention_offer_accepted_at: "2026-11-26T00:00:00.000Z" }, discounts: [{ id: "di_1", source: { coupon: "keep30", type: "coupon" } }] });
  it("stores the reason as Stripe cancellation feedback", async () => {
    m.retrieve.mockResolvedValue({ ...m.subscription, cancel_at_period_end: true });
    expect((await POST(req("cancel", undefined, { reason: "not_studying" }))).status).toBe(200);
    expect(m.update).toHaveBeenCalledWith("sub_1", { cancel_at_period_end: true, cancellation_details: { feedback: "unused" } }, expect.any(Object));
  });
  it("rejects unknown reasons and reasons on undo before any billing call", async () => {
    expect((await POST(req("cancel", undefined, { reason: "price_hike" }))).status).toBe(400);
    expect((await POST(req("undo", undefined, { reason: "other" }))).status).toBe(400);
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("offers the discount for a monthly plan without reserving or writing", async () => {
    const r = await POST(req("offer", undefined, { reason: "too_expensive" }));
    expect(await r.json()).toEqual({ offer: { kind: "discount", percentOff: 30 }, eligibleOffer: { kind: "discount", percentOff: 30 }, basis: "too_expensive", predicted: false, holdout: false });
    expect(m.update).not.toHaveBeenCalled();
    expect(m.reserve).not.toHaveBeenCalled();
  });
  it("shows the holdout nothing but logs what it qualified for", async () => {
    m.holdout = true;
    expect(await (await POST(req("offer", undefined, { reason: "too_expensive" }))).json()).toMatchObject({ offer: null, eligibleOffer: { kind: "discount" }, holdout: true });
  });
  it("predicts not studying from old activity when no reason is given", async () => {
    m.subscription.metadata = { user_id: "user_1", product_id: "bundle_all" };
    m.activity = { attempts: "2026-01-01T00:00:00Z", saved_worksheets: "2026-02-01T00:00:00Z" };
    expect(await (await POST(req("offer", undefined, { reason: null }))).json()).toMatchObject({ offer: { kind: "fewer_banks" }, basis: "not_studying", predicted: true });
  });
  it("never offers a year's discount on an annual plan", async () => {
    m.subscription.items.data[0].price.recurring.interval = "year";
    expect((await (await POST(req("offer", undefined, { reason: "too_expensive" }))).json()).offer).toBeNull();
    expect(m.coupon).not.toHaveBeenCalled();
  });
  it("applies the pre-approved coupon once, marks the subscription and reads it back", async () => {
    m.retrieve.mockImplementation(async () => discounted());
    const r = await POST(req("accept_discount"));
    expect(r.status).toBe(200);
    expect(m.update).toHaveBeenCalledWith("sub_1", { discounts: [{ coupon: "keep30" }], metadata: { retention_offer_accepted_at: expect.any(String) } }, expect.objectContaining({ idempotencyKey: expect.stringMatching(/^pastpaperprep-retention-discount-/) }));
    expect(m.release).toHaveBeenCalled();
    expect(await r.json()).toMatchObject({ status: "discount_applied", percentOff: 30 });
  });
  it.each([
    ["the holdout", () => { m.holdout = true; }],
    ["no coupon configured", () => { vi.stubEnv("STRIPE_RETENTION_COUPON_ID", ""); }],
    ["a coupon that is not 30% once", () => { m.coupon.mockResolvedValue({ ...COUPON, duration: "forever" }); }],
    ["an existing subscription discount", () => { m.subscription.discounts = [{ id: "di_old" }]; }],
    ["an existing customer discount", () => { m.customer.mockResolvedValue({ id: "cus_1", discount: { id: "di_c" } }); }],
    ["an acceptance within 12 months", () => { m.subscription.metadata.retention_offer_accepted_at = new Date(Date.now() - 100 * 86_400_000).toISOString(); }],
    ["an annual plan", () => { m.subscription.items.data[0].price.recurring.interval = "year"; }],
    ["a scheduled cancellation", () => { m.subscription.cancel_at_period_end = true; m.subscription.cancel_at = 1900000000; }],
  ])("refuses the discount for %s without writing", async (_name, setup) => {
    setup();
    expect((await POST(req("accept_discount"))).status).toBe(409);
    expect(m.update).not.toHaveBeenCalled();
    expect(m.release).toHaveBeenCalled();
  });
  it("re-offers after 12 months", async () => {
    m.subscription.metadata.retention_offer_accepted_at = new Date(Date.now() - 400 * 86_400_000).toISOString();
    m.retrieve.mockImplementation(async () => discounted());
    expect((await POST(req("accept_discount"))).status).toBe(200);
  });
  it("keeps the lease when the discount readback does not show the coupon", async () => {
    m.retrieve.mockImplementation(async () => m.subscription);
    expect((await POST(req("accept_discount"))).status).toBe(503);
    expect(m.release).not.toHaveBeenCalled();
  });
});
