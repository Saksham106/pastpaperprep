import { NextResponse } from "next/server";
import { createAccountPlanQuote, AccountPlanQuoteConflict } from "@/lib/account-plan-quote";
import { resolveAccountPlanTarget } from "@/lib/account-plan-target";
import { createStripeClient } from "@/lib/stripe";
import { getStripeConfig, isStripeBillingEnabled } from "@/lib/stripe-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { recurringPriceSubtotal } from "@/lib/account-billing-view";

export const runtime = "nodejs";
const HEADERS = { "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "no-referrer" };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: HEADERS });
class Conflict extends Error {}
type Body = { selectedBankIds?: unknown; allAccess?: unknown; interval?: unknown };
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Origin not allowed" }, 403);
  if (process.env.STRIPE_PLAN_EDITOR_ENABLED !== "true") return json({ error: "Plan editor is unavailable" }, 404);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return json({ error: "Authentication required" }, 401);
  if (!isStripeBillingEnabled()) return json({ error: "Billing is not available" }, 503);
  let body: Body;
  try { body = await request.json() as Body; } catch { return json({ error: "Invalid JSON" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) || !Array.isArray(body.selectedBankIds) || typeof body.allAccess !== "boolean") return json({ error: "Invalid plan selection" }, 400);
  try {
    const config = getStripeConfig();
    resolveAccountPlanTarget({ selectedBankIds: body.selectedBankIds, allAccess: body.allAccess, interval: body.interval }, config);
    const admin = createAdminClient();
    const { data: customerId, error: mappingError } = await admin.rpc("get_stripe_customer_id", { p_user_id: user.id });
    if (mappingError) throw mappingError;
    if (typeof customerId !== "string" || !customerId) return json({ error: "No billing account found" }, 404);
    const stripe = createStripeClient(config.secretKey);
    const [subscriptions, sessions] = await Promise.all([stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 }), stripe.checkout.sessions.list({ customer: customerId, status: "open", limit: 100 })]);
    if (subscriptions.has_more || sessions.has_more) throw new Conflict("Billing state exceeds the safe preview limit");
    const active = subscriptions.data.filter((s) => s.status === "active");
    if (active.length !== 1 || subscriptions.data.some((s) => s.status !== "active" && s.status !== "canceled" && s.status !== "incomplete_expired")) throw new Conflict("Exactly one active subscription is required");
    if (sessions.data.length) throw new Conflict("An open Checkout session must be resolved first");
    const quote = await createAccountPlanQuote({ stripe, admin: admin as never, supabase: supabase as never, userId: user.id, customerId, subscription: active[0], config, targetInput: { selectedBankIds: body.selectedBankIds, allAccess: body.allAccess, interval: body.interval } });
    const price = await stripe.prices.retrieve(quote.target.priceId, { expand: ["tiers"] });
    if (price.id !== quote.target.priceId || !price.active || price.currency !== "usd" || price.recurring?.interval !== (quote.target.interval === "monthly" ? "month" : "year") || price.recurring?.interval_count !== 1) throw new Conflict("Stripe target price does not match the active plan");
    const recurringSubtotalCents = recurringPriceSubtotal(price, quote.target.quantity);
    if (recurringSubtotalCents === null) throw new Conflict("Future recurring rate is unavailable");
    return json({ estimate: { amountDueTodayCents: quote.amountDueTodayCents, estimatedCreditCents: quote.estimatedCreditCents, estimatedTaxesCents: quote.estimatedTaxesCents, recurringSubtotalCents, currency: quote.currency, isEstimate: true }, target: { productId: quote.target.productId, selectedBankIds: quote.targetIds, interval: quote.target.interval, renewalAt: quote.item.current_period_end ? new Date(quote.item.current_period_end * 1000).toISOString() : null }, snapshot: { prorationDate: quote.prorationDate, amountDueTodayCents: quote.amountDueTodayCents, estimatedCreditCents: quote.estimatedCreditCents, estimatedTaxesCents: quote.estimatedTaxesCents, currency: quote.currency, currentSubscriptionId: quote.subscription.id, currentItemId: quote.item.id, currentPriceId: quote.current.priceId, currentQuantity: quote.item.quantity, periodEnd: quote.item.current_period_end, targetPriceId: quote.target.priceId, targetQuantity: quote.target.quantity, selectedBankIds: quote.targetIds, allAccess: quote.target.productId === "bundle_all", interval: quote.target.interval } });
  } catch (error) {
    if (error instanceof Conflict || error instanceof AccountPlanQuoteConflict || error instanceof Error && ["Subscription is not editable", "Expected exactly one subscription item", "Subscription price is not currently editable"].includes(error.message)) return json({ error: error.message }, 409);
    if (error instanceof Error && ["Unsupported billing interval", "Invalid plan selection", "Unknown bank", "Duplicate bank", "Bank is unavailable", "Select at least one bank"].includes(error.message)) return json({ error: error.message }, 400);
    console.error("Stripe subscription preview failed", error instanceof Error ? { name: error.name } : { type: typeof error });
    return json({ error: "Subscription preview is temporarily unavailable" }, 503);
  }
}
