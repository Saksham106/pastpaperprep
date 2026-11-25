import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  adminRpc: vi.fn(),
  create: vi.fn(),
  search: vi.fn(),
  createCustomer: vi.fn(),
  billing: vi.fn(() => true),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.adminRpc }) }));
vi.mock("@/lib/stripe-config", () => ({ isStripeBillingEnabled: mocks.billing, getStripeConfig: () => ({ secretKey: "sk_test_fixture", siteUrl: "https://pastpaperprep.com" }) }));
vi.mock("@/lib/stripe", () => ({ createStripeClient: () => ({
  checkout: { sessions: { create: mocks.create } },
  customers: { search: mocks.search, create: mocks.createCustomer },
}) }));

import { POST } from "@/app/api/helper/credits/checkout/route";

const USER = "11111111-1111-4111-8111-111111111111";
const post = (body: unknown) => POST(new Request("https://pastpaperprep.com/api/helper/credits/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));

describe("POST /api/helper/credits/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.billing.mockReturnValue(true);
    mocks.getUser.mockResolvedValue({ data: { user: { id: USER, email: "student@example.com" } } });
    mocks.adminRpc.mockResolvedValue({ data: "cus_1", error: null });
    mocks.create.mockResolvedValue({ url: "https://checkout.stripe.com/c/pay/cs_test_1" });
  });

  it("rejects anything but a known pack before reading the account or calling Stripe", async () => {
    for (const body of [null, [], "credits_1000", { pack: "credits_9000" }, { pack: { id: "credits_1000" } }, {}]) {
      expect((await post(body)).status).toBe(400);
    }
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("needs a sign-in and live billing", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null } });
    expect((await post({ pack: "credits_1000" })).status).toBe(401);
    mocks.billing.mockReturnValueOnce(false);
    expect((await post({ pack: "credits_1000" })).status).toBe(503);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("opens a one-time Checkout priced from the server's pack list", async () => {
    const response = await post({ pack: "credits_3000", amount: 1, credits: 999999 });
    expect(await response.json()).toEqual({ url: "https://checkout.stripe.com/c/pay/cs_test_1" });
    const [params, options] = mocks.create.mock.calls[0];
    expect(params).toMatchObject({
      mode: "payment", customer: "cus_1", client_reference_id: USER,
      line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: 1299, product_data: { metadata: { purchase_type: "helper_credits", pack_id: "credits_3000" } } } }],
      metadata: { user_id: USER, purchase_type: "helper_credits", pack_id: "credits_3000", credits: "3000" },
      success_url: "https://pastpaperprep.com/account?credits=success#pepper-credits",
    });
    expect(params.payment_intent_data.metadata).toEqual(params.metadata);
    expect(options.idempotencyKey).toBe(`pastpaperprep-helper-credits-${params.metadata.billing_intent_id}`);
  });

  it("maps a new buyer to one Stripe customer before Checkout", async () => {
    mocks.adminRpc.mockImplementation(async (name: string) => name === "get_stripe_customer_id" ? { data: null, error: null } : { data: "cus_new", error: null });
    mocks.search.mockResolvedValue({ data: [] });
    mocks.createCustomer.mockResolvedValue({ id: "cus_new" });
    expect((await post({ pack: "credits_1000" })).status).toBe(200);
    expect(mocks.adminRpc).toHaveBeenCalledWith("claim_stripe_customer", { p_user_id: USER, p_customer_id: "cus_new" });
    expect(mocks.create.mock.calls[0][0].customer).toBe("cus_new");
  });

  it("fails closed when Stripe or the customer mapping errors", async () => {
    mocks.adminRpc.mockResolvedValueOnce({ data: null, error: { message: "db" } });
    expect((await post({ pack: "credits_1000" })).status).toBe(503);
    mocks.create.mockRejectedValueOnce(new Error("stripe down"));
    expect((await post({ pack: "credits_1000" })).status).toBe(503);
  });
});
