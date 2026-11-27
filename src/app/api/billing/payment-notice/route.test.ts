import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const getUser = vi.fn(); const adminRpc = vi.fn(); const subscriptionsList = vi.fn(); const invoicesRetrieve = vi.fn();
let billingEnabled = true;
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ auth: { getUser } })) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ rpc: adminRpc })) }));
vi.mock("@/lib/stripe", () => ({ createStripeClient: vi.fn(() => ({ subscriptions: { list: subscriptionsList }, invoices: { retrieve: invoicesRetrieve } })) }));
vi.mock("@/lib/stripe-config", () => ({ isStripeBillingEnabled: () => billingEnabled, getStripeConfig: () => ({ secretKey: "«redacted:sk_test_…»" }) }));
import { GET } from "@/app/api/billing/payment-notice/route";

const USER = "11111111-1111-4111-8111-111111111111";
const now = Math.floor(Date.now() / 1000);
const pastDue = {
  id: "sub_a", status: "past_due", customer: "cus_a", metadata: { user_id: USER },
  items: { data: [{ current_period_start: now - 86_400, current_period_end: now + 29 * 86_400 }] },
  latest_invoice: { id: "in_a", status: "open", customer: "cus_a", amount_remaining: 1000, currency: "usd", attempt_count: 1, billing_reason: "subscription_cycle", next_payment_attempt: now + 86_400, hosted_invoice_url: "https://invoice.stripe.com/i/acct_1/x" },
};
const request = (query = "") => new Request(`https://pastpaperprep.com/api/billing/payment-notice${query}`);

function signedInWithCustomer() {
  getUser.mockResolvedValue({ data: { user: { id: USER } } });
  adminRpc.mockResolvedValue({ data: "cus_a", error: null });
}

describe("GET /api/billing/payment-notice", () => {
  beforeEach(() => { vi.clearAllMocks(); billingEnabled = true; });

  it("rejects signed-out reads before touching the database or Stripe", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(adminRpc).not.toHaveBeenCalled();
    expect(subscriptionsList).not.toHaveBeenCalled();
  });

  it("rejects a malformed invoice id before any lookup", async () => {
    getUser.mockResolvedValue({ data: { user: { id: USER } } });
    for (const bad of ["?invoice=", "?invoice=sub_123456789", "?invoice=in_../../x", "?invoice=in_short"]) {
      expect((await GET(request(bad))).status).toBe(400);
    }
    expect(adminRpc).not.toHaveBeenCalled();
  });

  it("skips Stripe for accounts that never started a checkout", async () => {
    getUser.mockResolvedValue({ data: { user: { id: USER } } });
    adminRpc.mockResolvedValue({ data: null, error: null });
    expect(await (await GET(request())).json()).toEqual({ notice: null, purchaseBlocked: false });
    expect(subscriptionsList).not.toHaveBeenCalled();
  });

  it("returns nothing while billing is switched off", async () => {
    billingEnabled = false;
    getUser.mockResolvedValue({ data: { user: { id: USER } } });
    expect(await (await GET(request())).json()).toEqual({ notice: null, purchaseBlocked: false });
    expect(adminRpc).not.toHaveBeenCalled();
  });

  it("reads every subscription of the mapped customer and returns the notice", async () => {
    signedInWithCustomer();
    subscriptionsList.mockResolvedValue({ data: [pastDue], has_more: false });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(adminRpc).toHaveBeenCalledWith("get_stripe_customer_id", { p_user_id: USER });
    expect(subscriptionsList).toHaveBeenCalledWith({ customer: "cus_a", status: "all", limit: 100, expand: ["data.latest_invoice"] });
    const body = await response.json();
    expect(body).toMatchObject({ purchaseBlocked: true, notice: { invoiceId: "in_a", amountCents: 1000, currency: "usd", accessEnded: false, payUrl: "https://invoice.stripe.com/i/acct_1/x" } });
    expect(body).not.toHaveProperty("invoicePaid");
    expect(JSON.stringify(body)).not.toContain("cus_a");
  });

  it("pages through the whole list so a later page's renewal is not missed", async () => {
    signedInWithCustomer();
    subscriptionsList
      .mockResolvedValueOnce({ data: [{ id: "sub_old", status: "canceled", customer: "cus_a", metadata: {} }], has_more: true })
      .mockResolvedValueOnce({ data: [pastDue], has_more: false });
    const body = await (await GET(request())).json();
    expect(subscriptionsList).toHaveBeenLastCalledWith({ customer: "cus_a", status: "all", limit: 100, expand: ["data.latest_invoice"], starting_after: "sub_old" });
    expect(body.notice).toMatchObject({ invoiceId: "in_a" });
  });

  it("reports a purchase block for an incomplete first payment, with no renewal notice", async () => {
    signedInWithCustomer();
    subscriptionsList.mockResolvedValue({ data: [{ id: "sub_i", status: "incomplete", customer: "cus_a", metadata: { user_id: USER }, latest_invoice: null }], has_more: false });
    expect(await (await GET(request())).json()).toEqual({ notice: null, purchaseBlocked: true });
  });

  it("confirms payment only for the exact invoice under this account's customer", async () => {
    signedInWithCustomer();
    subscriptionsList.mockResolvedValue({ data: [{ ...pastDue, status: "active" }], has_more: false });
    invoicesRetrieve.mockResolvedValueOnce({ id: "in_aaaaaaaa", customer: "cus_a", status: "paid" });
    expect(await (await GET(request("?invoice=in_aaaaaaaa"))).json()).toEqual({ notice: null, purchaseBlocked: false, invoicePaid: true });
    expect(invoicesRetrieve).toHaveBeenCalledWith("in_aaaaaaaa");

    invoicesRetrieve.mockResolvedValueOnce({ id: "in_aaaaaaaa", customer: "cus_other", status: "paid" });
    expect((await (await GET(request("?invoice=in_aaaaaaaa"))).json()).invoicePaid).toBe(false);

    for (const status of ["void", "uncollectible", "open"]) {
      invoicesRetrieve.mockResolvedValueOnce({ id: "in_aaaaaaaa", customer: "cus_a", status });
      expect((await (await GET(request("?invoice=in_aaaaaaaa"))).json()).invoicePaid).toBe(false);
    }

    invoicesRetrieve.mockRejectedValueOnce(Object.assign(new Error("No such invoice"), { code: "resource_missing" }));
    expect((await (await GET(request("?invoice=in_aaaaaaaa"))).json()).invoicePaid).toBe(false);
  });

  it("returns no notice and no block once the renewal is paid", async () => {
    signedInWithCustomer();
    subscriptionsList.mockResolvedValue({ data: [{ ...pastDue, status: "active" }], has_more: false });
    expect(await (await GET(request())).json()).toEqual({ notice: null, purchaseBlocked: false });
  });

  it("answers 503 without detail when a lookup fails", async () => {
    getUser.mockResolvedValue({ data: { user: { id: USER } } });
    adminRpc.mockResolvedValue({ data: null, error: new Error("db down") });
    const failed = await GET(request());
    expect(failed.status).toBe(503);
    expect(await failed.json()).toEqual({ error: "Payment status is temporarily unavailable" });
    adminRpc.mockResolvedValue({ data: "cus_a", error: null });
    subscriptionsList.mockRejectedValue(new Error("stripe down"));
    expect((await GET(request())).status).toBe(503);
    subscriptionsList.mockResolvedValue({ data: [pastDue], has_more: false });
    invoicesRetrieve.mockRejectedValue(new Error("stripe down"));
    expect((await GET(request("?invoice=in_aaaaaaaa"))).status).toBe(503);
  });

  it("refuses an unbounded subscription list", async () => {
    signedInWithCustomer();
    subscriptionsList.mockImplementation(async ({ starting_after }: { starting_after?: string }) => ({ data: [{ id: `sub_${starting_after ?? "0"}x`, status: "canceled", customer: "cus_a" }], has_more: true }));
    expect((await GET(request())).status).toBe(503);
    expect(subscriptionsList).toHaveBeenCalledTimes(5);
  });
});
