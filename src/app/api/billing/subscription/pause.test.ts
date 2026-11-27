import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./pause/route";

const NOW = Date.parse("2026-11-26T12:00:00Z");
const PERIOD_END = Date.parse("2026-12-26T00:00:00Z") / 1000;
const m = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), reserve: vi.fn(), release: vi.fn(), listSubs: vi.fn(), listSessions: vi.fn(), listInvoices: vi.fn(), update: vi.fn(), retrieve: vi.fn(), subscription: null as unknown as Record<string, unknown> & { metadata: Record<string, string>; items: { data: Record<string, unknown>[] } } }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: m.getUser } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: m.rpc }) }));
vi.mock("node:crypto", async (importOriginal) => ({ ...(await importOriginal<typeof import("node:crypto")>()), randomUUID: () => "intent_1" }));
vi.mock("@/lib/stripe-config", () => ({ isStripeBillingEnabled: () => true, getStripeConfig: () => ({ secretKey: "sk_test_fake" }) }));
vi.mock("@/lib/stripe", () => ({ createStripeClient: () => ({ subscriptions: { list: m.listSubs, update: m.update, retrieve: m.retrieve }, checkout: { sessions: { list: m.listSessions } }, invoices: { list: m.listInvoices } }) }));
const req = (body: unknown, origin = "https://app.test") => new Request("https://app.test/api/billing/subscription/pause", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
const sub = () => ({ id: "sub_1", customer: "cus_1", status: "active", billing_mode: { type: "classic" }, billing_cycle_anchor: Date.parse("2026-08-26T00:00:00Z") / 1000, metadata: { user_id: "user_1", product_id: "bank_igcse" } as Record<string, string>, pending_update: null, schedule: null, pause_collection: null as unknown, cancel_at: null, cancel_at_period_end: false, items: { data: [{ id: "si_1", current_period_start: PERIOD_END - 30 * 86400, current_period_end: PERIOD_END, price: { recurring: { interval: "month", interval_count: 1 } } }] as Record<string, unknown>[] } });
const pausedMeta = { pause_access_until: "2026-12-26T00:00:00.000Z", pause_resumes_at: "2027-01-26T00:00:00.000Z" };

beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  vi.stubEnv("STRIPE_PLAN_EDITOR_ENABLED", "true"); vi.stubEnv("STRIPE_PAUSE_ENABLED", "true");
  m.subscription = sub() as typeof m.subscription; m.update.mockReset().mockResolvedValue({}); m.retrieve.mockReset();
  m.getUser.mockResolvedValue({ data: { user: { id: "user_1" } } });
  m.rpc.mockImplementation(async (name: string) => name === "get_stripe_customer_id" ? { data: "cus_1", error: null } : name === "reserve_billing_checkout" ? { data: m.reserve(), error: null } : name === "release_billing_checkout" ? { data: m.release(), error: null } : { data: true, error: null });
  m.reserve.mockReturnValue(true); m.release.mockReturnValue(true);
  m.listSubs.mockImplementation(async () => ({ data: [m.subscription], has_more: false }));
  m.listSessions.mockResolvedValue({ data: [], has_more: false }); m.listInvoices.mockResolvedValue({ data: [], has_more: false });
});

describe("pause route", () => {
  it("blocks new bookings until the release flag is set, before any billing call", async () => {
    vi.stubEnv("STRIPE_PAUSE_ENABLED", "false");
    expect((await POST(req({ intent: "pause", months: 1 }))).status).toBe(404);
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("still lets an already-paused student undo while new bookings are off", async () => {
    vi.stubEnv("STRIPE_PAUSE_ENABLED", "false");
    m.subscription.pause_collection = { behavior: "void" }; m.subscription.metadata = { ...m.subscription.metadata, ...pausedMeta };
    m.retrieve.mockImplementation(async () => ({ ...m.subscription, pause_collection: null, metadata: { user_id: "user_1", product_id: "bank_igcse" } }));
    expect((await POST(req({ intent: "undo" }))).status).toBe(200);
  });
  it("rejects bad input before any billing call", async () => {
    for (const body of [null, [], { intent: "pause", months: 4 }, { intent: "pause", months: "1" }, { intent: "undo", months: 1 }, { intent: "freeze" }]) expect((await POST(req(body))).status).toBe(400);
    expect((await POST(req({ intent: "pause", months: 1 }, "https://evil.test"))).status).toBe(403);
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("books a pause from the end of the paid period and reads it back", async () => {
    m.retrieve.mockImplementation(async () => ({ ...m.subscription, pause_collection: { behavior: "void", resumes_at: Date.parse("2027-01-25T00:00:00Z") / 1000 }, metadata: { ...m.subscription.metadata, ...pausedMeta } }));
    const r = await POST(req({ intent: "pause", months: 1 }));
    expect(r.status).toBe(200);
    expect(m.update).toHaveBeenCalledWith("sub_1", { pause_collection: { behavior: "void", resumes_at: Date.parse("2027-01-25T00:00:00Z") / 1000 }, metadata: pausedMeta }, expect.objectContaining({ idempotencyKey: "pastpaperprep-pause-intent_1" }));
    expect(await r.json()).toEqual({ status: "pause_scheduled", months: 1, accessUntil: "2026-12-26T00:00:00.000Z", resumesAt: "2027-01-26T00:00:00.000Z" });
    expect(m.release).toHaveBeenCalled();
  });
  it.each([
    ["an annual plan", () => { (m.subscription.items.data[0].price as { recurring: { interval: string } }).recurring.interval = "year"; }],
    ["a scheduled cancellation", () => { m.subscription.cancel_at_period_end = true; m.subscription.cancel_at = PERIOD_END; }],
    ["an existing pause", () => { m.subscription.pause_collection = { behavior: "void" }; m.subscription.metadata = { ...m.subscription.metadata, ...pausedMeta }; }],
  ])("refuses to pause %s without writing", async (_name, setup) => {
    setup();
    expect((await POST(req({ intent: "pause", months: 2 }))).status).toBe(409);
    expect(m.update).not.toHaveBeenCalled();
    expect(m.release).toHaveBeenCalled();
  });
  it("keeps the lease when the pause readback doesn't match", async () => {
    m.retrieve.mockImplementation(async () => m.subscription);
    expect((await POST(req({ intent: "pause", months: 1 }))).status).toBe(503);
    expect(m.release).not.toHaveBeenCalled();
  });
  it("undoes a booked pause while the paid period lasts", async () => {
    m.subscription.pause_collection = { behavior: "void" }; m.subscription.metadata = { ...m.subscription.metadata, ...pausedMeta };
    m.retrieve.mockImplementation(async () => ({ ...m.subscription, pause_collection: null, metadata: { user_id: "user_1", product_id: "bank_igcse" } }));
    expect((await POST(req({ intent: "undo" }))).status).toBe(200);
    expect(m.update).toHaveBeenCalledWith("sub_1", { pause_collection: "", metadata: { pause_access_until: "", pause_resumes_at: "" } }, expect.any(Object));
  });
  describe("once the pause has started", () => {
    const VOIDED_END = Date.parse("2027-01-26T00:00:00Z") / 1000;
    beforeEach(() => {
      vi.setSystemTime(Date.parse("2027-01-05T10:00:00Z"));
      m.subscription.pause_collection = { behavior: "void" }; m.subscription.metadata = { ...m.subscription.metadata, ...pausedMeta };
      m.subscription.items.data[0].current_period_start = PERIOD_END; m.subscription.items.data[0].current_period_end = VOIDED_END;
    });
    it("refuses undo and points to resume instead", async () => {
      const r = await POST(req({ intent: "undo" }));
      expect(r.status).toBe(409); expect((await r.json()).error).toMatch(/Resume now/);
    });
    it("restarts billing today at full price, only if the payment succeeds, and moves the resume marker", async () => {
      const now = Date.parse("2027-01-05T10:00:00Z") / 1000;
      m.retrieve.mockImplementation(async () => ({ ...m.subscription, pause_collection: null, latest_invoice: { status: "paid", amount_paid: 600 }, items: { data: [{ ...m.subscription.items.data[0], current_period_start: now, current_period_end: now + 31 * 86400 }] } }));
      const r = await POST(req({ intent: "resume_now" }));
      expect(r.status).toBe(200);
      expect(m.update).toHaveBeenCalledWith("sub_1", { pause_collection: "", billing_cycle_anchor: "now", proration_behavior: "none", payment_behavior: "error_if_incomplete", metadata: { pause_resumes_at: new Date((now - 60) * 1000 + 86_400_000).toISOString() } }, expect.objectContaining({ idempotencyKey: "pastpaperprep-pause-resume-intent_1" }));
      expect((await r.json()).status).toBe("resumed");
      expect(m.release).toHaveBeenCalled();
    });
    it("refuses early resume in flexible billing mode, where Stripe wouldn't charge in the same call", async () => {
      m.subscription.billing_mode = { type: "flexible" };
      const r = await POST(req({ intent: "resume_now" }));
      expect(r.status).toBe(409); expect((await r.json()).error).toMatch(/hello@pastpaperprep.com/);
      expect(m.update).not.toHaveBeenCalled();
    });
    it("tells the student when the card is declined and changes nothing", async () => {
      m.update.mockRejectedValue(Object.assign(new Error("declined"), { type: "StripeCardError" }));
      const r = await POST(req({ intent: "resume_now" }));
      expect(r.status).toBe(402); expect(m.retrieve).not.toHaveBeenCalled(); expect(m.release).toHaveBeenCalled();
    });
    it("keeps the lease if Stripe didn't start a paid period", async () => {
      m.retrieve.mockImplementation(async () => ({ ...m.subscription, pause_collection: null, latest_invoice: { status: "void", amount_paid: 0 } }));
      expect((await POST(req({ intent: "resume_now" }))).status).toBe(503);
      expect(m.release).not.toHaveBeenCalled();
    });
  });
});
