import { NextResponse } from "next/server";
import { withFailureReporting } from "@/lib/route-failure-reporting";
import { findPaymentFailedNotice, type SubscriptionLike } from "@/lib/payment-failed-notice";
import { createStripeClient } from "@/lib/stripe";
import { getStripeConfig, isStripeBillingEnabled } from "@/lib/stripe-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

/**
 * Read-only: is the signed-in account's latest renewal unpaid? Reads Stripe live, because the
 * synced subscription row stores a past-due renewal as "active" during the grace window.
 * Accounts with no Stripe customer return early without a Stripe call.
 */
async function handleGET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401, headers: NO_STORE });
  if (!isStripeBillingEnabled()) return NextResponse.json({ notice: null }, { headers: NO_STORE });

  try {
    const admin = createAdminClient();
    const { data: customerId, error } = await admin.rpc("get_stripe_customer_id", { p_user_id: user.id });
    if (error) throw error;
    if (typeof customerId !== "string" || !customerId) return NextResponse.json({ notice: null }, { headers: NO_STORE });

    const stripe = createStripeClient(getStripeConfig().secretKey);
    const lapsed = await Promise.all((["past_due", "unpaid"] as const).map((status) =>
      stripe.subscriptions.list({ customer: customerId, status, limit: 10, expand: ["data.latest_invoice"] })));
    const subscriptions = lapsed.flatMap((page) => page.data) as unknown as SubscriptionLike[];
    const notice = findPaymentFailedNotice(subscriptions, { customerId, userId: user.id, nowSeconds: Math.floor(Date.now() / 1000) });
    return NextResponse.json({ notice }, { headers: NO_STORE });
  } catch (error) {
    console.error("Payment notice read failed", error instanceof Error ? { name: error.name } : { type: typeof error });
    return NextResponse.json({ error: "Payment status is temporarily unavailable" }, { status: 503, headers: NO_STORE });
  }
}

export const GET = withFailureReporting("/api/billing/payment-notice", handleGET);
