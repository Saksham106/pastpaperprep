import { NextResponse } from "next/server";
import { fetchAccessEntitlements } from "@/lib/custom-bundle-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createStripeClient } from "@/lib/stripe";
import { getStripeConfig, isStripeBillingEnabled } from "@/lib/stripe-config";
import { classifyLifetimeEligibility } from "@/lib/lifetime-eligibility";
import { readEditableCurrentPlan } from "@/lib/account-plan-target";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401, headers: NO_STORE });
  if (!isStripeBillingEnabled()) return NextResponse.json({ error: "Billing is not available yet" }, { status: 503, headers: NO_STORE });
  try {
    const admin = createAdminClient();
    const access = await fetchAccessEntitlements(supabase as never, user.id);
    if (access.error) throw new Error("Entitlements could not be verified");
    const purchases = await admin.from("lifetime_purchases").select("status").eq("user_id", user.id).eq("status", "paid").limit(1);
    if (purchases.error) throw purchases.error;
    const mapping = await admin.rpc("get_stripe_customer_id", { p_user_id: user.id });
    if (mapping.error) throw mapping.error;
    const customerId = typeof mapping.data === "string" ? mapping.data : null;
    const config = getStripeConfig();
    let subs: Awaited<ReturnType<ReturnType<typeof createStripeClient>["subscriptions"]["list"]>>["data"] = [];
    if (customerId) {
      const stripe = createStripeClient(config.secretKey);
      const first = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
      if (first.has_more) throw new Error("Subscription list exceeds safe eligibility limit");
      subs = first.data;
      if (subs.some((s) => s.customer !== customerId || (s.metadata.user_id !== undefined && s.metadata.user_id !== user.id))) throw new Error("Subscription owner mismatch");
    }
    const billable = subs.filter((s) => ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"].includes(s.status));
    const catalogMatches = await Promise.all(billable.map(async (s) => {
      if (s.items.data.length !== 1) return false;
      const item = s.items.data[0];
      const interval = item.price.recurring?.interval === "month" ? "monthly" : item.price.recurring?.interval === "year" ? "annual" : null;
      const product = s.metadata.product_id;
      try {
        const plan = readEditableCurrentPlan(s, config);
        if (plan.priceId !== item.price.id || plan.interval !== interval || plan.productId !== product || plan.quantity !== item.quantity) return false;
      } catch { return false; }
      const { data, error } = await admin.rpc("get_checkout_price_catalog", { p_price_id: item.price.id });
      if (error || !Array.isArray(data)) return false;
      return data.filter((row) => row.price_id === item.price.id && row.product_id === product && row.billing_interval === interval && (row.active === true || row.grandfathered === true)).length === 1;
    }));
    const result = classifyLifetimeEligibility({
      entitlements: access.rows as Array<{ source?: unknown; status?: unknown }>, lifetimeOwned: purchases.data.length > 0,
      subscriptions: billable, customerOwned: Boolean(customerId), catalogMatches,
    });
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (error) {
    console.error("Lifetime eligibility lookup failed", error instanceof Error ? { name: error.name } : { type: typeof error });
    return NextResponse.json({ error: "Lifetime eligibility is temporarily unavailable" }, { status: 503, headers: NO_STORE });
  }
}
