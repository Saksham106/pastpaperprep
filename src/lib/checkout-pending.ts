import { hasBankAccess, type AccessEntitlement } from "@/lib/access";
import { getEntitlementBanks } from "@/lib/banks";

/**
 * After Stripe returns a buyer to /account, the webhook may not have granted
 * access yet. This short-lived cookie remembers the return (and its Checkout
 * Session id) so a refresh keeps the "finishing setup" state. It is a hint for
 * neutral copy only: what was bought is read back from Stripe on the server,
 * and access always comes from the entitlement read.
 */
export const CHECKOUT_PENDING_COOKIE = "ppp_checkout_pending";
export const CHECKOUT_PENDING_MAX_AGE_SECONDS = 30 * 60;
/** How long the account page keeps refreshing itself before saying setup is slow. */
export const CHECKOUT_PENDING_POLL_MS = 2 * 60 * 1000;

export type CheckoutPendingStatus = "success" | "lifetime-pending";
export type CheckoutPending = { status: CheckoutPendingStatus; startedAt: number; sessionId?: string };
/** The product (and, for a custom bundle, the banks) one verified Checkout Session bought. */
export type ExpectedPurchase = { productId: string; bankIds?: readonly string[] };

const SESSION_ID = /^cs_(?:test|live)_[A-Za-z0-9]{1,200}$/;

export function isCheckoutPendingStatus(value: unknown): value is CheckoutPendingStatus {
  return value === "success" || value === "lifetime-pending";
}

export function isCheckoutSessionId(value: unknown): value is string {
  return typeof value === "string" && SESSION_ID.test(value);
}

export function serializeCheckoutPending(pending: CheckoutPending): string {
  return `${pending.status}.${pending.startedAt}${pending.sessionId ? `.${pending.sessionId}` : ""}`;
}

export function parseCheckoutPending(value: string | undefined, now = Date.now()): CheckoutPending | null {
  const match = value ? /^(success|lifetime-pending)\.(\d{13})(?:\.(cs_(?:test|live)_[A-Za-z0-9]{1,200}))?$/.exec(value) : null;
  if (!match) return null;
  const startedAt = Number(match[2]);
  const age = now - startedAt;
  if (age < -60_000 || age > CHECKOUT_PENDING_MAX_AGE_SECONDS * 1000) return null;
  return { status: match[1] as CheckoutPendingStatus, startedAt, ...(match[3] ? { sessionId: match[3] } : {}) };
}

/**
 * The pending return from the URL, else the cookie. The same return (status
 * and session) keeps its original start time; a new return starts over.
 */
export function resolveCheckoutPending(urlStatus: unknown, urlSessionId: unknown, cookieValue: string | undefined, now = Date.now()): CheckoutPending | null {
  const stored = parseCheckoutPending(cookieValue, now);
  if (!isCheckoutPendingStatus(urlStatus)) return stored;
  const sessionId = isCheckoutSessionId(urlSessionId) ? urlSessionId : undefined;
  if (stored?.status === urlStatus && stored.sessionId === sessionId) return stored;
  return { status: urlStatus, startedAt: now, ...(sessionId ? { sessionId } : {}) };
}

/**
 * Whether the purchase has been granted: an active entitlement for exactly the
 * product bought (and the same banks for a custom bundle). Checkout refuses to
 * sell a product the account already has, so that entitlement can only come
 * from this purchase. An unverified purchase is never settled.
 */
export function isCheckoutSettled(expected: ExpectedPurchase | null, entitlements: readonly AccessEntitlement[]): boolean {
  if (!expected) return false;
  const wanted = expected.bankIds ? [...expected.bankIds].sort().join(",") : null;
  return entitlements.some((entitlement) => entitlement.productId === expected.productId
    && (wanted === null || [...(entitlement.selectedBankIds ?? [])].sort().join(",") === wanted)
    && getEntitlementBanks().some(({ slug }) => hasBankAccess(slug, [entitlement])));
}
