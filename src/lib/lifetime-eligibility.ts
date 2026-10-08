import { LIFETIME_OFFER } from "@/lib/lifetime-offer";

type Subscription = {
  status?: unknown;
  metadata?: Record<string, unknown>;
  cancel_at_period_end?: unknown;
  cancel_at?: unknown;
  pending_update?: unknown;
  schedule?: unknown;
  items?: { data?: Array<{ id?: unknown; quantity?: unknown; price?: { id?: unknown; currency?: unknown; recurring?: { interval?: unknown } | null } | string | null }> } | null;
};
type Entitlement = { source?: unknown; status?: unknown; startsAt?: unknown; expiresAt?: unknown; starts_at?: unknown; expires_at?: unknown };
type Input = {
  entitlements: Entitlement[];
  lifetimeOwned: boolean;
  subscriptions: Subscription[];
  customerOwned: boolean;
  catalogMatches: boolean[];
};
export type LifetimeEligibilityState = "eligible" | "conversion_eligible" | "covered" | "billing_support";
export type LifetimeEligibility =
  | { state: "eligible"; priceCents: 29900; currency: "usd"; creditCents: 0; renewalStopsAfterPayment: false }
  | { state: "conversion_eligible"; priceCents: 29900; currency: "usd"; creditCents: 0; renewalStopsAfterPayment: true }
  | { state: "covered"; reason: "access_covered" }
  | { state: "billing_support"; reason: "billing_support" };
const BILLABLE = new Set(["active", "trialing", "past_due", "unpaid", "paused", "incomplete"]);
export function classifyLifetimeEligibility(input: Input): LifetimeEligibility {
  const now = Date.now();
  if (input.lifetimeOwned || input.entitlements.some((e) => e.source === "manual" && e.status === "active" &&
    (typeof (e.startsAt ?? e.starts_at) !== "string" || Date.parse(String(e.startsAt ?? e.starts_at)) <= now) &&
    ((e.expiresAt ?? e.expires_at) == null || Date.parse(String(e.expiresAt ?? e.expires_at)) > now))) return { state: "covered", reason: "access_covered" };
  const active = input.subscriptions.filter((s) => typeof s.status === "string" && BILLABLE.has(s.status));
  if (!active.length) return { state: "eligible", priceCents: LIFETIME_OFFER.amountCents, currency: LIFETIME_OFFER.currency, creditCents: 0, renewalStopsAfterPayment: false };
  if (!input.customerOwned || active.length !== 1 || input.catalogMatches.length !== 1 || input.catalogMatches[0] !== true) return { state: "billing_support", reason: "billing_support" };
  const sub = active[0];
  const items = sub.items?.data;
  const item = items?.[0];
  const quantity = item?.quantity;
  const isCustom = sub.metadata?.product_id === "bundle_custom";
  const selected = sub.metadata?.selected_bank_ids;
  let selectedIds: unknown[] = [];
  if (typeof selected === "string") { try { const value: unknown = JSON.parse(selected); if (Array.isArray(value)) selectedIds = value; } catch { /* fail closed */ } }
  const validQuantity = isCustom ? Number.isInteger(quantity) && Number(quantity) >= 2 && Number(quantity) <= 5 && selectedIds.length === quantity && selectedIds.every((id) => typeof id === "string") && new Set(selectedIds).size === selectedIds.length : quantity === 1;
  if (sub.status !== "active" || sub.cancel_at_period_end !== false || sub.cancel_at != null || sub.pending_update != null || sub.schedule != null ||
    !Array.isArray(items) || items.length !== 1 || !validQuantity || typeof item?.id !== "string" ||
    !item.price || typeof item.price === "string" || item.price.currency !== "usd" ||
    (item.price.recurring?.interval !== "month" && item.price.recurring?.interval !== "year")) return { state: "billing_support", reason: "billing_support" };
  return { state: "conversion_eligible", priceCents: LIFETIME_OFFER.amountCents, currency: LIFETIME_OFFER.currency, creditCents: 0, renewalStopsAfterPayment: true };
}
