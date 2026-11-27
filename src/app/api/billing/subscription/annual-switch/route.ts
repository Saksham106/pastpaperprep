import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { ANNUAL_SALE } from "@/lib/annual-sale";
import { AnnualSaleUnavailableError } from "@/lib/annual-sale-checkout";
import { AnnualSwitchConflict, createAnnualSwitchQuote, type AnnualSwitchQuote } from "@/lib/annual-sale-switch";
import { createStripeClient } from "@/lib/stripe";
import { getStripeConfig, isStripeBillingEnabled } from "@/lib/stripe-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { withFailureReporting } from "@/lib/route-failure-reporting";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "no-referrer" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
class Conflict extends Error {}

/** What the browser shows and sends back; confirm only proceeds if a fresh quote matches it exactly. */
type Snapshot = {
  prorationDate: number; amountDueTodayCents: number; creditCents: number; taxesCents: number; currency: string;
  subscriptionId: string; itemId: string; currentPriceId: string; targetPriceId: string; quantity: number; couponId: string;
};
const snapshotOf = (quote: AnnualSwitchQuote): Snapshot => ({
  prorationDate: quote.prorationDate, amountDueTodayCents: quote.amountDueTodayCents, creditCents: quote.creditCents, taxesCents: quote.taxesCents, currency: quote.currency,
  subscriptionId: quote.subscription.id, itemId: quote.item.id, currentPriceId: quote.current.priceId, targetPriceId: quote.target.priceId, quantity: quote.target.quantity, couponId: quote.couponId,
});
const sameSnapshot = (a: Snapshot, b: Snapshot) => (Object.keys(a) as (keyof Snapshot)[]).every((key) => a[key] === b[key]);
// readEditableCurrentPlan / resolveAccountPlanTarget refusals: the plan can't be switched here (409, not an outage).
const EDITOR_ERRORS = [
  "Subscription is not editable", "Expected exactly one subscription item", "Subscription price is not currently editable", "Unsupported billing interval", "Bank is unavailable",
  "Invalid subscription quantity", "Unsupported Stripe interval", "Missing subscription product metadata", "Inconsistent subscription metadata", "Missing custom bundle metadata",
  "Unexpected All Access bank metadata", "Missing selected bank metadata", "Invalid selected bank metadata", "Invalid custom bundle selection", "Unexpected fixed bank selection",
  "Invalid fixed bank quantity", "Fixed product does not identify exactly one available bank",
];

async function loadSubscription(stripe: Stripe, customerId: string, userId: string) {
  const [subscriptions, sessions] = await Promise.all([
    stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 }),
    stripe.checkout.sessions.list({ customer: customerId, status: "open", limit: 100 }),
  ]);
  if (subscriptions.has_more || sessions.has_more) throw new Conflict("Billing state exceeds the safe limit");
  if (subscriptions.data.some((s) => (typeof s.customer === "string" ? s.customer : s.customer.id) !== customerId || s.metadata?.user_id !== userId)) throw new Conflict("Stripe billing owner mismatch");
  const active = subscriptions.data.filter((s) => s.status === "active");
  if (active.length !== 1 || subscriptions.data.some((s) => s.status !== "active" && s.status !== "canceled" && s.status !== "incomplete_expired")) throw new Conflict("Exactly one active subscription is required");
  if (sessions.data.length) throw new Conflict("An open Checkout session must be resolved first");
  return active[0];
}

function isSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return ["prorationDate", "amountDueTodayCents", "creditCents", "taxesCents", "quantity"].every((key) => Number.isSafeInteger(v[key]))
    && ["currency", "subscriptionId", "itemId", "currentPriceId", "targetPriceId", "couponId"].every((key) => typeof v[key] === "string" && (v[key] as string).length > 0 && (v[key] as string).length < 200);
}

async function handlePOST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Origin not allowed" }, 403);
  if (process.env.STRIPE_PLAN_EDITOR_ENABLED !== "true") return json({ error: "Plan editor is unavailable" }, 404);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Authentication required" }, 401);
  if (!isStripeBillingEnabled()) return json({ error: "Billing is not available" }, 503);
  let body: { intent?: unknown; snapshot?: unknown };
  try { body = await request.json() as typeof body; } catch { return json({ error: "Invalid JSON" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) || (body.intent !== "preview" && body.intent !== "confirm")) return json({ error: "Invalid request" }, 400);
  if (body.intent === "confirm" && !isSnapshot(body.snapshot)) return json({ error: "Invalid quote snapshot" }, 400);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const snap = body.intent === "confirm" ? body.snapshot as Snapshot : null;
  if (snap && (snap.prorationDate > nowSeconds || nowSeconds - snap.prorationDate > 300)) return json({ error: "Quote has expired; preview again" }, 409);

  const admin = createAdminClient();
  const intentId = randomUUID();
  let held = false;
  let providerAttempted = false;
  try {
    const config = getStripeConfig();
    const { data: customerId, error: mappingError } = await admin.rpc("get_stripe_customer_id", { p_user_id: user.id });
    if (mappingError) throw mappingError;
    if (typeof customerId !== "string" || !customerId) return json({ error: "No billing account found" }, 404);
    const stripe = createStripeClient(config.secretKey);

    if (!snap) {
      const subscription = await loadSubscription(stripe, customerId, user.id);
      const quote = await createAnnualSwitchQuote({ stripe, admin: admin as never, userId: user.id, customerId, subscription, config, now: Date.now() });
      return json({
        estimate: { amountDueTodayCents: quote.amountDueTodayCents, creditCents: quote.creditCents, taxesCents: quote.taxesCents, accountCreditCents: quote.accountCreditCents, firstYearCents: quote.firstYearCents, renewsAtCents: quote.renewsAtCents, percentOff: quote.percentOff, currency: quote.currency, isEstimate: true },
        snapshot: snapshotOf(quote),
      });
    }

    // Confirm: the same per-user lock as Checkout and plan changes, then a fresh quote at the quoted time.
    const { data: reserved, error: reserveError } = await admin.rpc("reserve_billing_checkout", { p_user_id: user.id, p_intent_id: intentId });
    if (reserveError) throw reserveError;
    if (reserved !== true) throw new Conflict("Another billing operation is in progress");
    held = true;
    const subscription = await loadSubscription(stripe, customerId, user.id);
    const quote = await createAnnualSwitchQuote({ stripe, admin: admin as never, userId: user.id, customerId, subscription, config, now: Date.now(), prorationDate: snap.prorationDate });
    if (!sameSnapshot(snapshotOf(quote), snap)) throw new Conflict("Quote changed; preview again");
    const metadata: Record<string, string> = { ...subscription.metadata, billing_interval: "annual", price_id: quote.target.priceId, annual_sale: ANNUAL_SALE.id };
    providerAttempted = true;
    // pending_if_incomplete: the plan only becomes annual once this invoice is paid; a declined card
    // leaves the monthly plan exactly as it was (Stripe drops the pending change after ~23 hours).
    await stripe.subscriptions.update(subscription.id, {
      items: [{ id: quote.item.id, price: quote.target.priceId, quantity: quote.target.quantity }],
      discounts: [{ coupon: quote.couponId }],
      metadata,
      payment_behavior: "pending_if_incomplete",
      proration_behavior: "always_invoice",
      proration_date: quote.prorationDate,
    }, { idempotencyKey: `pastpaperprep-annual-switch-${user.id}-${intentId}`, timeout: 30000 });
    const result = await stripe.subscriptions.retrieve(subscription.id);
    const resultItem = result.items?.data?.length === 1 ? result.items.data[0] : null;
    const priceOf = (item: { price?: string | { id?: string } | null } | null | undefined) => typeof item?.price === "string" ? item.price : item?.price?.id;
    if (result.id !== subscription.id || (typeof result.customer === "string" ? result.customer : result.customer.id) !== customerId || result.metadata?.user_id !== user.id || result.status !== "active" || result.schedule || !resultItem || resultItem.id !== quote.item.id) {
      throw new Error("Subscription update readback mismatch");
    }
    let payUrl: string | null = null;
    if (result.pending_update) {
      const pending = result.pending_update;
      if (priceOf(resultItem) !== quote.current.priceId || result.metadata?.billing_interval !== subscription.metadata.billing_interval) throw new Error("Current subscription changed before payment");
      if (!pending.subscription_items?.some((item) => item.id === quote.item.id && priceOf(item) === quote.target.priceId && item.quantity === quote.target.quantity)
        || !pending.discounts?.length
        || pending.metadata?.billing_interval !== "annual" || pending.metadata?.price_id !== quote.target.priceId || pending.metadata?.annual_sale !== ANNUAL_SALE.id) {
        throw new Error("Pending subscription update mismatch");
      }
      // Declined or waiting on 3D Secure: Stripe's own invoice page lets the student finish paying.
      const invoiceId = typeof result.latest_invoice === "string" ? result.latest_invoice : result.latest_invoice?.id;
      if (invoiceId) {
        try {
          const invoice = await stripe.invoices.retrieve(invoiceId);
          const url = invoice.hosted_invoice_url;
          if ((typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id) === customerId && typeof url === "string" && url.startsWith("https://invoice.stripe.com/")) payUrl = url;
        } catch { /* The plan is unchanged either way; the student can pay from Billing. */ }
      }
    } else if (priceOf(resultItem) !== quote.target.priceId || resultItem.quantity !== quote.target.quantity || result.metadata?.billing_interval !== "annual" || result.metadata?.price_id !== quote.target.priceId || result.metadata?.product_id !== quote.current.productId) {
      throw new Error("Applied subscription update mismatch");
    }
    const { data: released, error: releaseError } = await admin.rpc("release_billing_checkout", { p_user_id: user.id, p_intent_id: intentId });
    if (releaseError || released !== true) throw new Error("Billing reservation release failed");
    held = false;
    return json(result.pending_update ? { status: "pending", ...(payUrl ? { payUrl } : {}) } : { status: "processing" });
  } catch (error) {
    if (held && !providerAttempted) {
      const { data: released, error: releaseError } = await admin.rpc("release_billing_checkout", { p_user_id: user.id, p_intent_id: intentId });
      if (releaseError || released !== true) console.error("Billing reservation cleanup failed");
    }
    if (error instanceof AnnualSaleUnavailableError) return json({ error: "The sale price is not available right now", code: "SALE_UNAVAILABLE" }, 503);
    if (error instanceof Conflict || error instanceof AnnualSwitchConflict || error instanceof Error && EDITOR_ERRORS.includes(error.message)) return json({ error: error.message }, 409);
    console.error("Annual sale switch failed", error instanceof Error ? { name: error.name } : { type: typeof error });
    return json({ error: "Switching to annual is temporarily unavailable" }, 503);
  }
}

export const POST = withFailureReporting("/api/billing/subscription/annual-switch", handlePOST);
