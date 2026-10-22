import "server-only";
import type { AccessEntitlement } from "@/lib/access";
import {
  isCheckoutPendingStatus,
  isCheckoutSessionId,
  isCheckoutSettled,
  resolveCheckoutPending,
  type ExpectedPurchase,
} from "@/lib/checkout-pending";
import { validateCustomBankIds } from "@/lib/custom-bundles";
import { LIFETIME_OFFER } from "@/lib/lifetime-offer";
import { createStripeClient } from "@/lib/stripe";
import { getStripeConfig, isStripeBillingEnabled } from "@/lib/stripe-config";

type ReturnedSession = {
  status?: string | null;
  mode?: string | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
};

/** What this user's completed Checkout Session bought, from metadata the checkout routes wrote. Null when it can't be verified. */
export function expectedPurchaseFromSession(session: ReturnedSession, userId: string): ExpectedPurchase | null {
  const metadata = session.metadata ?? {};
  if (session.status !== "complete" || session.client_reference_id !== userId || metadata.user_id !== userId) return null;
  if (session.mode === "payment") {
    return metadata.purchase_type === "lifetime" && metadata.product_id === LIFETIME_OFFER.productId ? { productId: LIFETIME_OFFER.productId } : null;
  }
  if (session.mode !== "subscription" || !metadata.product_id) return null;
  if (metadata.product_id !== "bundle_custom") return { productId: metadata.product_id };
  try {
    return { productId: "bundle_custom", bankIds: validateCustomBankIds(JSON.parse(metadata.selected_bank_ids ?? "")) };
  } catch {
    return null;
  }
}

async function readExpectedPurchase(sessionId: string | undefined, userId: string): Promise<ExpectedPurchase | null> {
  if (!isCheckoutSessionId(sessionId) || !isStripeBillingEnabled()) return null;
  try {
    const stripe = createStripeClient(getStripeConfig().secretKey);
    return expectedPurchaseFromSession(await stripe.checkout.sessions.retrieve(sessionId), userId);
  } catch (error) {
    // Unverified stays pending: the banner never claims success it can't check.
    console.error("Checkout return lookup failed", error instanceof Error ? { name: error.name } : { type: typeof error });
    return null;
  }
}

/** Everything the account page needs about a pending return, measured on the server clock. */
export async function readCheckoutReturn(input: {
  urlStatus: unknown;
  urlSessionId: unknown;
  cookieValue: string | undefined;
  entitlements: readonly AccessEntitlement[];
  userId: string;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const pending = resolveCheckoutPending(input.urlStatus, input.urlSessionId, input.cookieValue, now);
  if (!pending) return null;
  const expected = await readExpectedPurchase(pending.sessionId, input.userId);
  return {
    pending,
    settled: isCheckoutSettled(expected, input.entitlements),
    elapsedMs: now - pending.startedAt,
    fromCheckout: isCheckoutPendingStatus(input.urlStatus),
  };
}
