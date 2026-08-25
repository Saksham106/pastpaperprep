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

export type SubscriptionSync = {
  eventId: string;
  eventCreated: number;
  subscriptionId: string;
  customerId: string;
  userId: string;
  productId: "bundle_all";
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

export function buildSubscriptionSync(eventValue: unknown, knownPriceIds: ReadonlySet<string>): SubscriptionSync | null {
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
    metadata.product_id !== "bundle_all"
  ) {
    throw new Error("Invalid subscription metadata");
  }

  const items = record(subscription.items, "Invalid subscription items");
  if (!Array.isArray(items.data) || items.data.length !== 1) throw new Error("Invalid subscription items");
  const item = record(items.data[0], "Invalid subscription item");
  const price = record(item.price, "Invalid subscription price");
  if (typeof price.id !== "string" || !knownPriceIds.has(price.id)) throw new Error("Unknown Stripe price");

  const startsAt = unixDate(item.current_period_start);
  const entitled = event.type !== "customer.subscription.deleted" &&
    (subscription.status === "active" || subscription.status === "trialing");

  return {
    eventId: event.id,
    eventCreated: event.created,
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    userId: metadata.user_id,
    productId: "bundle_all",
    status: entitled ? subscription.status as "active" | "trialing" : "revoked",
    startsAt,
    expiresAt: entitled ? unixDate(item.current_period_end) : null,
  };
}
