/**
 * Cancel-flow retention offers. Pure and shared by the cancellation route and the account editor.
 *
 * One optional reason, then at most one offer (always beside "Continue to cancel"), then confirm.
 * Half of accounts (fixed per account) are a holdout that never sees an offer, so the save rate is measurable.
 */

export const CANCEL_REASONS = ["too_expensive", "not_studying", "missing_subject", "other"] as const;
export type CancelReason = typeof CANCEL_REASONS[number];

/** Stripe `cancellation_details.feedback` value stored with the cancellation. */
export const STRIPE_CANCEL_FEEDBACK = {
  too_expensive: "too_expensive",
  not_studying: "unused",
  missing_subject: "missing_features",
  other: "other",
} as const satisfies Record<CancelReason, string>;

export const RETENTION_DISCOUNT_PERCENT = 30;
/** A customer gets the discount at most once in this window, across all their subscriptions. */
export const RETENTION_DISCOUNT_COOLDOWN_DAYS = 365;
/** No marked question or saved worksheet for this long counts as "not studying right now". */
export const INACTIVE_AFTER_DAYS = 30;
/** Subscription metadata key recording when the retention discount was accepted. */
export const RETENTION_ACCEPTED_METADATA_KEY = "retention_offer_accepted_at";

export type PlanShape = "single" | "builder" | "all";
export type RetentionOffer = { kind: "discount"; percentOff: number } | { kind: "fewer_banks" } | { kind: "updates" };
export type RetentionDecision = {
  /** What to show: always null for the holdout. */
  offer: RetentionOffer | null;
  /** What this account qualifies for, logged for both groups so the holdout comparison is like for like. */
  eligibleOffer: RetentionOffer | null;
  /** The reason the offer was chosen for: the student's answer, or a prediction when they skipped or chose "other". */
  basis: Exclude<CancelReason, "other">;
  predicted: boolean;
  holdout: boolean;
};

export function isCancelReason(value: unknown): value is CancelReason {
  return typeof value === "string" && (CANCEL_REASONS as readonly string[]).includes(value);
}

/** Stable 50/50 split per account (FNV-1a). The same account always lands in the same group. */
export function isRetentionHoldout(userId: string): boolean {
  let hash = 0x811c9dc5;
  for (const char of `retention-holdout-v1:${userId}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % 2 === 0;
}

/** With no usable answer, guess from recorded study activity. No record at all is no signal, not inactivity. */
export function predictCancelReason(lastActivityAt: Date | null, now: Date): "too_expensive" | "not_studying" {
  if (!lastActivityAt || !Number.isFinite(lastActivityAt.getTime())) return "too_expensive";
  return now.getTime() - lastActivityAt.getTime() >= INACTIVE_AFTER_DAYS * 86_400_000 ? "not_studying" : "too_expensive";
}

export function chooseRetentionOffer(input: {
  reason: CancelReason | null;
  plan: PlanShape;
  interval: "monthly" | "annual";
  discountEligible: boolean;
  holdout: boolean;
  lastActivityAt: Date | null;
  now: Date;
}): RetentionDecision {
  const predicted = input.reason === null || input.reason === "other";
  const basis = predicted ? predictCancelReason(input.lastActivityAt, input.now) : input.reason as Exclude<CancelReason, "other">;
  const decision = (offer: RetentionOffer | null): RetentionDecision => ({ offer: input.holdout ? null : offer, eligibleOffer: offer, basis, predicted, holdout: input.holdout });
  if (basis === "missing_subject") return decision({ kind: "updates" });
  // A one-off discount only on monthly plans: a "once" coupon on an annual renewal would take 30% off a whole year.
  if (basis === "too_expensive" && input.interval === "monthly" && input.discountEligible) return decision({ kind: "discount", percentOff: RETENTION_DISCOUNT_PERCENT });
  // Downgrades keep savers longest; nothing is cheaper than One Bank.
  if (input.plan !== "single") return decision({ kind: "fewer_banks" });
  return decision(null);
}

/** True when any of the customer's subscriptions accepted the discount inside the cooldown window. */
export function acceptedDiscountRecently(subscriptions: { metadata?: Record<string, string> | null }[], now: Date): boolean {
  const cutoff = now.getTime() - RETENTION_DISCOUNT_COOLDOWN_DAYS * 86_400_000;
  return subscriptions.some((subscription) => {
    const value = subscription.metadata?.[RETENTION_ACCEPTED_METADATA_KEY];
    if (value === undefined || value === "") return false;
    const at = Date.parse(value);
    // An unreadable marker still counts: fail closed rather than re-offer.
    return !Number.isFinite(at) || at >= cutoff;
  });
}

/** Plan shape from the subscription's own product metadata (never from the browser). */
export function planShapeFromMetadata(metadata: Record<string, string> | null | undefined): PlanShape | null {
  const product = metadata?.product_id;
  if (!product) return null;
  if (product === "bundle_all") return "all";
  if (product.startsWith("bank_")) return "single";
  if (product === "bundle_custom") {
    try {
      const ids: unknown = JSON.parse(metadata?.selected_bank_ids ?? "");
      if (!Array.isArray(ids) || ids.length < 1) return null;
      return ids.length === 1 ? "single" : "builder";
    } catch { return null; }
  }
  // Legacy pair/subject bundles cover more than one bank.
  return product.startsWith("bundle_") ? "builder" : null;
}
