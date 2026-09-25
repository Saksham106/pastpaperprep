import { NextResponse } from "next/server";
import { createStripeClient } from "@/lib/stripe";
import { getStripeConfig, isStripeBillingEnabled } from "@/lib/stripe-config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { describeSubscriptionBanks, recurringPriceSubtotal } from "@/lib/account-billing-view";
import { readEditableCurrentPlan } from "@/lib/account-plan-target";
import { getBillingBanks } from "@/lib/banks";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401, headers: NO_STORE });
  if (!isStripeBillingEnabled()) return NextResponse.json({ error: "Billing is not available yet" }, { status: 503, headers: NO_STORE });

  try {
    const admin = createAdminClient();
    const { data: customerId, error } = await admin.rpc("get_stripe_customer_id", { p_user_id: user.id });
    if (error) throw error;
    if (typeof customerId !== "string" || !customerId) return NextResponse.json({ error: "No billing account found" }, { status: 404, headers: NO_STORE });
    const stripe = createStripeClient(getStripeConfig().secretKey);
    const [subscriptions, invoices, customer] = await Promise.all([
      stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 }),
      stripe.invoices.list({ customer: customerId, limit: 20 }),
      stripe.customers.retrieve(customerId, { expand: ["invoice_settings.default_payment_method"] }),
    ]);
    if (subscriptions.has_more) return NextResponse.json({ error: "Subscription list exceeds safe display limit" }, { status: 503, headers: NO_STORE });
    if (customer.deleted || customer.id !== customerId || invoices.data.some((invoice) => invoice.customer !== customerId) || subscriptions.data.some((subscription) =>
      subscription.customer !== customerId ||
      // stripe_customers.customer_id is UNIQUE. Its service-role user mapping and
      // exact Stripe customer match establish ownership for older subscriptions
      // without user_id; an explicit conflicting owner is never accepted.
      (subscription.metadata.user_id !== undefined && subscription.metadata.user_id !== user.id)
    )) throw new Error("Stripe billing owner mismatch");
    const paymentMethod = customer.invoice_settings.default_payment_method;
    const method = typeof paymentMethod === "object" && paymentMethod !== null ? paymentMethod : null;
    const methodRecord = method as (typeof method & { type?: string; us_bank_account?: { bank_name?: string | null; last4?: string | null }; card?: { brand?: string; last4?: string; exp_month?: number; exp_year?: number } }) | null;
    const priceCache = new Map<string, ReturnType<typeof stripe.prices.retrieve>>();
    const editorEnabled = process.env.STRIPE_PLAN_EDITOR_ENABLED === "true";
    const detailedSubscriptions = await Promise.all(subscriptions.data.map(async (subscription) => {
      let scheduledPlan: { id: string; effectiveAt: string; interval: string; bankSelection: ReturnType<typeof describeSubscriptionBanks> } | null = null;
      const scheduleId = typeof subscription.schedule === "string" ? subscription.schedule : subscription.schedule?.id;
      if (editorEnabled && scheduleId && subscription.status === "active" && subscription.items.data.length === 1) {
        try {
          const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
          const [first, next] = schedule.phases;
          const item = subscription.items.data[0];
          const currentPrice = item.price.id;
          const firstPrice = first?.items.length === 1 ? first.items[0].price : null;
          const nextPrice = next?.items.length === 1 ? next.items[0].price : null;
          const firstPriceId = typeof firstPrice === "string" ? firstPrice : firstPrice?.id;
          const nextPriceId = typeof nextPrice === "string" ? nextPrice : nextPrice?.id;
          const interval = next?.metadata?.billing_interval;
          const selection = next ? describeSubscriptionBanks(next.metadata?.product_id ?? null, next.metadata?.selected_bank_ids ?? null) : { kind: "unknown" as const };
          if (schedule.id === scheduleId && schedule.status === "active" && schedule.subscription === subscription.id && schedule.customer === customerId &&
            schedule.metadata?.owner === "pastpaperprep" && schedule.metadata.user_id === user.id && schedule.metadata.subscription_id === subscription.id &&
            /^[0-9a-f-]{36}$/i.test(schedule.metadata.ownership_id ?? "") && schedule.phases.length === 2 &&
            schedule.current_phase?.start_date === first?.start_date && schedule.current_phase.end_date === first?.end_date &&
            first?.start_date === item.current_period_start && first.end_date === item.current_period_end &&
            firstPriceId === currentPrice && first.items[0]?.quantity === item.quantity &&
            Object.entries(subscription.metadata).every(([key, value]) => first.metadata?.[key] === value) &&
            next?.start_date === first.end_date && nextPriceId === next?.metadata?.price_id && (next?.items[0]?.quantity ?? 0) > 0 &&
            next?.metadata?.user_id === user.id && (interval === "monthly" || interval === "annual") && selection.kind !== "unknown") {
            scheduledPlan = { id: scheduleId, effectiveAt: new Date(first.end_date * 1000).toISOString(), interval, bankSelection: selection };
          }
        } catch { /* An unverified provider schedule can only be displayed as a generic warning. */ }
      }
      return ({
      id: subscription.id, status: subscription.status, cancelAtPeriodEnd: subscription.cancel_at_period_end,
      pendingUpdate: Boolean(subscription.pending_update), scheduledChange: Boolean(subscription.schedule),
      cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null,
      bankSelection: describeSubscriptionBanks(subscription.metadata.product_id ?? null, subscription.metadata.selected_bank_ids ?? null),
      items: await Promise.all(subscription.items.data.map(async (item) => {
        let price = item.price;
        if (price.billing_scheme === "tiered" && !price.tiers) {
          let request = priceCache.get(price.id);
          if (!request) {
            request = stripe.prices.retrieve(price.id, { expand: ["tiers"] });
            priceCache.set(price.id, request);
          }
          price = await request;
          if (price.id !== item.price.id) throw new Error("Stripe price identity mismatch");
        }
        return {
          id: item.id, quantity: item.quantity,
          price: { id: item.price.id, unitAmount: item.price.unit_amount, currency: item.price.currency, interval: item.price.recurring?.interval ?? null, intervalCount: item.price.recurring?.interval_count ?? null },
          recurringSubtotalCents: recurringPriceSubtotal(price, item.quantity ?? 0),
          currentPeriodStart: item.current_period_start ? new Date(item.current_period_start * 1000).toISOString() : null,
          currentPeriodEnd: item.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
        };
      })),
      scheduledPlan,
      metadata: { productId: subscription.metadata.product_id ?? null, selectedBankIds: subscription.metadata.selected_bank_ids ?? null },
      });
    }));
    const active = subscriptions.data.filter((subscription) => subscription.status === "active");
    let editable = false;
    if (editorEnabled && active.length === 1 && subscriptions.data.every((subscription) =>
      subscription === active[0] || subscription.status === "canceled" || subscription.status === "incomplete_expired"
    )) {
      const candidate = active[0];
      const periodEnd = candidate.items.data.length === 1 ? candidate.items.data[0].current_period_end : null;
      // Read-only display tolerates legacy metadata; every mutation still needs
      // an explicit owner and a future, unambiguous period boundary.
      if (candidate.metadata.user_id === user.id && typeof periodEnd === "number" && Number.isSafeInteger(periodEnd) && periodEnd > Math.floor(Date.now() / 1000) &&
        (!candidate.cancel_at || candidate.cancel_at_period_end === true && candidate.cancel_at === periodEnd)) {
        try {
          readEditableCurrentPlan({ ...candidate, cancel_at: null, cancel_at_period_end: false }, getStripeConfig());
          editable = true;
        } catch { /* Legacy prices and unsupported subscription structures stay read-only. */ }
      }
    }
    return NextResponse.json({
      subscriptions: detailedSubscriptions,
      invoices: invoices.data.map((invoice) => ({ id: invoice.id, status: invoice.status, amountDue: invoice.amount_due, amountPaid: invoice.amount_paid, currency: invoice.currency, created: new Date(invoice.created * 1000).toISOString(), periodStart: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null, periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null, hostedInvoiceUrl: invoice.hosted_invoice_url, invoicePdf: invoice.invoice_pdf })),
      invoicesHasMore: invoices.has_more,
      paymentMethod: methodRecord ? { type: methodRecord.type ?? null, bankName: methodRecord.us_bank_account?.bank_name ?? null, last4: methodRecord.us_bank_account?.last4 ?? methodRecord.card?.last4 ?? null, cardBrand: methodRecord.card?.brand ?? null, cardExpiryMonth: methodRecord.card?.exp_month ?? null, cardExpiryYear: methodRecord.card?.exp_year ?? null } : null,
      bankOptions: editorEnabled ? getBillingBanks().map(({ slug, shortName }) => ({ slug, name: shortName })) : [],
      management: { editable, reason: editable ? null : "Plan editing is unavailable for this billing arrangement." },
    }, { headers: NO_STORE });
  } catch (error) {
    console.error("Stripe subscription read failed", error instanceof Error ? { name: error.name } : { type: typeof error });
    return NextResponse.json({ error: "Subscription details are temporarily unavailable" }, { status: 503, headers: NO_STORE });
  }
}
