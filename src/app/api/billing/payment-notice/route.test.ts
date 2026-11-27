import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const getUser = vi.fn(); const adminRpc = vi.fn(); const subscriptionsList = vi.fn();
let billingEnabled = true;
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ auth: { getUser } })) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ rpc: adminRpc })) }));
vi.mock("@/lib/stripe", () => ({ createStripeClient: vi.fn(() => ({ subscriptions: { list: subscriptionsList } })) }));
vi.mock("@/lib/stripe-config", () => ({ isStripeBillingEnabled: () => billingEnabled, getStripeConfig: () => ({ secretKey: "«redacted:sk_test_…»" }) }));
import { GET } from "@/app/api/billing/payment-notice/route";

const USER = "11111111-1111-4111-8111-111111111111";
const now = Math.floor(Date.now() / 1000);
const pastDue = {
  id: "sub_a", status: "past_due", customer: "cus_a", metadata: { user_id: USER },
  items: { data: [{ current_period_start: now - 86_400, current_period_end: now + 29 * 86_400 }] },
  latest_invoice: { id: "in_a", status: "open", customer: "cus_a", amount_remaining: 1000, currency: "usd", attempt_count: 1, next_payment_attempt: now + 86_400, hosted_invoice_url: "https://invoice.stripe.com/i/acct_1/x" },
};

describe("GET /api/billing/payment-notice", () => {
  beforeEach(() => { vi.clearAllMocks(); billingEnabled = true; });

  it("rejects signed-out reads before touching the database or Stripe", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const response = await GET();
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(adminRpc).not.toHaveBeenCalled();
    expect(subscriptionsList).not.toHaveBeenCalled();
  });

  it("skips Stripe for accounts that never started a checkout", async () => {
    getUser.mockResolvedValue({ data: { user: { id: USER } } });
    adminRpc.mockResolvedValue({ data: null, error: null });
    const response = await GET();
    expect(await response.json()).toEqual({ notice: null });
    expect(subscriptionsList).not.toHaveBeenCalled();
  });

  it("returns nothing while billing is switched off", async () => {
    billingEnabled = false;
    getUser.mockResolvedValue({ data: { user: { id: USER } } });
    expect(await (await GET()).json()).toEqual({ notice: null });
    expect(adminRpc).not.toHaveBeenCalled();
  });

  it("reads only the mapped customer's lapsed subscriptions and returns the notice", async () => {
    getUser.mockResolvedValue({ data: { user: { id: USER } } });
    adminRpc.mockResolvedValue({ data: "cus_a", error: null });
    subscriptionsList.mockImplementation(async ({ status }: { status: string }) => ({ data: status === "past_due" ? [pastDue] : [] }));
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(adminRpc).toHaveBeenCalledWith("get_stripe_customer_id", { p_user_id: USER });
    expect(subscriptionsList).toHaveBeenCalledWith({ customer: "cus_a", status: "past_due", limit: 10, expand: ["data.latest_invoice"] });
    expect(subscriptionsList).toHaveBeenCalledWith({ customer: "cus_a", status: "unpaid", limit: 10, expand: ["data.latest_invoice"] });
    const body = await response.json();
    expect(body.notice).toMatchObject({ invoiceId: "in_a", amountCents: 1000, currency: "usd", accessEnded: false, payUrl: "https://invoice.stripe.com/i/acct_1/x" });
    expect(JSON.stringify(body)).not.toContain("cus_a");
  });

  it("returns no notice once the renewal is paid", async () => {
    getUser.mockResolvedValue({ data: { user: { id: USER } } });
    adminRpc.mockResolvedValue({ data: "cus_a", error: null });
    subscriptionsList.mockResolvedValue({ data: [] });
    expect(await (await GET()).json()).toEqual({ notice: null });
  });

  it("answers 503 without detail when a lookup fails", async () => {
    getUser.mockResolvedValue({ data: { user: { id: USER } } });
    adminRpc.mockResolvedValue({ data: null, error: new Error("db down") });
    const failed = await GET();
    expect(failed.status).toBe(503);
    expect(await failed.json()).toEqual({ error: "Payment status is temporarily unavailable" });
    adminRpc.mockResolvedValue({ data: "cus_a", error: null });
    subscriptionsList.mockRejectedValue(new Error("stripe down"));
    expect((await GET()).status).toBe(503);
  });
});
