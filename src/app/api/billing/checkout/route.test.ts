import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getUser = vi.fn();
const userFrom = vi.fn();
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
    if (functionName === "reserve_billing_checkout") return { data: reservationGranted, error: null };
    if (functionName === "confirm_billing_checkout") return { data: confirmationGranted, error: null };
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
  createClient: vi.fn(async () => ({ auth: { getUser }, from: userFrom })),
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

describe("POST /api/billing/checkout", () => {
  afterEach(() => vi.unstubAllEnvs());

  beforeEach(() => {
    vi.clearAllMocks();
    billingEnabled = true;
    userFrom.mockReturnValue(entitlementQuery());
    mockAdminRpc();
    sessionsList.mockResolvedValue({ data: [] });
    sessionsExpire.mockResolvedValue({ status: "expired" });
    subscriptionsList.mockResolvedValue({ data: [] });
  });

  it("rejects unauthenticated requests", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const response = await POST(new Request("https://pastpaperprep.com/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "monthly" }),
    }));

    expect(response.status).toBe(401);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("rejects direct checkout calls while billing is disabled", async () => {
    billingEnabled = false;
    getUser.mockResolvedValue({ data: { user: { id: "150a3d0e-4c34-45cc-9748-68252f0fb8f1", email: "student@example.com" } } });

    const response = await POST(new Request("https://pastpaperprep.com/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "monthly" }),
    }));

    expect(response.status).toBe(503);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("rejects JSON null and unknown plan values", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "150a3d0e-4c34-45cc-9748-68252f0fb8f1", email: "student@example.com" } } });

    const nullResponse = await POST(new Request("https://pastpaperprep.com/api/billing/checkout", { method: "POST", body: "null" }));
    const unknownResponse = await POST(new Request("https://pastpaperprep.com/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "price_attacker" }),
    }));

    expect(nullResponse.status).toBe(400);
    expect(unknownResponse.status).toBe(400);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("refuses to create a second subscription for an account with current access", async () => {
    const user = { id: "150a3d0e-4c34-45cc-9748-68252f0fb8f1", email: "student@example.com" };
    getUser.mockResolvedValue({ data: { user } });
    userFrom.mockReturnValue(entitlementQuery([{
      product_id: "bank_ib_sl",
      status: "active",
      starts_at: "2026-01-01T00:00:00.000Z",
      expires_at: "2099-01-01T00:00:00.000Z",
    }]));

    const response = await POST(new Request("https://pastpaperprep.com/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "annual", productId: "bundle_all" }),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "Existing access must be managed from your account" });
    expect(customersSearch).not.toHaveBeenCalled();
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("creates checkout using the mapped authenticated customer", async () => {
    const user = { id: "150a3d0e-4c34-45cc-9748-68252f0fb8f1", email: "student@example.com" };
    getUser.mockResolvedValue({ data: { user } });
    mockAdminRpc("cus_existing");
    sessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/session" });

    const response = await POST(new Request("https://pastpaperprep.com/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "annual", productId: "bundle_ib_aa" }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ url: "https://checkout.stripe.com/session" });
    expect(userFrom).toHaveBeenCalledWith("entitlements");
    expect(adminRpc).toHaveBeenCalledWith("get_stripe_customer_id", { p_user_id: user.id });
    expect(customersSearch).not.toHaveBeenCalled();
    const reservationCall = adminRpc.mock.calls.find(([functionName]) => functionName === "reserve_billing_checkout");
    const intentId = reservationCall?.[1]?.p_intent_id;
    expect(intentId).toMatch(/^[0-9a-f-]{36}$/);
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_existing",
        mode: "subscription",
        line_items: [{ price: "price_pair_annual", quantity: 1 }],
        client_reference_id: user.id,
        allow_promotion_codes: true,
        subscription_data: { metadata: { user_id: user.id, product_id: "bundle_ib_aa" } },
      }),
      { idempotencyKey: `pastpaperprep-checkout-${intentId}`, timeout: 30_000 },
    );
    expect(adminRpc).toHaveBeenCalledWith("confirm_billing_checkout", {
      p_user_id: user.id,
      p_intent_id: intentId,
    });
    expect(adminRpc).toHaveBeenCalledWith("release_billing_checkout", {
      p_user_id: user.id,
      p_intent_id: intentId,
    });
  });

  it("rejects a one-bank Build Your Plan checkout before any billing side effect", async () => {
    const user = { id: "150a3d0e-4c34-45cc-9748-68252f0fb8f1", email: "student@example.com" };
    getUser.mockResolvedValue({ data: { user } });

    const response = await POST(new Request("https://pastpaperprep.com/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "annual", productId: "bundle_custom", selectedBankIds: ["igcse"] }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Select at least two banks" });
    expect(userFrom).not.toHaveBeenCalled();
    expect(adminRpc).not.toHaveBeenCalled();
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("creates a custom annual bundle with exact selected-bank metadata and graduated quantity", async () => {
    const user = { id: "150a3d0e-4c34-45cc-9748-68252f0fb8f1", email: "student@example.com" };
    getUser.mockResolvedValue({ data: { user } });
    mockAdminRpc("cus_existing");
    sessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/session" });

    const response = await POST(new Request("https://pastpaperprep.com/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "annual", productId: "bundle_custom", selectedBankIds: ["ib-sl", "igcse"] }),
    }));

    expect(response.status).toBe(200);
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: "price_custom_annual", quantity: 2 }],
        subscription_data: { metadata: {
          user_id: user.id,
          product_id: "bundle_custom",
          selected_bank_ids: JSON.stringify(["ib-sl", "igcse"]),
          billing_interval: "annual",
          price_id: "price_custom_annual",
        } },
        metadata: expect.objectContaining({
          user_id: user.id,
          product_id: "bundle_custom",
          selected_bank_ids: JSON.stringify(["ib-sl", "igcse"]),
          billing_interval: "annual",
          price_id: "price_custom_annual",
        }),
        integration_identifier: expect.stringMatching(/^pastpaperprep-custom-bundle-[A-Za-z]{8}$/),
      }),
      expect.any(Object),
    );
  });

  it("creates an enabled Economics custom bundle through the existing custom price", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION", "true");
    vi.stubEnv("PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED", "true");
    const user = { id: "150a3d0e-4c34-45cc-9748-68252f0fb8f1", email: "student@example.com" };
    getUser.mockResolvedValue({ data: { user } });
    mockAdminRpc("cus_existing");
    sessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/session" });

    const response = await POST(new Request("https://pastpaperprep.com/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "monthly", productId: "bundle_custom", selectedBankIds: ["ib-economics-hl", "ib-hl"] }),
    }));

    expect(response.status).toBe(200);
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: "price_custom_monthly", quantity: 2 }],
        metadata: expect.objectContaining({
          product_id: "bundle_custom",
          selected_bank_ids: JSON.stringify(["ib-economics-hl", "ib-hl"]),
        }),
      }),
      expect.any(Object),
    );
  });

  it("rejects Economics custom checkout while either release gate is off", async () => {
    vi.stubEnv("PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION", "true");
    vi.stubEnv("PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED", "false");
    const user = { id: "150a3d0e-4c34-45cc-9748-68252f0fb8f1", email: "student@example.com" };
    getUser.mockResolvedValue({ data: { user } });

    const response = await POST(new Request("https://pastpaperprep.com/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "monthly", productId: "bundle_custom", selectedBankIds: ["ib-economics-hl"] }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Bank is not available for checkout" });
    expect(sessionsCreate).not.toHaveBeenCalled();
    expect(adminRpc).not.toHaveBeenCalled();
  });

  it("preserves existing Economics custom access when the release gate is later paused", async () => {
    vi.stubEnv("PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION", "false");
    vi.stubEnv("PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED", "false");
    const user = { id: "150a3d0e-4c34-45cc-9748-68252f0fb8f1", email: "student@example.com" };
    getUser.mockResolvedValue({ data: { user } });
    userFrom.mockReturnValue(entitlementQuery([{
      product_id: "bundle_custom",
      selected_bank_ids: ["ib-economics-hl"],
      status: "active",
      starts_at: "2026-01-01T00:00:00.000Z",
      expires_at: null,
    }]));

    const response = await POST(new Request("https://pastpaperprep.com/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "monthly", productId: "bundle_all" }),
    }));

    expect(response.status).toBe(409);
    expect(sessionsCreate).not.toHaveBeenCalled();
    expect(adminRpc).not.toHaveBeenCalled();
  });

  it("rejects direct Economics products even when the release gates are on", async () => {
    vi.stubEnv("PASTPAPERPREP_ENABLE_IB_ECONOMICS_PRODUCTION", "true");
    vi.stubEnv("PASTPAPERPREP_IB_ECONOMICS_ASSETS_VERIFIED", "true");
    const user = { id: "150a3d0e-4c34-45cc-9748-68252f0fb8f1", email: "student@example.com" };
    getUser.mockResolvedValue({ data: { user } });

    const response = await POST(new Request("https://pastpaperprep.com/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "monthly", productId: "bank_ib_economics_hl" }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Unknown billing product" });
    expect(sessionsCreate).not.toHaveBeenCalled();
    expect(adminRpc).not.toHaveBeenCalled();
  });

  it("rejects duplicate custom bank selections before Stripe", async () => {
    const user = { id: "150a3d0e-4c34-45cc-9748-68252f0fb8f1", email: "student@example.com" };
    getUser.mockResolvedValue({ data: { user } });

    const response = await POST(new Request("https://pastpaperprep.com/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "monthly", productId: "bundle_custom", selectedBankIds: ["igcse", "igcse"] }),
    }));

    expect(response.status).toBe(400);
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("promotes six selected canonical banks to all access", async () => {
    const user = { id: "150a3d0e-4c34-45cc-9748-68252f0fb8f1", email: "student@example.com" };
    getUser.mockResolvedValue({ data: { user } });
    mockAdminRpc("cus_existing");
    sessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/session" });

    const response = await POST(new Request("https://pastpaperprep.com/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "monthly", productId: "bundle_custom", selectedBankIds: ["igcse", "igcse-additional", "ib-hl", "ib-sl", "ib-ai-hl", "ib-ai-sl"] }),
    }));

    expect(response.status).toBe(200);
    expect(sessionsCreate).toHaveBeenCalledWith(expect.objectContaining({
      line_items: [{ price: "price_all_monthly", quantity: 1 }],
      metadata: expect.objectContaining({ product_id: "bundle_all" }),
    }), expect.any(Object));
  });

  it("returns a created Checkout Session even when reservation cleanup fails", async () => {
    const user = { id: "150a3d0e-4c34-45cc-9748-68252f0fb8f1", email: "student@example.com" };
    getUser.mockResolvedValue({ data: { user } });
    mockAdminRpc("cus_existing");
    adminRpc.mockImplementation(async (functionName: string, args?: Record<string, unknown>) => {
      if (functionName === "reserve_billing_checkout") return { data: true, error: null };
      if (functionName === "confirm_billing_checkout") return { data: true, error: null };
      if (functionName === "release_billing_checkout") return { data: null, error: new Error("cleanup unavailable") };
      if (functionName === "get_stripe_customer_id") return { data: "cus_existing", error: null };
      if (functionName === "claim_stripe_customer") return { data: args?.p_customer_id, error: null };
      return { data: null, error: new Error("Unexpected billing RPC") };
    });
    sessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/session" });

    const response = await POST(new Request("https://pastpaperprep.com/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "monthly", productId: "bank_ib_sl" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ url: "https://checkout.stripe.com/session" });
  });

  it("creates an unmapped Stripe customer with a stable idempotency key", async () => {
    const user = { id: "150a3d0e-4c34-45cc-9748-68252f0fb8f1", email: "student@example.com" };
    getUser.mockResolvedValue({ data: { user } });
    customersSearch.mockResolvedValue({ data: [] });
    customersCreate.mockResolvedValue({ id: "cus_created" });
    sessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/session" });

    const response = await POST(new Request("https://pastpaperprep.com/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "monthly", productId: "bank_ib_sl" }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(200);
    expect(userFrom).toHaveBeenCalledWith("entitlements");
    expect(customersCreate).toHaveBeenCalledWith({
      email: user.email,
      metadata: { user_id: user.id },
    }, { idempotencyKey: `pastpaperprep-customer-${user.id}` });
    expect(adminRpc).toHaveBeenCalledWith("claim_stripe_customer", {
      p_user_id: user.id,
      p_customer_id: "cus_created",
    });
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_created" }),
      { idempotencyKey: expect.stringMatching(/^pastpaperprep-checkout-[0-9a-f-]{36}$/), timeout: 30_000 },
    );
  });

  it("uses the canonical customer when a webhook wins the customer claim race", async () => {
    const user = { id: "150a3d0e-4c34-45cc-9748-68252f0fb8f1", email: "student@example.com" };
    getUser.mockResolvedValue({ data: { user } });
    mockAdminRpc(null, true, "cus_webhook");
    customersSearch.mockResolvedValue({ data: [] });
    customersCreate.mockResolvedValue({ id: "cus_raced" });
    sessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/session" });

    const response = await POST(new Request("https://pastpaperprep.com/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "monthly", productId: "bank_ib_sl" }),
    }));

    expect(response.status).toBe(200);
    expect(adminRpc).toHaveBeenCalledWith("claim_stripe_customer", {
      p_user_id: user.id,
      p_customer_id: "cus_raced",
    });
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_webhook" }),
      expect.any(Object),
    );
  });

  it("claims a Stripe-search customer before creating its session", async () => {
    const user = { id: "150a3d0e-4c34-45cc-9748-68252f0fb8f1", email: "student@example.com" };
    getUser.mockResolvedValue({ data: { user } });
    mockAdminRpc(null, true, "cus_searched");
    customersSearch.mockResolvedValue({ data: [{ id: "cus_searched" }] });
    sessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/session" });

    const response = await POST(new Request("https://pastpaperprep.com/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "monthly", productId: "bank_ib_sl" }),
    }));

    expect(response.status).toBe(200);
    expect(adminRpc).toHaveBeenCalledWith("claim_stripe_customer", {
      p_user_id: user.id,
      p_customer_id: "cus_searched",
    });
    expect(customersCreate).not.toHaveBeenCalled();
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_searched" }),
      expect.any(Object),
    );
  });

  it("fails closed when an unmapped user has multiple Stripe customers", async () => {
    const user = { id: "150a3d0e-4c34-45cc-9748-68252f0fb8f1", email: "student@example.com" };
    getUser.mockResolvedValue({ data: { user } });
    customersSearch.mockResolvedValue({ data: [{ id: "cus_one" }, { id: "cus_two" }] });

    const response = await POST(new Request("https://pastpaperprep.com/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "monthly", productId: "bank_ib_sl" }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(503);
    expect(customersSearch).toHaveBeenCalledWith({
      query: `metadata['user_id']:'${user.id}'`,
      limit: 2,
    });
    expect(customersCreate).not.toHaveBeenCalled();
    expect(sessionsCreate).not.toHaveBeenCalled();
    expect(adminRpc).toHaveBeenCalledWith("release_billing_checkout", {
      p_user_id: user.id,
      p_intent_id: expect.any(String),
    });
  });

  it("rejects checkout when Stripe already has a non-terminal subscription", async () => {
    const user = { id: "150a3d0e-4c34-45cc-9748-68252f0fb8f1", email: "student@example.com" };
    getUser.mockResolvedValue({ data: { user } });
    mockAdminRpc("cus_existing");
    subscriptionsList.mockResolvedValue({ data: [{ id: "sub_existing", status: "past_due" }] });

    const response = await POST(new Request("https://pastpaperprep.com/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "monthly", productId: "bank_ib_sl" }),
    }));

    expect(response.status).toBe(409);
    expect(subscriptionsList).toHaveBeenCalledWith({ customer: "cus_existing", status: "all", limit: 100 });
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("paginates Stripe subscriptions until it finds a non-terminal record", async () => {
    const user = { id: "150a3d0e-4c34-45cc-9748-68252f0fb8f1", email: "student@example.com" };
    getUser.mockResolvedValue({ data: { user } });
    mockAdminRpc("cus_existing");
    subscriptionsList
      .mockResolvedValueOnce({
        data: [
          { id: "sub_canceled_1", status: "canceled" },
          { id: "sub_canceled_2", status: "incomplete_expired" },
        ],
        has_more: true,
      })
      .mockResolvedValueOnce({
        data: [{ id: "sub_older_active", status: "active" }],
        has_more: false,
      });

    const response = await POST(new Request("https://pastpaperprep.com/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "monthly", productId: "bank_ib_sl" }),
    }));

    expect(response.status).toBe(409);
    expect(subscriptionsList).toHaveBeenNthCalledWith(1, {
      customer: "cus_existing",
      status: "all",
      limit: 100,
    });
    expect(subscriptionsList).toHaveBeenNthCalledWith(2, {
      customer: "cus_existing",
      status: "all",
      limit: 100,
      starting_after: "sub_canceled_2",
    });
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("resumes an open Checkout Session instead of trapping the user", async () => {
    const user = { id: "150a3d0e-4c34-45cc-9748-68252f0fb8f1", email: "student@example.com" };
    getUser.mockResolvedValue({ data: { user } });
    mockAdminRpc("cus_existing");
    sessionsList.mockResolvedValue({ data: [{
      id: "cs_open",
      status: "open",
      expires_at: 4_102_444_800,
      url: "https://checkout.stripe.com/c/pay/cs_open",
      metadata: {
        user_id: user.id,
        product_id: "bundle_all",
        billing_interval: "annual",
        price_id: "price_all_annual",
      },
    }] });

    const response = await POST(new Request("https://pastpaperprep.com/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "annual", productId: "bundle_all" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ url: "https://checkout.stripe.com/c/pay/cs_open" });
    expect(sessionsList).toHaveBeenCalledWith({ customer: "cus_existing", status: "open", limit: 100 });
    expect(sessionsExpire).not.toHaveBeenCalled();
    expect(sessionsCreate).not.toHaveBeenCalled();
    expect(adminRpc).toHaveBeenCalledWith("release_billing_checkout", expect.any(Object));
  });

  it("paginates open Checkout Sessions before deciding whether to resume", async () => {
    const user = { id: "150a3d0e-4c34-45cc-9748-68252f0fb8f1", email: "student@example.com" };
    getUser.mockResolvedValue({ data: { user } });
    mockAdminRpc("cus_existing");
    sessionsList
      .mockResolvedValueOnce({
        data: [{
          id: "cs_stale",
          status: "open",
          url: "https://checkout.stripe.com/c/pay/cs_stale",
          metadata: { user_id: user.id, product_id: "bank_ib_sl", billing_interval: "monthly", price_id: "price_single_monthly" },
        }],
        has_more: true,
      })
      .mockResolvedValueOnce({
        data: [{
          id: "cs_matching",
          status: "open",
          expires_at: 4_102_444_800,
          url: "https://checkout.stripe.com/c/pay/cs_matching",
          metadata: { user_id: user.id, product_id: "bundle_all", billing_interval: "annual", price_id: "price_all_annual" },
        }],
        has_more: false,
      });

    const response = await POST(new Request("https://pastpaperprep.com/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "annual", productId: "bundle_all" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ url: "https://checkout.stripe.com/c/pay/cs_matching" });
    expect(sessionsList).toHaveBeenNthCalledWith(1, { customer: "cus_existing", status: "open", limit: 100 });
    expect(sessionsList).toHaveBeenNthCalledWith(2, {
      customer: "cus_existing",
      status: "open",
      limit: 100,
      starting_after: "cs_stale",
    });
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("never returns a matching Checkout Session whose Stripe expiry is already past", async () => {
    const user = { id: "150a3d0e-4c34-45cc-9748-68252f0fb8f1", email: "student@example.com" };
    getUser.mockResolvedValue({ data: { user } });
    mockAdminRpc("cus_existing");
    sessionsList.mockResolvedValue({ data: [{
      id: "cs_expired_but_open",
      status: "open",
      expires_at: 1,
      url: "https://checkout.stripe.com/c/pay/cs_expired_but_open",
      metadata: {
        user_id: user.id,
        product_id: "bundle_all",
        billing_interval: "annual",
        price_id: "price_all_annual",
      },
    }] });
    sessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/cs_fresh" });

    const response = await POST(new Request("https://pastpaperprep.com/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "annual", productId: "bundle_all" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ url: "https://checkout.stripe.com/c/pay/cs_fresh" });
    expect(sessionsExpire).toHaveBeenCalledWith("cs_expired_but_open");
    expect(sessionsCreate).toHaveBeenCalled();
  });

  it("expires a stale open Checkout Session with the wrong price before creating the selected plan", async () => {
    const user = { id: "150a3d0e-4c34-45cc-9748-68252f0fb8f1", email: "student@example.com" };
    getUser.mockResolvedValue({ data: { user } });
    mockAdminRpc("cus_existing");
    sessionsList.mockResolvedValue({ data: [{
      id: "cs_old",
      status: "open",
      url: "https://checkout.stripe.com/c/pay/cs_old",
      metadata: {
        user_id: user.id,
        product_id: "bundle_all",
        billing_interval: "annual",
        price_id: "price_retired_all_annual",
      },
    }] });
    sessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/cs_new" });

    const response = await POST(new Request("https://pastpaperprep.com/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "annual", productId: "bundle_all" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ url: "https://checkout.stripe.com/c/pay/cs_new" });
    expect(sessionsExpire).toHaveBeenCalledWith("cs_old");
    expect(sessionsExpire.mock.invocationCallOrder[0]).toBeLessThan(sessionsCreate.mock.invocationCallOrder[0]);
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: "price_all_annual", quantity: 1 }],
        metadata: expect.objectContaining({
          user_id: user.id,
          product_id: "bundle_all",
          billing_interval: "annual",
          price_id: "price_all_annual",
        }),
      }),
      expect.any(Object),
    );
  });

  it("rejects concurrent checkout intents when the durable reservation is held", async () => {
    const user = { id: "150a3d0e-4c34-45cc-9748-68252f0fb8f1", email: "student@example.com" };
    getUser.mockResolvedValue({ data: { user } });
    mockAdminRpc(null, false);

    const response = await POST(new Request("https://pastpaperprep.com/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "monthly", productId: "bank_ib_sl" }),
    }));

    expect(response.status).toBe(409);
    expect(adminRpc).toHaveBeenCalledWith("reserve_billing_checkout", {
      p_user_id: user.id,
      p_intent_id: expect.any(String),
    });
    expect(customersSearch).not.toHaveBeenCalled();
    expect(sessionsCreate).not.toHaveBeenCalled();
  });

  it("stops before Stripe session creation when a manual grant wins the final eligibility race", async () => {
    const user = { id: "150a3d0e-4c34-45cc-9748-68252f0fb8f1", email: "student@example.com" };
    getUser.mockResolvedValue({ data: { user } });
    mockAdminRpc("cus_existing", true, undefined, false);

    const response = await POST(new Request("https://pastpaperprep.com/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "monthly", productId: "bank_ib_sl" }),
    }));

    expect(response.status).toBe(409);
    expect(sessionsCreate).not.toHaveBeenCalled();
    expect(adminRpc).toHaveBeenCalledWith("confirm_billing_checkout", {
      p_user_id: user.id,
      p_intent_id: expect.any(String),
    });
    expect(adminRpc).toHaveBeenCalledWith("release_billing_checkout", expect.any(Object));
  });

  it("retains the lease when Stripe session creation has an ambiguous failure", async () => {
    const user = { id: "150a3d0e-4c34-45cc-9748-68252f0fb8f1", email: "student@example.com" };
    getUser.mockResolvedValue({ data: { user } });
    mockAdminRpc("cus_existing");
    sessionsCreate.mockRejectedValue(new Error("network timeout"));

    const response = await POST(new Request("https://pastpaperprep.com/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "monthly", productId: "bank_ib_sl" }),
    }));

    expect(response.status).toBe(503);
    expect(sessionsCreate).toHaveBeenCalledOnce();
    expect(adminRpc.mock.calls.some(([functionName]) => functionName === "release_billing_checkout")).toBe(false);
  });
});
