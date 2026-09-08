import type { ProductId } from "@/lib/access";
import { validateCustomBankIds } from "@/lib/custom-bundles";
import type { BillingInterval } from "@/lib/stripe-config";

const SUBSCRIPTION_EVENT_TYPES = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ObjectRecord = Record<string, unknown>;

export type SubscriptionEventReference = {
  subscriptionId: string;
};

const STRIPE_PRODUCT_IDS = new Set<ProductId>([
  "bank_igcse", "bank_igcse_additional", "bank_ib_hl", "bank_ib_sl", "bank_ib_ai_hl", "bank_ib_ai_sl",
  "bank_ib_chemistry_hl", "bank_ib_chemistry_sl", "bank_ib_physics_hl", "bank_ib_physics_sl", "bank_ib_biology_hl", "bank_ib_biology_sl",
  "bundle_igcse", "bundle_ib_aa", "bundle_ib_ai", "bundle_ib_chemistry", "bundle_ib_physics", "bundle_ib_biology", "bundle_all", "bundle_custom",
]);

export type SubscriptionSync = {
  eventId: string;
  eventCreated: number;
  subscriptionId: string;
  customerId: string;
  userId: string;
  productId: ProductId;
  selectedBankIds?: ReturnType<typeof validateCustomBankIds>;
  quantity?: number;
  priceId?: string;
  status: "active" | "trialing" | "revoked";
  startsAt: string;
  expiresAt: string | null;
};

function record(value: unknown, message: string): ObjectRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as ObjectRecord;
}

function unixDate(value: unknown): string {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error("Invalid subscription period");
  }
  return new Date(value * 1000).toISOString();
}

export function getSubscriptionEventReference(eventValue: unknown): SubscriptionEventReference | null {
  const event = record(eventValue, "Invalid Stripe event");
  if (typeof event.type !== "string" || !SUBSCRIPTION_EVENT_TYPES.has(event.type)) return null;
  const data = record(event.data, "Invalid Stripe event");
  const subscription = record(data.object, "Invalid Stripe subscription");
  if (typeof subscription.id !== "string") throw new Error("Invalid Stripe subscription");
  return { subscriptionId: subscription.id };
}

export function buildSubscriptionSync(
  eventValue: unknown,
  isPriceAllowed: (productId: ProductId, priceId: string, interval?: BillingInterval) => boolean,
): SubscriptionSync | null {
  const event = record(eventValue, "Invalid Stripe event");
  if (typeof event.type !== "string" || !SUBSCRIPTION_EVENT_TYPES.has(event.type)) return null;
  if (typeof event.id !== "string" || typeof event.created !== "number") throw new Error("Invalid Stripe event");

  const data = record(event.data, "Invalid Stripe event");
  const subscription = record(data.object, "Invalid Stripe subscription");
  const metadata = record(subscription.metadata, "Invalid subscription metadata");
  if (
    typeof subscription.id !== "string" ||
    typeof subscription.customer !== "string" ||
    typeof metadata.user_id !== "string" ||
    !UUID_PATTERN.test(metadata.user_id) ||
    typeof metadata.product_id !== "string" ||
    !STRIPE_PRODUCT_IDS.has(metadata.product_id as ProductId)
  ) {
    throw new Error("Invalid subscription metadata");
  }

  const items = record(subscription.items, "Invalid subscription items");
  if (!Array.isArray(items.data) || items.data.length !== 1) throw new Error("Invalid subscription items");
  const item = record(items.data[0], "Invalid subscription item");
  const price = record(item.price, "Invalid subscription price");
  if (typeof price.id !== "string") throw new Error("Invalid Stripe price");

  let selectedBankIds: ReturnType<typeof validateCustomBankIds> | undefined;
  let customInterval: BillingInterval | undefined;
  if (metadata.product_id === "bundle_custom") {
    if (typeof metadata.selected_bank_ids !== "string" || typeof metadata.billing_interval !== "string" || typeof metadata.price_id !== "string") {
      throw new Error("Invalid custom bundle metadata");
    }
    let parsedSelection: unknown;
    try {
      parsedSelection = JSON.parse(metadata.selected_bank_ids);
    } catch {
      throw new Error("Invalid custom bundle metadata");
    }
    try {
      selectedBankIds = validateCustomBankIds(parsedSelection);
    } catch {
      throw new Error("Invalid custom bundle metadata");
    }
    if (metadata.billing_interval !== "monthly" && metadata.billing_interval !== "annual") {
      throw new Error("Invalid custom bundle metadata");
    }
    customInterval = metadata.billing_interval;
    if (metadata.price_id !== price.id) throw new Error("Stripe price metadata does not match subscription");
    if (typeof item.quantity !== "number" || !Number.isSafeInteger(item.quantity) || item.quantity !== selectedBankIds.length) {
      throw new Error("Custom bundle quantity does not match selection");
    }
  }
  if (!isPriceAllowed(metadata.product_id as ProductId, price.id, customInterval)) {
    throw new Error("Stripe price does not match product");
  }

  const startsAt = unixDate(item.current_period_start);
  const entitled = event.type !== "customer.subscription.deleted" &&
    (subscription.status === "active" || subscription.status === "trialing");

  return {
    eventId: event.id,
    eventCreated: event.created,
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    userId: metadata.user_id,
    productId: metadata.product_id as ProductId,
    ...(selectedBankIds ? { selectedBankIds, quantity: item.quantity as number, priceId: price.id } : {}),
    status: entitled ? subscription.status as "active" | "trialing" : "revoked",
    startsAt,
    expiresAt: entitled ? unixDate(item.current_period_end) : null,
  };
}
