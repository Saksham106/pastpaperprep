import { hasBankAccess, type AccessEntitlement } from "@/lib/access";
import { getEntitlementBanks } from "@/lib/banks";

/**
 * After Stripe returns a buyer to /account, the webhook may not have granted
 * access yet. This short-lived cookie remembers the return so a refresh keeps
 * the "finishing setup" state. It is a client hint for neutral copy only;
 * access itself always comes from the entitlement read.
 */
export const CHECKOUT_PENDING_COOKIE = "ppp_checkout_pending";
export const CHECKOUT_PENDING_MAX_AGE_SECONDS = 30 * 60;
/** How long the account page keeps refreshing itself before saying setup is slow. */
export const CHECKOUT_PENDING_POLL_MS = 2 * 60 * 1000;

export type CheckoutPendingStatus = "success" | "lifetime-pending";
export type CheckoutPending = { status: CheckoutPendingStatus; startedAt: number };

export function isCheckoutPendingStatus(value: unknown): value is CheckoutPendingStatus {
  return value === "success" || value === "lifetime-pending";
}

export function serializeCheckoutPending(pending: CheckoutPending): string {
  return `${pending.status}.${pending.startedAt}`;
}

export function parseCheckoutPending(value: string | undefined, now = Date.now()): CheckoutPending | null {
  const match = value ? /^(success|lifetime-pending)\.(\d{13})$/.exec(value) : null;
  if (!match) return null;
  const startedAt = Number(match[2]);
  const age = now - startedAt;
  if (age < -60_000 || age > CHECKOUT_PENDING_MAX_AGE_SECONDS * 1000) return null;
  return { status: match[1] as CheckoutPendingStatus, startedAt };
}

/** The pending return from the URL, else the cookie. A same-status cookie keeps its original start time. */
export function resolveCheckoutPending(urlStatus: unknown, cookieValue: string | undefined, now = Date.now()): CheckoutPending | null {
  const stored = parseCheckoutPending(cookieValue, now);
  if (!isCheckoutPendingStatus(urlStatus)) return stored;
  return stored?.status === urlStatus ? stored : { status: urlStatus, startedAt: now };
}

/** Everything the account page needs about a pending return, measured on the server clock. */
export function readCheckoutReturn(urlStatus: unknown, cookieValue: string | undefined, entitlements: readonly AccessEntitlement[], now = Date.now()) {
  const pending = resolveCheckoutPending(urlStatus, cookieValue, now);
  if (!pending) return null;
  return { pending, settled: isCheckoutSettled(pending, entitlements), elapsedMs: now - pending.startedAt, fromCheckout: isCheckoutPendingStatus(urlStatus) };
}

/**
 * Whether the purchase behind a pending return has been granted. Lifetime is
 * settled by an active Lifetime entitlement. A subscription is settled by
 * access whose period started near the return, so a buyer adding a bank to an
 * older plan is not shown "ready" before the new grant lands.
 */
export function isCheckoutSettled(pending: CheckoutPending, entitlements: readonly AccessEntitlement[]): boolean {
  const grantsAccess = (entitlement: AccessEntitlement) => getEntitlementBanks().some(({ slug }) => hasBankAccess(slug, [entitlement]));
  if (pending.status === "lifetime-pending") {
    return entitlements.some((entitlement) => entitlement.productId === "lifetime_all_access" && grantsAccess(entitlement));
  }
  const earliest = pending.startedAt - CHECKOUT_PENDING_MAX_AGE_SECONDS * 1000;
  return entitlements.some((entitlement) => {
    const startsAt = entitlement.startsAt ? Date.parse(entitlement.startsAt) : Number.NaN;
    return Number.isFinite(startsAt) && startsAt >= earliest && grantsAccess(entitlement);
  });
}
