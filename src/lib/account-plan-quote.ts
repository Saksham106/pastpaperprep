import { hasBankAccess } from "@/lib/access";
import { getBillingBanks } from "@/lib/banks";
import { fetchAccessEntitlements } from "@/lib/custom-bundle-access";
import { readEditableCurrentPlan, resolveAccountPlanTarget, type AccountPlanTargetInput } from "@/lib/account-plan-target";
import type Stripe from "stripe";
import type { StripeConfig } from "@/lib/stripe-config";

export class AccountPlanQuoteConflict extends Error {}
export type AccountPlanQuote = {
  subscription: Stripe.Subscription;
  item: Stripe.SubscriptionItem;
  current: ReturnType<typeof readEditableCurrentPlan>;
  target: ReturnType<typeof resolveAccountPlanTarget>;
  targetIds: string[];
  prorationDate: number;
  amountDueTodayCents: number;
  estimatedCreditCents: number;
  estimatedTaxesCents: number;
  currency: "usd";
};

export async function createAccountPlanQuote(args: {
  stripe: Stripe;
  admin: { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };
  supabase: never;
  userId: string;
  customerId: string;
  targetInput: AccountPlanTargetInput;
  config: StripeConfig;
  subscription: Stripe.Subscription;
  prorationDate?: number;
}): Promise<AccountPlanQuote> {
  const { stripe, admin, supabase, userId, customerId, subscription, config } = args;
  const customer = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  if (customer !== customerId || subscription.metadata?.user_id !== userId) throw new AccountPlanQuoteConflict("Stripe billing owner mismatch");
  const current = readEditableCurrentPlan(subscription, config);
  const target = resolveAccountPlanTarget(args.targetInput, config);
  if (current.interval !== target.interval) throw new AccountPlanQuoteConflict("Only same-interval expansions are eligible");
  for (const plan of [current, target]) {
    const { data: rows, error } = await admin.rpc("get_checkout_price_catalog", { p_price_id: plan.priceId });
    if (error) throw error;
    if (!Array.isArray(rows) || !rows.some((row) => row.price_id === plan.priceId && row.product_id === plan.productId && row.billing_interval === plan.interval && row.active === true && row.grandfathered === false)) throw new AccountPlanQuoteConflict("Current or target price is not an active standard plan");
  }
  if (current.productId === "bundle_all") throw new AccountPlanQuoteConflict("All Access cannot be expanded");
  const billingIds = getBillingBanks().map(({ slug }) => slug);
  const currentIds = current.selectedBankIds ?? [];
  const targetIds = target.selectedBankIds ?? billingIds;
  if (!currentIds.every((id) => targetIds.includes(id)) || targetIds.length <= currentIds.length && target.productId !== "bundle_all") throw new AccountPlanQuoteConflict("Target must strictly expand the current plan");
  if (target.productId === "bundle_all" && currentIds.length === billingIds.length) throw new AccountPlanQuoteConflict("Target is not an expansion");
  const openInvoices = await stripe.invoices.list({ customer: customerId, status: "open", limit: 100 });
  if (openInvoices.has_more || openInvoices.data.length) throw new AccountPlanQuoteConflict("Resolve open invoices before changing this subscription");
  const access = await fetchAccessEntitlements(supabase, userId);
  if (access.error) throw access.error;
  for (const grant of access.rows) {
    if (!grant || typeof grant !== "object") continue;
    const row = grant as Parameters<typeof hasBankAccess>[1][number];
    if (row.status === "active" && billingIds.some((id) => hasBankAccess(id, [row]) && !currentIds.includes(id))) throw new AccountPlanQuoteConflict("Manual or overlapping bank access must be resolved first");
  }
  const item = subscription.items.data[0];
  const prorationDate = args.prorationDate ?? Math.floor(Date.now() / 1000);
  const preview = await stripe.invoices.createPreview({ customer: customerId, subscription: subscription.id, subscription_details: { items: [{ id: item.id, price: target.priceId, quantity: target.quantity }], proration_date: prorationDate, proration_behavior: "always_invoice" } });
  const lines = preview.lines?.data;
  if (!Array.isArray(lines) || lines.length === 0 || preview.lines.has_more || lines.some((line) => line.parent?.subscription_item_details?.proration !== true || line.currency !== "usd" || !Number.isSafeInteger(line.amount))) throw new AccountPlanQuoteConflict("Stripe returned an unsafe or unexpected estimate");
  const amount = preview.amount_due;
  const total = preview.total;
  const subtotal = preview.subtotal;
  const taxes = preview.total_taxes?.reduce((sum, tax) => sum + tax.amount, 0) ?? 0;
  const credits = lines.reduce((sum, line) => sum + (line.amount < 0 ? -line.amount : 0), 0);
  if (preview.currency !== "usd" || !Number.isSafeInteger(amount) || !Number.isSafeInteger(total) || !Number.isSafeInteger(subtotal) || !Number.isSafeInteger(taxes) || !Number.isSafeInteger(credits) || amount < 0) throw new AccountPlanQuoteConflict("Stripe returned an unsafe estimate");
  return { subscription, item, current, target, targetIds: [...targetIds].sort(), prorationDate, amountDueTodayCents: amount, estimatedCreditCents: credits, estimatedTaxesCents: taxes, currency: "usd" };
}
