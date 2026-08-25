import { describe, expect, it } from "vitest";
import { buildSubscriptionSync } from "@/lib/stripe-subscriptions";

const userId = "150a3d0e-4c34-45cc-9748-68252f0fb8f1";

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt_2",
    created: 1_800_000_000,
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_1",
        customer: "cus_1",
        status: "active",
        metadata: { user_id: userId, product_id: "bundle_all" },
        items: {
          data: [{
            price: { id: "price_monthly" },
            current_period_start: 1_799_000_000,
            current_period_end: 1_801_000_000,
          }],
        },
      },
    },
    ...overrides,
  };
}

const knownPrices = new Set(["price_monthly", "price_annual"]);

describe("Stripe subscription event normalization", () => {
  it("maps a known active subscription to the all-access entitlement", () => {
    expect(buildSubscriptionSync(event(), knownPrices)).toEqual({
      eventId: "evt_2",
      eventCreated: 1_800_000_000,
      subscriptionId: "sub_1",
      customerId: "cus_1",
      userId,
      productId: "bundle_all",
      status: "active",
      startsAt: new Date(1_799_000_000 * 1000).toISOString(),
      expiresAt: new Date(1_801_000_000 * 1000).toISOString(),
    });
  });

  it("fails closed for unknown prices, malformed users, and unrelated events", () => {
    const unknownPrice = event();
    (unknownPrice.data.object.items.data[0].price as { id: string }).id = "price_attacker";
    expect(() => buildSubscriptionSync(unknownPrice, knownPrices)).toThrow("Unknown Stripe price");

    const malformedUser = event();
    malformedUser.data.object.metadata.user_id = "not-a-user";
    expect(() => buildSubscriptionSync(malformedUser, knownPrices)).toThrow("Invalid subscription metadata");

    expect(buildSubscriptionSync(event({ type: "checkout.session.completed" }), knownPrices)).toBeNull();
  });

  it("revokes access for deleted or non-entitled subscription states", () => {
    const deleted = event({ type: "customer.subscription.deleted" });
    expect(buildSubscriptionSync(deleted, knownPrices)).toEqual(expect.objectContaining({ status: "revoked", expiresAt: null }));

    const unpaid = event();
    unpaid.data.object.status = "unpaid";
    expect(buildSubscriptionSync(unpaid, knownPrices)).toEqual(expect.objectContaining({ status: "revoked", expiresAt: null }));
  });
});
