import { getBillingPlan, type StripeConfig } from "@/lib/stripe-config";
import type { ProductId } from "@/lib/access";
import type { BankSlug } from "@/lib/banks";

type CheckoutUser = { id: string; email: string };

type CheckoutDependencies = {
  findCustomerId(userId: string): Promise<string | null>;
  createCustomer(user: CheckoutUser): Promise<string>;
  saveCustomer(userId: string, customerId: string): Promise<string>;
  createSession(input: {
    customerId: string;
    priceId: string;
    userId: string;
    interval: "monthly" | "annual";
    productId: ProductId;
    quantity?: number;
    selectedBankIds?: readonly BankSlug[];
    successUrl: string;
    cancelUrl: string;
  }): Promise<string>;
};

/**
 * Stripe's back link returns the buyer to the plan they picked. The pricing
 * page restores `interval`, `product` and `banks` the same way it does after sign-in.
 */
export function checkoutCancelUrl(siteUrl: string, selection: { interval: "monthly" | "annual"; productId: string; bankIds?: readonly string[] }): string {
  const params = new URLSearchParams({ interval: selection.interval, product: selection.productId });
  if (selection.bankIds?.length) params.set("banks", [...selection.bankIds].sort().join(","));
  params.set("checkout", "cancelled");
  return `${siteUrl}/pricing?${params}`;
}

/** Stripe fills in `{CHECKOUT_SESSION_ID}`, so the account page can read back exactly what was bought. */
export function lifetimeCheckoutSuccessUrl(siteUrl: string): string {
  return `${siteUrl}/account?checkout=lifetime-pending&session_id={CHECKOUT_SESSION_ID}`;
}

export function lifetimeCheckoutCancelUrl(siteUrl: string): string {
  return `${siteUrl}/pricing?plan=lifetime&checkout=cancelled`;
}

export async function startCheckout(
  input: { interval: unknown; productId: unknown; selectedBankIds?: unknown; user: CheckoutUser; config: StripeConfig; environment?: Record<string, string | undefined> },
  dependencies: CheckoutDependencies,
): Promise<string> {
  const plan = getBillingPlan(input.productId, input.interval, input.config, input.selectedBankIds, input.environment);
  let customerId = await dependencies.findCustomerId(input.user.id);

  if (!customerId) {
    customerId = await dependencies.createCustomer(input.user);
    customerId = await dependencies.saveCustomer(input.user.id, customerId);
  }

  return dependencies.createSession({
    customerId,
    priceId: plan.priceId,
    userId: input.user.id,
    interval: plan.interval,
    productId: plan.productId as ProductId,
    ...( "quantity" in plan ? { quantity: plan.quantity } : {}),
    ...( "selectedBankIds" in plan && plan.selectedBankIds ? { selectedBankIds: plan.selectedBankIds } : {}),
    successUrl: `${input.config.siteUrl}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    // getBillingPlan has validated the request, so these are known product and bank ids.
    // Six or more banks bill as All Access but return to the builder with every pick.
    cancelUrl: checkoutCancelUrl(input.config.siteUrl, {
      interval: plan.interval,
      productId: input.productId as string,
      bankIds: input.productId === "bundle_custom" && Array.isArray(input.selectedBankIds) ? input.selectedBankIds as string[] : undefined,
    }),
  });
}
