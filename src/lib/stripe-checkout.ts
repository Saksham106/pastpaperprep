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
    successUrl: `${input.config.siteUrl}/account?checkout=success`,
    cancelUrl: `${input.config.siteUrl}/pricing?checkout=cancelled`,
  });
}
