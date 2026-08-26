import { getBillingPlan, type StripeConfig } from "@/lib/stripe-config";
import type { ProductId } from "@/lib/access";

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
    successUrl: string;
    cancelUrl: string;
  }): Promise<string>;
};

export async function startCheckout(
  input: { interval: unknown; productId: unknown; user: CheckoutUser; config: StripeConfig },
  dependencies: CheckoutDependencies,
): Promise<string> {
  const plan = getBillingPlan(input.productId, input.interval, input.config);
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
    successUrl: `${input.config.siteUrl}/account?checkout=success`,
    cancelUrl: `${input.config.siteUrl}/pricing?checkout=cancelled`,
  });
}
