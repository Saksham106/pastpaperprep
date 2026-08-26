import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const getUser = vi.fn();
const userFrom = vi.fn();
const customersSearch = vi.fn();
const customersCreate = vi.fn();
const sessionsCreate = vi.fn();
let billingEnabled = true;

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser }, from: userFrom })),
}));
vi.mock("@/lib/stripe", () => ({
  createStripeClient: vi.fn(() => ({
    customers: { create: customersCreate, search: customersSearch },
    checkout: { sessions: { create: sessionsCreate } },
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
      siteUrl: "https://pastpaperprep.com",
    }),
  };
});

import { POST } from "@/app/api/billing/checkout/route";

describe("POST /api/billing/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    billingEnabled = true;
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

  it("creates checkout using the mapped authenticated customer", async () => {
    const user = { id: "150a3d0e-4c34-45cc-9748-68252f0fb8f1", email: "student@example.com" };
    getUser.mockResolvedValue({ data: { user } });
    customersSearch.mockResolvedValue({ data: [{ id: "cus_existing", metadata: { user_id: user.id } }] });
    sessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/session" });

    const response = await POST(new Request("https://pastpaperprep.com/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "annual" }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ url: "https://checkout.stripe.com/session" });
    expect(userFrom).not.toHaveBeenCalled();
    expect(customersSearch).toHaveBeenCalledWith({
      query: `metadata['user_id']:'${user.id}'`,
      limit: 1,
    });
    expect(sessionsCreate).toHaveBeenCalledWith(expect.objectContaining({
      customer: "cus_existing",
      mode: "subscription",
      line_items: [{ price: "price_annual", quantity: 1 }],
      client_reference_id: user.id,
      allow_promotion_codes: true,
      subscription_data: { metadata: { user_id: user.id, product_id: "bundle_all" } },
    }));
  });

  it("creates an unmapped Stripe customer with a stable idempotency key", async () => {
    const user = { id: "150a3d0e-4c34-45cc-9748-68252f0fb8f1", email: "student@example.com" };
    getUser.mockResolvedValue({ data: { user } });
    customersSearch.mockResolvedValue({ data: [] });
    customersCreate.mockResolvedValue({ id: "cus_created" });
    sessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/session" });

    const response = await POST(new Request("https://pastpaperprep.com/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ interval: "monthly" }),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(200);
    expect(userFrom).not.toHaveBeenCalled();
    expect(customersCreate).toHaveBeenCalledWith({
      email: user.email,
      metadata: { user_id: user.id },
    }, { idempotencyKey: `pastpaperprep-customer-${user.id}` });
    expect(sessionsCreate).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_created" }));
  });
});
