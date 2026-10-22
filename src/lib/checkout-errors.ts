/**
 * Stable codes the checkout routes return beside their `error` text. The
 * client shows copy for the code and never the raw server or browser message.
 */
export const CHECKOUT_ERROR_CODES = [
  "BILLING_UNAVAILABLE",
  "CHECKOUT_UNAVAILABLE",
  "CHECKOUT_IN_PROGRESS",
  "ACCESS_CHANGED",
  "PAYMENT_ISSUE",
  "BILLING_CONFLICT",
  "MANAGE_EXISTING_PLAN",
  "BILLING_SUPPORT",
  "ALREADY_COVERED",
  "BANKS_ALREADY_OWNED",
  "LIFETIME_ACTIVE",
  "LIFETIME_PAYMENT_PENDING",
] as const;

export type CheckoutErrorCode = (typeof CHECKOUT_ERROR_CODES)[number];

/** Subscription states Stripe keeps billing while a payment is outstanding. The portal fixes them. */
export const LAPSED_SUBSCRIPTION_STATUSES: ReadonlySet<string> = new Set(["past_due", "unpaid", "incomplete"]);

export function isCheckoutErrorCode(value: unknown): value is CheckoutErrorCode {
  return typeof value === "string" && (CHECKOUT_ERROR_CODES as readonly string[]).includes(value);
}

export type CheckoutErrorAction =
  | { kind: "link"; href: string; label: string }
  | { kind: "portal"; label: string };

export type CheckoutErrorCopy = { message: string; action?: CheckoutErrorAction };

const SUBSCRIPTION_LINK = { kind: "link", href: "/account/subscription", label: "View subscription" } as const;
const SUPPORT_LINK = { kind: "link", href: "mailto:hello@pastpaperprep.com", label: "Email support" } as const;

const COPY: Record<CheckoutErrorCode, CheckoutErrorCopy> = {
  BILLING_UNAVAILABLE: { message: "Checkout isn’t available right now. Try again later." },
  CHECKOUT_UNAVAILABLE: { message: "Checkout couldn’t open. Try again in a minute." },
  CHECKOUT_IN_PROGRESS: { message: "Checkout is already opening. Try again in a moment." },
  ACCESS_CHANGED: { message: "Your access just changed. Refresh the page and try again.", action: SUBSCRIPTION_LINK },
  PAYMENT_ISSUE: { message: "Your last payment didn’t go through. Update your payment method to continue.", action: { kind: "portal", label: "Update payment" } },
  BILLING_CONFLICT: { message: "You already have a subscription. Change it from your subscription page.", action: { ...SUBSCRIPTION_LINK, label: "Manage subscription" } },
  // Normally the client follows the route's manageUrl; this covers a response it would not trust.
  MANAGE_EXISTING_PLAN: { message: "Change your current plan from your subscription page.", action: { ...SUBSCRIPTION_LINK, label: "Manage subscription" } },
  BILLING_SUPPORT: { message: "Your billing needs a quick check before this purchase.", action: SUPPORT_LINK },
  ALREADY_COVERED: { message: "All Access is already active on this account.", action: SUBSCRIPTION_LINK },
  BANKS_ALREADY_OWNED: { message: "You already have one of these banks. Pick banks you don’t have yet." },
  LIFETIME_ACTIVE: { message: "Lifetime access already covers every bank.", action: SUBSCRIPTION_LINK },
  LIFETIME_PAYMENT_PENDING: { message: "Your Lifetime payment is still being confirmed. Check back in a minute.", action: { kind: "link", href: "/account", label: "View account" } },
};

export function copyForCheckoutError(code: CheckoutErrorCode): CheckoutErrorCopy {
  return COPY[code];
}

export const NETWORK_ERROR_COPY: CheckoutErrorCopy = { message: "Couldn’t reach checkout. Check your connection and try again." };

/**
 * Copy for a failed checkout response. A 400 without a code carries one of the
 * route's fixed validation messages (for example "Select at least two banks"),
 * so it is shown as is; anything else unrecognised gets the generic message.
 */
export function checkoutErrorCopy(status: number, payload: Record<string, unknown>): CheckoutErrorCopy {
  if (isCheckoutErrorCode(payload.code)) return COPY[payload.code];
  if (status === 400 && typeof payload.error === "string" && payload.error.length <= 120) return { message: payload.error };
  return COPY.CHECKOUT_UNAVAILABLE;
}
