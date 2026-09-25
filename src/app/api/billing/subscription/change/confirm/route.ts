import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createAccountPlanQuote, AccountPlanQuoteConflict } from "@/lib/account-plan-quote";
import { createStripeClient } from "@/lib/stripe";
import { getStripeConfig, isStripeBillingEnabled } from "@/lib/stripe-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "no-referrer" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
class Conflict extends Error {}
type Snapshot = { prorationDate: number; amountDueTodayCents: number; estimatedCreditCents: number; estimatedTaxesCents: number; currency: string; currentSubscriptionId: string; currentItemId: string; currentPriceId: string; currentQuantity: number; periodEnd: number; targetPriceId: string; targetQuantity: number; selectedBankIds: string[]; allAccess: boolean; interval: string };

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Origin not allowed" }, 403);
  if (process.env.STRIPE_PLAN_EDITOR_ENABLED !== "true") return json({ error: "Plan editor is unavailable" }, 404);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Authentication required" }, 401);
  if (!isStripeBillingEnabled()) return json({ error: "Billing is not available" }, 503);
  let body: { selectedBankIds?: unknown; allAccess?: unknown; interval?: unknown; snapshot?: Snapshot };
  try { body = await request.json() as typeof body; } catch { return json({ error: "Invalid JSON" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) || !Array.isArray(body.selectedBankIds) || typeof body.allAccess !== "boolean" || !body.snapshot || typeof body.snapshot !== "object") return json({ error: "Invalid plan confirmation" }, 400);
  const snap = body.snapshot;
  if (!Number.isSafeInteger(snap.prorationDate) || !Number.isSafeInteger(snap.amountDueTodayCents) || !Number.isSafeInteger(snap.estimatedCreditCents) || !Number.isSafeInteger(snap.estimatedTaxesCents) || !Array.isArray(snap.selectedBankIds) || typeof snap.currency !== "string") return json({ error: "Invalid quote snapshot" }, 400);
  const now = Math.floor(Date.now() / 1000);
  if (snap.prorationDate > now || now - snap.prorationDate > 300) return json({ error: "Quote has expired; preview again" }, 409);
  const admin = createAdminClient();
  const intentId = randomUUID();
  let held = false;
  let providerAttempted = false;
  try {
    const { data: reserved, error: reserveError } = await admin.rpc("reserve_billing_checkout", { p_user_id: user.id, p_intent_id: intentId });
    if (reserveError) throw reserveError;
    if (reserved !== true) throw new Conflict("Another billing operation is in progress");
    held = true;
    const { data: customerId, error: mappingError } = await admin.rpc("get_stripe_customer_id", { p_user_id: user.id });
    if (mappingError) throw mappingError;
    if (typeof customerId !== "string" || !customerId) throw new Conflict("No billing account found");
    const config = getStripeConfig();
    const stripe = createStripeClient(config.secretKey);
    const [subscriptions, sessions] = await Promise.all([stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 }), stripe.checkout.sessions.list({ customer: customerId, status: "open", limit: 100 })]);
    if (subscriptions.has_more || sessions.has_more) throw new Conflict("Billing state exceeds the safe limit");
    if (subscriptions.data.some((s) => s.customer !== customerId || s.metadata?.user_id !== user.id)) throw new Conflict("Stripe billing owner mismatch");
    const active = subscriptions.data.filter((s) => s.status === "active");
    if (active.length !== 1 || subscriptions.data.some((s) => s.status !== "active" && s.status !== "canceled" && s.status !== "incomplete_expired")) throw new Conflict("Exactly one active subscription is required");
    if (sessions.data.length) throw new Conflict("An open Checkout session must be resolved first");
    const subscription = active[0];
    const quote = await createAccountPlanQuote({ stripe, admin: admin as never, supabase: supabase as never, userId: user.id, customerId, subscription, config, targetInput: { selectedBankIds: body.selectedBankIds, allAccess: body.allAccess, interval: body.interval }, prorationDate: snap.prorationDate });
    const periodEnd = quote.item.current_period_end;
    if (!Number.isSafeInteger(periodEnd)) throw new Conflict("Subscription period end is invalid");
    const actual = { amountDueTodayCents: quote.amountDueTodayCents, estimatedCreditCents: quote.estimatedCreditCents, estimatedTaxesCents: quote.estimatedTaxesCents, currency: quote.currency, currentSubscriptionId: subscription.id, currentItemId: quote.item.id, currentPriceId: quote.current.priceId, currentQuantity: quote.item.quantity, periodEnd, targetPriceId: quote.target.priceId, targetQuantity: quote.target.quantity, selectedBankIds: quote.targetIds, allAccess: quote.target.productId === "bundle_all", interval: quote.target.interval };
    if (JSON.stringify(actual) !== JSON.stringify({ amountDueTodayCents: snap.amountDueTodayCents, estimatedCreditCents: snap.estimatedCreditCents, estimatedTaxesCents: snap.estimatedTaxesCents, currency: snap.currency, currentSubscriptionId: snap.currentSubscriptionId, currentItemId: snap.currentItemId, currentPriceId: snap.currentPriceId, currentQuantity: snap.currentQuantity, periodEnd: snap.periodEnd, targetPriceId: snap.targetPriceId, targetQuantity: snap.targetQuantity, selectedBankIds: [...snap.selectedBankIds].sort(), allAccess: snap.allAccess, interval: snap.interval })) throw new Conflict("Quote changed; preview again");
    const metadata: Record<string, string> = { ...subscription.metadata, product_id: quote.target.productId, selected_bank_ids: quote.target.productId === "bundle_all" ? "" : JSON.stringify(quote.targetIds), billing_interval: quote.target.interval, price_id: quote.target.priceId };
    providerAttempted = true;
    await stripe.subscriptions.update(subscription.id, { items: [{ id: quote.item.id, price: quote.target.priceId, quantity: quote.target.quantity }], metadata, payment_behavior: "pending_if_incomplete", proration_behavior: "always_invoice", proration_date: quote.prorationDate }, { idempotencyKey: `pastpaperprep-plan-expand-${user.id}-${intentId}`, timeout: 30000 });
    const result = await stripe.subscriptions.retrieve(subscription.id);
    if (result.id !== subscription.id || (typeof result.customer === "string" ? result.customer : result.customer.id) !== customerId || result.metadata?.user_id !== user.id || result.status !== "active" || result.schedule) throw new Error("Subscription update readback mismatch");
    if (result.items?.data?.length !== 1 || result.items.data[0].id !== quote.item.id || result.items.data[0].current_period_end !== quote.item.current_period_end) throw new Error("Subscription item readback mismatch");
    if (result.pending_update) {
      const pending = result.pending_update;
      if ((typeof result.items.data[0].price === "string" ? result.items.data[0].price : result.items.data[0].price.id) !== quote.current.priceId || result.items.data[0].quantity !== quote.item.quantity || result.metadata?.product_id !== subscription.metadata.product_id || result.metadata?.selected_bank_ids !== subscription.metadata.selected_bank_ids) throw new Error("Current subscription changed before payment");
      if (!pending.subscription_items?.some((item) => item.id === quote.item.id && (typeof item.price === "string" ? item.price : item.price?.id) === quote.target.priceId && item.quantity === quote.target.quantity) || pending.metadata?.product_id !== quote.target.productId || (quote.target.productId === "bundle_all" ? pending.metadata?.selected_bank_ids != null && pending.metadata.selected_bank_ids !== "" : pending.metadata?.selected_bank_ids !== metadata.selected_bank_ids) || pending.metadata?.billing_interval !== quote.target.interval || pending.metadata?.price_id !== quote.target.priceId) throw new Error("Pending subscription update mismatch");
    } else {
      const item = result.items.data.find(({ id }) => id === quote.item.id);
      if (!item || (typeof item.price === "string" ? item.price : item.price.id) !== quote.target.priceId || item.quantity !== quote.target.quantity || result.metadata?.product_id !== quote.target.productId || result.metadata?.price_id !== quote.target.priceId || result.metadata?.billing_interval !== quote.target.interval || (quote.target.productId === "bundle_all" ? result.metadata?.selected_bank_ids != null && result.metadata.selected_bank_ids !== "" : result.metadata?.selected_bank_ids !== metadata.selected_bank_ids)) throw new Error("Applied subscription update mismatch");
    }
    const { data: released, error: releaseError } = await admin.rpc("release_billing_checkout", { p_user_id: user.id, p_intent_id: intentId });
    if (releaseError || released !== true) throw new Error("Billing reservation release failed");
    held = false;
    return json({ status: result.pending_update ? "pending" : "processing" });
  } catch (error) {
    if (held && !providerAttempted) {
      const { data: released, error: releaseError } = await admin.rpc("release_billing_checkout", { p_user_id: user.id, p_intent_id: intentId });
      if (releaseError || released !== true) console.error("Billing reservation cleanup failed");
      held = false;
    }
    if (error instanceof Conflict || error instanceof AccountPlanQuoteConflict || error instanceof Error && ["Unsupported billing interval", "Invalid plan selection", "Unknown bank", "Duplicate bank", "Bank is unavailable", "Select at least one bank", "Subscription is not editable", "Expected exactly one subscription item", "Subscription price is not currently editable"].includes(error.message)) return json({ error: error.message }, 409);
    console.error("Stripe subscription confirmation failed", error instanceof Error ? { name: error.name } : { type: typeof error });
    return json({ error: "Subscription change is temporarily unavailable" }, 503);
  }
}
