import "server-only";
import type Stripe from "stripe";
import { annualSaleCents, annualSaleCoupon } from "@/lib/annual-sale";
import { resolveAnnualSaleCoupon } from "@/lib/annual-sale-checkout";
import { readEditableCurrentPlan, resolveAccountPlanTarget } from "@/lib/account-plan-target";
import { recurringPriceSubtotal } from "@/lib/account-billing-view";
import type { StripeConfig } from "@/lib/stripe-config";

/** A switch this account cannot make right now (shown to the user as a 409 with the message). */
export class AnnualSwitchConflict extends Error {}

export type AnnualSwitchQuote = {
  subscription: Stripe.Subscription;
  item: Stripe.SubscriptionItem;
  current: ReturnType<typeof readEditableCurrentPlan>;
  target: ReturnType<typeof resolveAccountPlanTarget>;
  couponId: string;
  percentOff: number;
  prorationDate: number;
  amountDueTodayCents: number;
  creditCents: number;
  taxesCents: number;
  /** Customer balance (e.g. referral credit) Stripe takes off today's charge. */
  accountCreditCents: number;
  firstYearCents: number;
  renewsAtCents: number;
  currency: "usd";
};

type Admin = { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };

/**
 * Monthly → annual, same banks, during the annual sale: charge the first year at the tier's sale
 * price today, less credit for the unused part of the current month.
 *
 * Fails closed: wrong owner, not monthly, not an active standard price, sale over, an open invoice,
 * or a Stripe estimate that is not exactly the discounted annual line minus a credit.
 */
export async function createAnnualSwitchQuote(args: {
  stripe: Stripe;
  admin: Admin;
  userId: string;
  customerId: string;
  subscription: Stripe.Subscription;
  config: StripeConfig;
  now: number;
  prorationDate?: number;
  environment?: Record<string, string | undefined>;
}): Promise<AnnualSwitchQuote> {
  const { stripe, admin, userId, customerId, subscription, config, now } = args;
  const environment = args.environment ?? process.env;
  const owner = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  if (owner !== customerId || subscription.metadata?.user_id !== userId) throw new AnnualSwitchConflict("Stripe billing owner mismatch");
  const current = readEditableCurrentPlan(subscription, config, environment);
  if (current.interval !== "monthly") throw new AnnualSwitchConflict("This plan is already billed annually");
  // A coupon already waiting on this plan (e.g. a retention offer) would be replaced; don't drop it silently.
  if (Array.isArray(subscription.discounts) && subscription.discounts.length) throw new AnnualSwitchConflict("This plan already has a discount. Email hello@pastpaperprep.com to switch to annual.");
  const target = resolveAccountPlanTarget({
    selectedBankIds: current.productId === "bundle_all" ? [] : current.selectedBankIds ?? [],
    allAccess: current.productId === "bundle_all",
    interval: "annual",
  }, config, environment);
  if (target.productId !== current.productId || target.quantity !== current.quantity) throw new AnnualSwitchConflict("Annual switch must keep the same banks");
  for (const plan of [current, target]) {
    const { data: rows, error } = await admin.rpc("get_checkout_price_catalog", { p_price_id: plan.priceId });
    if (error) throw error;
    if (!Array.isArray(rows) || !rows.some((row) => row.price_id === plan.priceId && row.product_id === plan.productId && row.billing_interval === plan.interval && row.active === true && row.grandfathered === false)) {
      throw new AnnualSwitchConflict("Current or annual price is not an active standard plan");
    }
  }

  const bankCount = target.productId === "bundle_custom" ? target.quantity : undefined;
  const sale = annualSaleCoupon("annual", target.productId, bankCount, now, environment);
  // Throws AnnualSaleUnavailableError for a missing or mismatched coupon; the route maps it to 503.
  const couponId = await resolveAnnualSaleCoupon(stripe as never, "annual", target.productId, bankCount, now, environment);
  if (!sale || !couponId) throw new AnnualSwitchConflict("The annual sale has ended");

  // A draft renewal would still charge a month after the switch; an open one means an unpaid bill.
  const [openInvoices, draftInvoices] = await Promise.all([
    stripe.invoices.list({ customer: customerId, status: "open", limit: 100 }),
    stripe.invoices.list({ customer: customerId, status: "draft", limit: 100 }),
  ]);
  if (openInvoices.has_more || openInvoices.data.length || draftInvoices.has_more || draftInvoices.data.length) throw new AnnualSwitchConflict("A bill on this account is still being processed. Try again in an hour.");

  const annualPrice = await stripe.prices.retrieve(target.priceId, { expand: ["tiers"] });
  if (annualPrice.id !== target.priceId || !annualPrice.active || annualPrice.currency !== "usd" || annualPrice.recurring?.interval !== "year" || annualPrice.recurring?.interval_count !== 1) {
    throw new AnnualSwitchConflict("Annual price does not match the active plan");
  }
  const renewsAtCents = recurringPriceSubtotal(annualPrice, target.quantity);
  if (renewsAtCents === null || renewsAtCents <= 0) throw new AnnualSwitchConflict("Annual rate is unavailable");
  const firstYearCents = annualSaleCents(renewsAtCents, sale.percentOff);

  const item = subscription.items.data[0];
  const prorationDate = args.prorationDate ?? Math.floor(now / 1000);
  const preview = await stripe.invoices.createPreview({
    customer: customerId,
    subscription: subscription.id,
    discounts: [{ coupon: couponId }],
    subscription_details: { items: [{ id: item.id, price: target.priceId, quantity: target.quantity }], proration_date: prorationDate, proration_behavior: "always_invoice" },
  });
  const lines = preview.lines?.data;
  if (!Array.isArray(lines) || lines.length === 0 || preview.lines.has_more
    || lines.some((line) => line.parent?.subscription_item_details?.proration !== true || line.currency !== "usd" || !Number.isSafeInteger(line.amount))) {
    throw new AnnualSwitchConflict("Stripe returned an unsafe or unexpected estimate");
  }
  // Stripe has returned the discounted proration as the line amount; accept a gross amount with
  // discount_amounts too, so either shape is compared on what is actually charged.
  const net = (line: (typeof lines)[number]) => line.amount - (line.discount_amounts ?? []).reduce((sum, discount) => sum + (Number.isSafeInteger(discount.amount) ? discount.amount : Number.NaN), 0);
  const charges = lines.filter((line) => net(line) > 0);
  const creditCents = lines.reduce((sum, line) => sum + (line.amount < 0 ? -line.amount : 0), 0);
  const taxesCents = preview.total_taxes?.reduce((sum, tax) => sum + tax.amount, 0) ?? 0;
  const amount = preview.amount_due;
  // The only positive line is the discounted first year; anything else means the coupon or the change
  // did not apply as advertised, so nothing is offered.
  if (preview.currency !== "usd" || !Number.isSafeInteger(amount) || !Number.isSafeInteger(taxesCents) || amount < 0
    || charges.length !== 1 || net(charges[0]) !== firstYearCents || amount > firstYearCents + taxesCents) {
    throw new AnnualSwitchConflict("Stripe estimate does not match the sale price");
  }
  const accountCreditCents = Math.max(0, firstYearCents - creditCents + taxesCents - amount);
  return {
    subscription, item, current, target, couponId, percentOff: sale.percentOff, prorationDate,
    amountDueTodayCents: amount, creditCents, taxesCents, accountCreditCents, firstYearCents, renewsAtCents, currency: "usd",
  };
}
