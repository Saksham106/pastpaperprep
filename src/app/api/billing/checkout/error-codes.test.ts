import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { getCheckoutReferral } = vi.hoisted(() => ({ getCheckoutReferral: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/referral-account", () => ({ getCheckoutReferral }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: () => ({ value: "tampered.cookie" }) })) }));

const getUser = vi.fn();
const userFrom = vi.fn();
const userRpc = vi.fn().mockResolvedValue({ data: [], error: null });
const customersSearch = vi.fn();
const customersCreate = vi.fn();
const sessionsCreate = vi.fn();
const sessionsList = vi.fn();
const sessionsExpire = vi.fn();
const subscriptionsList = vi.fn();
const adminRpc = vi.fn();
let billingEnabled = true;

function mockAdminRpc(
  customerId: string | null = null,
  reservationGranted = true,
  claimedCustomerId?: string,
  confirmationGranted = true,
) {
  adminRpc.mockImplementation(async (functionName: string, args?: Record<string, unknown>) => {
    if (functionName === "get_checkout_price_catalog") {
      const priceId = args?.p_price_id;
      if (priceId === "price_single_monthly") return { data: [
        { price_id: priceId, product_id: "bank_ib_sl", billing_interval: "monthly", grandfathered: false, active: true },
        { price_id: priceId, product_id: "bank_ib_hl", billing_interval: "monthly", grandfathered: false, active: true },
      ], error: null };
      const rows: Record<string, unknown> = {
        price_custom_monthly: { price_id: priceId, product_id: "bundle_custom", billing_interval: "monthly", grandfathered: true, active: false },
      };
      return { data: rows[String(priceId)] ? [rows[String(priceId)]] : [], error: null };
    }
    if (functionName === "reserve_billing_checkout") return { data: reservationGranted, error: null };
    if (functionName === "confirm_billing_checkout" || functionName === "confirm_addon_billing_checkout" || functionName === "confirm_paid_bundle_billing_checkout") return { data: confirmationGranted, error: null };
    if (functionName === "release_billing_checkout") return { data: true, error: null };
    if (functionName === "claim_stripe_customer") {
      return { data: claimedCustomerId ?? args?.p_customer_id, error: null };
    }
    if (functionName === "get_stripe_customer_id") return { data: customerId, error: null };
    return { data: null, error: new Error("Unexpected billing RPC") };
  });
}

function entitlementQuery(data: unknown[] = [], error: unknown = null) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(async () => ({ data, error })),
    })),
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from: userFrom, rpc: userRpc })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ rpc: adminRpc })),
}));
vi.mock("@/lib/stripe", () => ({
  createStripeClient: vi.fn(() => ({
    customers: { create: customersCreate, search: customersSearch },
    checkout: { sessions: { create: sessionsCreate, expire: sessionsExpire, list: sessionsList } },
    subscriptions: { list: subscriptionsList },
  })),
}));
vi.mock("@/lib/stripe-config", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/stripe-config")>();
  return {
    ...original,
    isStripeBillingEnabled: () => billingEnabled,
    getStripeConfig: () => ({
      secretKey: "sk_test_example",
      webhookSecret: "whsec_example",
      monthlyPriceId: "price_monthly",
      annualPriceId: "price_annual",
      customMonthlyPriceId: "price_custom_monthly",
      customAnnualPriceId: "price_custom_annual",
      singleMonthlyPriceId: "price_single_monthly",
      singleAnnualPriceId: "price_single_annual",
      pairMonthlyPriceId: "price_pair_monthly",
      pairAnnualPriceId: "price_pair_annual",
      allMonthlyPriceId: "price_all_monthly",
      allAnnualPriceId: "price_all_annual",
      siteUrl: "https://pastpaperprep.com",
    }),
  };
});

import { POST } from "@/app/api/billing/checkout/route";

const user = { id: "150a3d0e-4c34-45cc-9748-68252f0fb8f1", email: "student@example.com" };
const activeEntitlement = { product_id: "bank_ib_sl", status: "active", starts_at: "2026-01-01T00:00:00.000Z", expires_at: "2099-01-01T00:00:00.000Z" };

function checkout(body: Record<string, unknown>) {
  return POST(new Request("https://pastpaperprep.com/api/billing/checkout", { method: "POST", body: JSON.stringify(body) }));
}

describe("POST /api/billing/checkout error codes", () => {
  afterEach(() => vi.unstubAllEnvs());

  beforeEach(() => {
    vi.clearAllMocks();
    billingEnabled = true;
    getUser.mockResolvedValue({ data: { user } });
    userFrom.mockReturnValue(entitlementQuery());
    userRpc.mockResolvedValue({ data: [], error: null });
    mockAdminRpc("cus_existing");
    getCheckoutReferral.mockResolvedValue(null);
    sessionsList.mockResolvedValue({ data: [] });
    sessionsExpire.mockResolvedValue({ status: "expired" });
    subscriptionsList.mockResolvedValue({ data: [] });
    sessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/new" });
  });

  it.each(["past_due", "unpaid", "incomplete"])("sends a new buyer with a %s subscription to fix payment", async (status) => {
    subscriptionsList.mockResolvedValue({ data: [{ id: "sub_lapsed", status, metadata: { user_id: user.id, product_id: "bank_ib_hl" } }] });

    const response = await checkout({ interval: "monthly", productId: "bank_ib_sl" });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "PAYMENT_ISSUE" });
    expect(sessionsCreate).not.toHaveBeenCalled();
    expect(adminRpc).toHaveBeenCalledWith("release_billing_checkout", expect.objectContaining({ p_user_id: user.id }));
  });

  it("sends an add-on buyer with a lapsed subscription to fix payment before buying more", async () => {
    userFrom.mockReturnValue(entitlementQuery([activeEntitlement]));
    subscriptionsList.mockResolvedValue({ data: [{ id: "sub_lapsed", status: "past_due", metadata: { user_id: user.id, product_id: "bank_ib_sl" } }] });

    const response = await checkout({ interval: "monthly", productId: "bank_ib_hl" });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "PAYMENT_ISSUE" });
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("still reports another account's subscription as a conflict, not a payment issue", async () => {
    subscriptionsList.mockResolvedValue({ data: [{ id: "sub_other", status: "past_due", metadata: { user_id: "someone-else" } }] });

    const response = await checkout({ interval: "monthly", productId: "bank_ib_sl" });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "BILLING_CONFLICT" });
  });

  it("codes an active subscription that blocks a new purchase", async () => {
    subscriptionsList.mockResolvedValue({ data: [{ id: "sub_active", status: "active", metadata: { user_id: user.id, product_id: "bank_ib_hl" } }] });

    const response = await checkout({ interval: "monthly", productId: "bank_ib_sl" });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "BILLING_CONFLICT", error: "Existing Stripe billing state conflicts with this bank purchase" });
  });

  it("codes a checkout already being opened", async () => {
    mockAdminRpc("cus_existing", false);

    const response = await checkout({ interval: "monthly", productId: "bank_ib_sl" });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "CHECKOUT_IN_PROGRESS" });
  });

  it("codes access that changed under the reservation", async () => {
    mockAdminRpc("cus_existing", true, undefined, false);

    const response = await checkout({ interval: "monthly", productId: "bank_ib_sl" });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "ACCESS_CHANGED" });
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("codes coverage the account already has", async () => {
    userFrom.mockReturnValue(entitlementQuery([activeEntitlement]));
    expect(await (await checkout({ interval: "monthly", productId: "bank_ib_sl" })).json()).toMatchObject({ code: "BANKS_ALREADY_OWNED" });

    userFrom.mockReturnValue(entitlementQuery([{ ...activeEntitlement, product_id: "lifetime_all_access" }]));
    expect(await (await checkout({ interval: "monthly", productId: "bank_ib_hl" })).json()).toMatchObject({ code: "LIFETIME_ACTIVE" });
  });

  it("codes unavailable billing and unexpected failures as 503s", async () => {
    billingEnabled = false;
    const disabled = await checkout({ interval: "monthly", productId: "bank_ib_sl" });
    expect(disabled.status).toBe(503);
    expect(await disabled.json()).toMatchObject({ code: "BILLING_UNAVAILABLE" });

    billingEnabled = true;
    subscriptionsList.mockRejectedValue(new Error("Stripe is down"));
    const failed = await checkout({ interval: "monthly", productId: "bank_ib_sl" });
    expect(failed.status).toBe(503);
    expect(await failed.json()).toEqual({ error: "Checkout is temporarily unavailable", code: "CHECKOUT_UNAVAILABLE" });
  });

  it("codes a Lifetime payment that is still being confirmed", async () => {
    sessionsList.mockImplementation(async ({ status }: { status: string }) => ({ data: status === "complete" ? [{ id: "cs_life", mode: "payment", metadata: { purchase_type: "lifetime" }, payment_intent: { status: "processing" } }] : [], has_more: false }));

    const response = await checkout({ interval: "monthly", productId: "bank_ib_sl" });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "LIFETIME_PAYMENT_PENDING" });
  });

  it("sends Stripe a cancel link that keeps the interval, product and banks", async () => {
    const response = await checkout({ interval: "annual", productId: "bundle_custom", selectedBankIds: ["igcse", "ib-sl"] });

    expect(response.status).toBe(200);
    const cancelUrl = new URL(sessionsCreate.mock.calls[0][0].cancel_url);
    expect(cancelUrl.pathname).toBe("/pricing");
    expect(Object.fromEntries(cancelUrl.searchParams)).toEqual({ interval: "annual", product: "bundle_custom", banks: "ib-sl,igcse", checkout: "cancelled" });
  });
});

// Regression (owner review of 42a22145): six-plus banks normalise to bundle_all, so reuse matched an
// open session whose cancel link restored the first selection.
describe("POST /api/billing/checkout open-session reuse keeps the picked banks", () => {
  type FakeSession = { id: string; status: string; url: string; expires_at: number; cancel_url: string; metadata: Record<string, string> };
  let open: FakeSession[];
  let created: number;
  const sixBanks = ["igcse", "igcse-additional", "ib-hl", "ib-sl", "ib-ai-hl", "ib-ai-sl"];
  const changedSix = ["igcse", "igcse-additional", "ib-hl", "ib-sl", "ib-ai-hl", "ib-chemistry-hl"];

  beforeEach(() => {
    vi.clearAllMocks();
    billingEnabled = true;
    getUser.mockResolvedValue({ data: { user } });
    userFrom.mockReturnValue(entitlementQuery());
    userRpc.mockResolvedValue({ data: [], error: null });
    mockAdminRpc("cus_existing");
    getCheckoutReferral.mockResolvedValue(null);
    subscriptionsList.mockResolvedValue({ data: [] });
    open = [];
    created = 0;
    sessionsList.mockImplementation(async ({ status }: { status: string }) => ({ data: status === "open" ? [...open] : [], has_more: false }));
    sessionsCreate.mockImplementation(async (params: { cancel_url: string; metadata: Record<string, string> }) => {
      created += 1;
      const session = { id: `cs_${created}`, status: "open", url: `https://checkout.stripe.com/c/pay/cs_${created}`, expires_at: 4_102_444_800, cancel_url: params.cancel_url, metadata: params.metadata };
      open.push(session);
      return session;
    });
    sessionsExpire.mockImplementation(async (id: string) => {
      open = open.filter((session) => session.id !== id);
      return { id, status: "expired" };
    });
  });

  const cancelBanks = () => new URL(sessionsCreate.mock.calls.at(-1)![0].cancel_url).searchParams.get("banks");

  it("replaces the open session when the six-bank selection changes", async () => {
    const first = await (await checkout({ interval: "annual", productId: "bundle_custom", selectedBankIds: sixBanks })).json();
    const second = await (await checkout({ interval: "annual", productId: "bundle_custom", selectedBankIds: changedSix })).json();

    expect(sessionsCreate).toHaveBeenCalledTimes(2);
    expect(second.url).not.toBe(first.url);
    expect(sessionsExpire).toHaveBeenCalledWith("cs_1");
    expect(cancelBanks()?.split(",")).toContain("ib-chemistry-hl");
  });

  it("does not hand a builder selection the session opened from direct All Access", async () => {
    await checkout({ interval: "annual", productId: "bundle_all" });
    await checkout({ interval: "annual", productId: "bundle_custom", selectedBankIds: sixBanks });

    expect(sessionsCreate).toHaveBeenCalledTimes(2);
    expect(cancelBanks()?.split(",").sort()).toEqual([...sixBanks].sort());
  });

  it("still resumes the same selection instead of opening another session", async () => {
    const first = await (await checkout({ interval: "annual", productId: "bundle_custom", selectedBankIds: sixBanks })).json();
    const again = await (await checkout({ interval: "annual", productId: "bundle_custom", selectedBankIds: [...sixBanks].reverse() })).json();

    expect(again.url).toBe(first.url);
    expect(sessionsCreate).toHaveBeenCalledTimes(1);
    expect(sessionsExpire).not.toHaveBeenCalled();
  });
});

