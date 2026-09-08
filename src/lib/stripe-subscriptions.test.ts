import { describe, expect, it } from "vitest";
import { buildSubscriptionSync, getSubscriptionEventReference } from "@/lib/stripe-subscriptions";

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

const allowedPrice = (productId: string, priceId: string) =>
  productId === "bundle_all" && (priceId === "price_monthly" || priceId === "price_annual");

describe("Stripe subscription event normalization", () => {
  it("extracts subscription references only from supported lifecycle events", () => {
    expect(getSubscriptionEventReference(event())).toEqual({ subscriptionId: "sub_1" });
    expect(getSubscriptionEventReference(event({ type: "checkout.session.completed" }))).toBeNull();
  });

  it("maps a known active subscription to the all-access entitlement", () => {
    expect(buildSubscriptionSync(event(), allowedPrice)).toEqual({
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

  it("maps a subject-pair subscription to its exact entitlement", () => {
    const pair = event();
    pair.data.object.metadata.product_id = "bundle_ib_aa";
    expect(buildSubscriptionSync(pair, (productId, priceId) => productId === "bundle_ib_aa" && priceId === "price_monthly"))
      .toEqual(expect.objectContaining({ productId: "bundle_ib_aa" }));
  });

  it("validates custom-bundle metadata, quantity, and selected canonical banks", () => {
    const custom = event() as unknown as {
      data: { object: { metadata: Record<string, string>; items: { data: Array<{ price: { id: string }; quantity?: number }> } } };
    };
    custom.data.object.metadata = {
      user_id: userId,
      product_id: "bundle_custom",
      selected_bank_ids: JSON.stringify(["ib-hl", "ib-sl"]),
      billing_interval: "annual",
      price_id: "price_custom_annual",
    };
    custom.data.object.items.data[0].price.id = "price_custom_annual";
    custom.data.object.items.data[0].quantity = 2;

    expect(buildSubscriptionSync(custom, (productId, priceId) => productId === "bundle_custom" && priceId === "price_custom_annual"))
      .toEqual(expect.objectContaining({
        productId: "bundle_custom",
        selectedBankIds: ["ib-hl", "ib-sl"],
      }));

    custom.data.object.items.data[0].quantity = 1;
    expect(() => buildSubscriptionSync(custom, () => true)).toThrow("Custom bundle quantity does not match selection");
  });

  it("rejects custom bundles with malformed or tampered selected-bank metadata", () => {
    const custom = event() as unknown as {
      data: { object: { metadata: Record<string, string>; items: { data: Array<{ price: { id: string }; quantity?: number }> } } };
    };
    custom.data.object.metadata = {
      user_id: userId,
      product_id: "bundle_custom",
      selected_bank_ids: JSON.stringify(["ib-hl", "unknown"]),
      billing_interval: "monthly",
      price_id: "price_custom_monthly",
    };
    custom.data.object.items.data[0].price.id = "price_custom_monthly";
    custom.data.object.items.data[0].quantity = 2;
    expect(() => buildSubscriptionSync(custom, () => true)).toThrow("Invalid custom bundle metadata");
  });

  it("fails closed for unknown prices, malformed users, and unrelated events", () => {
    const unknownPrice = event();
    (unknownPrice.data.object.items.data[0].price as { id: string }).id = "price_attacker";
    expect(() => buildSubscriptionSync(unknownPrice, allowedPrice)).toThrow("Stripe price does not match product");

    const malformedUser = event();
    malformedUser.data.object.metadata.user_id = "not-a-user";
    expect(() => buildSubscriptionSync(malformedUser, allowedPrice)).toThrow("Invalid subscription metadata");

    expect(buildSubscriptionSync(event({ type: "checkout.session.completed" }), allowedPrice)).toBeNull();
  });

  it("rejects a known price when it belongs to a different product breadth", () => {
    const mismatched = event();
    (mismatched.data.object.items.data[0].price as { id: string }).id = "price_single_monthly";
    expect(() => buildSubscriptionSync(mismatched, allowedPrice)).toThrow("Stripe price does not match product");
  });

  it("revokes access for deleted or non-entitled subscription states", () => {
    const deleted = event({ type: "customer.subscription.deleted" });
    expect(buildSubscriptionSync(deleted, allowedPrice)).toEqual(expect.objectContaining({ status: "revoked", expiresAt: null }));

    const unpaid = event();
    unpaid.data.object.status = "unpaid";
    expect(buildSubscriptionSync(unpaid, allowedPrice)).toEqual(expect.objectContaining({ status: "revoked", expiresAt: null }));
  });
});
