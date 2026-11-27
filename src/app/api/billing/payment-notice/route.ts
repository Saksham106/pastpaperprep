import { NextResponse } from "next/server";
import { LAPSED_SUBSCRIPTION_STATUSES } from "@/lib/checkout-errors";
import { withFailureReporting } from "@/lib/route-failure-reporting";
import { findPaymentFailedNotice, hasLapsedSubscription, type SubscriptionLike } from "@/lib/payment-failed-notice";
import { createStripeClient } from "@/lib/stripe";
import { getStripeConfig, isStripeBillingEnabled } from "@/lib/stripe-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };
const INVOICE_ID = /^in_[A-Za-z0-9]{8,64}$/;
const MAX_PAGES = 5;

/**
 * Read-only: is the signed-in account's latest renewal unpaid, and would checkout still refuse a
 * purchase? Reads Stripe live, because the synced subscription row stores a past-due renewal as
 * "active" during the grace window. Accounts with no Stripe customer return early without a
 * Stripe call.
 *
 * `?invoice=in_…` also reports whether that exact invoice, under this account's customer, is now
 * paid. The checkout step uses it so "Payment received" is only ever said about a verified payment.
 */
async function handleGET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401, headers: NO_STORE });
  const invoiceParam = new URL(request.url).searchParams.get("invoice");
  if (invoiceParam !== null && !INVOICE_ID.test(invoiceParam)) return NextResponse.json({ error: "Invalid invoice" }, { status: 400, headers: NO_STORE });
  const clear = { notice: null, purchaseBlocked: false, ...(invoiceParam ? { invoicePaid: false } : {}) };
  if (!isStripeBillingEnabled()) return NextResponse.json(clear, { headers: NO_STORE });

  try {
    const admin = createAdminClient();
    const { data: customerId, error } = await admin.rpc("get_stripe_customer_id", { p_user_id: user.id });
    if (error) throw error;
    if (typeof customerId !== "string" || !customerId) return NextResponse.json(clear, { headers: NO_STORE });

    const stripe = createStripeClient(getStripeConfig().secretKey);
    const subscriptions: SubscriptionLike[] = [];
    let startingAfter: string | undefined;
    for (let page = 0; ; page += 1) {
      if (page === MAX_PAGES) throw new Error("Subscription list exceeds safe read limit");
      const result = await stripe.subscriptions.list({
        customer: customerId, status: "all", limit: 100, expand: ["data.latest_invoice"],
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      subscriptions.push(...(result.data as unknown as SubscriptionLike[]));
      if (!result.has_more) break;
      startingAfter = result.data.at(-1)?.id;
      if (!startingAfter) throw new Error("Stripe subscription pagination did not advance");
    }

    let invoicePaid: boolean | undefined;
    if (invoiceParam) {
      try {
        const invoice = await stripe.invoices.retrieve(invoiceParam);
        const invoiceCustomer = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        invoicePaid = invoice.id === invoiceParam && invoiceCustomer === customerId && invoice.status === "paid";
      } catch (cause) {
        // Another account's or a deleted invoice reads as "not paid", never as an error that reveals it.
        if ((cause as { code?: unknown })?.code !== "resource_missing") throw cause;
        invoicePaid = false;
      }
    }

    const notice = findPaymentFailedNotice(subscriptions, { customerId, userId: user.id, nowSeconds: Math.floor(Date.now() / 1000) });
    return NextResponse.json({
      notice,
      purchaseBlocked: hasLapsedSubscription(subscriptions, LAPSED_SUBSCRIPTION_STATUSES),
      ...(invoiceParam ? { invoicePaid } : {}),
    }, { headers: NO_STORE });
  } catch (error) {
    console.error("Payment notice read failed", error instanceof Error ? { name: error.name } : { type: typeof error });
    return NextResponse.json({ error: "Payment status is temporarily unavailable" }, { status: 503, headers: NO_STORE });
  }
}

export const GET = withFailureReporting("/api/billing/payment-notice", handleGET);
