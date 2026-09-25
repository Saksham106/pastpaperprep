import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/billing/subscription/schedule/route";

const m = vi.hoisted(() => ({
  rpc: vi.fn(), list: vi.fn(), sessions: vi.fn(), invoices: vi.fn(),
  create: vi.fn(), update: vi.fn(), retrieveSchedule: vi.fn(), release: vi.fn(),
  retrieveSubscription: vi.fn(), retrievePrice: vi.fn(),
  user: { id: "u1" } as { id: string } | null,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: m.user } }) } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: m.rpc }) }));
vi.mock("@/lib/stripe-config", () => ({
  getStripeConfig: () => ({ secretKey: "sk_test_x", monthlyPriceId: "price_m", annualPriceId: "price_a", customMonthlyPriceId: "price_cm", customAnnualPriceId: "price_ca", singleMonthlyPriceId: "price_sm", singleAnnualPriceId: "price_sa", pairMonthlyPriceId: "price_pm", pairAnnualPriceId: "price_pa", allMonthlyPriceId: "price_am", allAnnualPriceId: "price_aa" }),
  isStripeBillingEnabled: () => true,
}));
vi.mock("@/lib/stripe", () => ({ createStripeClient: () => ({
  subscriptions: { list: m.list, retrieve: m.retrieveSubscription },
  checkout: { sessions: { list: m.sessions } }, invoices: { list: m.invoices },
  prices: { retrieve: m.retrievePrice },
  subscriptionSchedules: { create: m.create, update: m.update, retrieve: m.retrieveSchedule, release: m.release },
}) }));

const sub = () => ({ id: "s1", customer: "c1", status: "active", metadata: { user_id: "u1", product_id: "bundle_custom", price_id: "price_cm", billing_interval: "monthly", selected_bank_ids: '["ib-hl","ib-sl","igcse"]' }, schedule: null as string | null,
  pending_update: null, cancel_at_period_end: false, cancel_at: null, items: { data: [{ id: "i1", quantity: 3, current_period_start: 1_800_000_000, current_period_end: 1_900_000_000, price: { id: "price_cm", currency: "usd", active: true, recurring: { interval: "month", interval_count: 1 } } }] } });
const selection = { selectedBankIds: ["igcse", "ib-hl"], allAccess: false, interval: "monthly" };
const body = { intent: "create", ...selection, snapshot: { subscriptionId: "s1", currentPeriodStart: 1_800_000_000, currentPeriodEnd: 1_900_000_000, currentPriceId: "price_cm", currentQuantity: 3, currentProductId: "bundle_custom", currentSelectedBankIds: ["ib-hl", "ib-sl", "igcse"], currentInterval: "monthly", targetPriceId: "price_cm", quantity: 2, recurringSubtotalCents: 1000, selectedBankIds: ["ib-hl", "igcse"], allAccess: false, interval: "monthly", quotedAt: Math.floor(Date.now() / 1000) } };
const request = (value: unknown = body, origin = "https://pastpaperprep.com") => new Request("https://pastpaperprep.com/api/billing/subscription/schedule", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(value) });
let updated: Record<string, unknown>;
function schedule(current = sub()) {
  const phases = updated.phases as Array<Record<string, unknown>>;
  return { id: "sc1", subscription: "s1", customer: "c1", status: "active", end_behavior: "release", metadata: updated.metadata,
    current_phase: { start_date: 1_800_000_000, end_date: 1_900_000_000 },
    phases: [
      { ...phases[0], start_date: 1_800_000_000, end_date: 1_900_000_000 },
      { ...phases[1], start_date: 1_900_000_000, end_date: 1_910_000_000 },
    ], currentSubscription: current,
  };
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("STRIPE_PLAN_EDITOR_ENABLED", "true"); m.user = { id: "u1" };
  m.rpc.mockImplementation(async (name: string, args: { p_price_id?: string } = {}) => ({ data: name === "reserve_billing_checkout" || name === "release_billing_checkout" ? true : name === "get_stripe_customer_id" ? "c1" : name === "get_checkout_price_catalog" ? [{ price_id: args.p_price_id, product_id: args.p_price_id === "price_sm" ? "bank_igcse" : "bundle_custom", billing_interval: "monthly", active: true, grandfathered: false }] : null, error: null }));
  m.list.mockResolvedValue({ data: [sub()], has_more: false });
  m.sessions.mockResolvedValue({ data: [], has_more: false }); m.invoices.mockResolvedValue({ data: [], has_more: false });
  m.create.mockResolvedValue({ id: "sc1", subscription: "s1", status: "active" });
  m.update.mockImplementation(async (_id: string, payload: Record<string, unknown>) => { updated = payload; return schedule(); });
  m.retrieveSchedule.mockImplementation(async () => schedule());
  m.retrieveSubscription.mockResolvedValue({ ...sub(), schedule: "sc1" });
  m.retrievePrice.mockResolvedValue({ id: "price_cm", active: true, currency: "usd", recurring: { interval: "month", interval_count: 1 }, billing_scheme: "tiered", tiers_mode: "volume", tiers: [{ up_to: 1, flat_amount: 600, unit_amount: 0 }, { up_to: 2, flat_amount: 1000, unit_amount: 0 }, { up_to: 3, flat_amount: 1400, unit_amount: 0 }] });
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/billing/subscription/schedule", () => {
  it("previews the actual recurring base rate and renewal date without a provider write", async () => {
    const response = await POST(request({ intent: "preview", ...selection }));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result).toMatchObject({ status: "preview", snapshot: { subscriptionId: "s1", currentPeriodEnd: 1_900_000_000, targetPriceId: "price_cm", quantity: 2, recurringSubtotalCents: 1000, selectedBankIds: ["ib-hl", "igcse"], allAccess: false, interval: "monthly" } });
    expect(m.create).not.toHaveBeenCalled(); expect(m.rpc).toHaveBeenCalledWith("release_billing_checkout", expect.anything());
  });
  it("refuses a reviewed quote when the source plan quantity differs", async () => {
    const response = await POST(request({ ...body, snapshot: { ...body.snapshot, currentQuantity: 2 } }));
    expect(response.status).toBe(409); expect(m.create).not.toHaveBeenCalled();
  });
  it("refuses stale or changed quote before a provider write", async () => {
    const response = await POST(request({ ...body, snapshot: { ...body.snapshot, quotedAt: Math.floor(Date.now() / 1000) - 360, recurringSubtotalCents: 800 } }));
    expect(response.status).toBe(409); expect(m.create).not.toHaveBeenCalled();
  });
  it("is disabled without reserving", async () => { vi.stubEnv("STRIPE_PLAN_EDITOR_ENABLED", "false"); expect((await POST(request())).status).toBe(404); expect(m.rpc).not.toHaveBeenCalled(); });
  it("rejects cross-origin before reserving", async () => { expect((await POST(request(body, "https://evil.example"))).status).toBe(403); expect(m.rpc).not.toHaveBeenCalled(); });
  it("schedules a same-price bank reduction only at renewal, with exact old and new phase metadata", async () => {
    const response = await POST(request());
    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
    expect(m.create).toHaveBeenCalledWith({ from_subscription: "s1" }, expect.anything());
    expect(m.update).toHaveBeenCalledTimes(1);
    expect(updated).toMatchObject({ end_behavior: "release", metadata: { owner: "pastpaperprep", user_id: "u1", subscription_id: "s1", ownership_id: expect.any(String) } });
    const phases = updated.phases as Array<{ start_date: number; end_date?: number; metadata: Record<string, string>; items: Array<{ price: string; quantity: number }>; duration?: unknown }>;
    expect(phases).toHaveLength(2);
    expect(phases[0]).toMatchObject({ start_date: 1_800_000_000, end_date: 1_900_000_000, items: [{ price: "price_cm", quantity: 3 }], metadata: sub().metadata });
    expect(phases[0].duration).toBeUndefined();
    expect(phases[1]).toMatchObject({ start_date: 1_900_000_000, items: [{ price: "price_cm", quantity: 2 }], metadata: { product_id: "bundle_custom", price_id: "price_cm", selected_bank_ids: '["ib-hl","igcse"]', user_id: "u1" }, duration: { interval: "month", interval_count: 1 } });
    expect(phases[1].end_date).toBeUndefined();
    expect(m.rpc).toHaveBeenCalledWith("release_billing_checkout", expect.anything());
  });
  it("retains lease when Stripe accepts creation but phase update is ambiguous", async () => {
    m.update.mockRejectedValue(new Error("provider timeout"));
    expect((await POST(request())).status).toBe(503);
    expect(m.create).toHaveBeenCalledTimes(1);
    expect(m.rpc).not.toHaveBeenCalledWith("release_billing_checkout", expect.anything());
  });
  it("rejects an existing schedule without a second provider write", async () => {
    m.list.mockResolvedValue({ data: [{ ...sub(), schedule: "other" }], has_more: false });
    expect((await POST(request())).status).toBe(409);
    expect(m.create).not.toHaveBeenCalled();
  });
  it("rejects a provider readback that silently changes the target selection", async () => {
    m.retrieveSchedule.mockImplementation(async () => { const s = schedule() as ReturnType<typeof schedule> & { phases: Array<{ metadata: Record<string, string> }> }; s.phases[1].metadata = { ...s.phases[1].metadata, selected_bank_ids: '["ib-sl","igcse"]' }; return s; });
    expect((await POST(request())).status).toBe(503);
    expect(m.rpc).not.toHaveBeenCalledWith("release_billing_checkout", expect.anything());
  });
  it("undoes only the verified app-owned phase-zero schedule without altering the paid period", async () => {
    m.list.mockResolvedValue({ data: [{ ...sub(), schedule: "sc1" }], has_more: false });
    updated = { metadata: { owner: "pastpaperprep", user_id: "u1", subscription_id: "s1", ownership_id: "63c06037-9807-4a50-9506-004d828c5341" }, phases: [
      { start_date: 1_800_000_000, end_date: 1_900_000_000, items: [{ price: "price_cm", quantity: 3 }], metadata: sub().metadata },
      { start_date: 1_900_000_000, items: [{ price: "price_cm", quantity: 2 }], metadata: { ...sub().metadata, selected_bank_ids: '["ib-hl","igcse"]' } },
    ] };
    m.release.mockResolvedValue({ id: "sc1", status: "released" });
    m.retrieveSchedule.mockImplementation(async () => m.release.mock.calls.length ? { ...schedule(), status: "released", current_phase: null, subscription: null } : schedule());
    m.retrieveSubscription.mockResolvedValue({ ...sub(), schedule: null });
    const response = await POST(request({ intent: "undo", scheduleId: "sc1" }));
    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
    expect(m.release).toHaveBeenCalledWith("sc1", {}, expect.anything());
    expect(m.rpc).toHaveBeenCalledWith("release_billing_checkout", expect.anything());
  });
  it("refuses to undo an unrelated or already active target phase", async () => {
    m.list.mockResolvedValue({ data: [{ ...sub(), schedule: "sc1" }], has_more: false });
    updated = { metadata: { owner: "foreign", user_id: "u1", subscription_id: "s1", ownership_id: "63c06037-9807-4a50-9506-004d828c5341" }, phases: [
      { start_date: 1_800_000_000, end_date: 1_900_000_000, items: [{ price: "price_cm", quantity: 3 }], metadata: sub().metadata },
      { start_date: 1_900_000_000, items: [{ price: "price_cm", quantity: 2 }], metadata: sub().metadata },
    ] };
    expect((await POST(request({ intent: "undo", scheduleId: "sc1" }))).status).toBe(409);
    expect(m.release).not.toHaveBeenCalled();
  });
});
