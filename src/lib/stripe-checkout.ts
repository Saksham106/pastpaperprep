import { getBillingPlan, type StripeConfig } from "@/lib/stripe-config";

type CheckoutUser = { id: string; email: string };

type CheckoutDependencies = {
  findCustomerId(userId: string): Promise<string | null>;
  createCustomer(user: CheckoutUser): Promise<string>;
  saveCustomer(userId: string, customerId: string): Promise<void>;
  createSession(input: {
    customerId: string;
    priceId: string;
    userId: string;
    interval: "monthly" | "annual";
    successUrl: string;
    cancelUrl: string;
  }): Promise<string>;
};

export async function startCheckout(
  input: { interval: unknown; user: CheckoutUser; config: StripeConfig },
  dependencies: CheckoutDependencies,
): Promise<string> {
  const plan = getBillingPlan(input.interval, input.config);
  let customerId = await dependencies.findCustomerId(input.user.id);

  if (!customerId) {
    customerId = await dependencies.createCustomer(input.user);
    await dependencies.saveCustomer(input.user.id, customerId);
  }

  return dependencies.createSession({
    customerId,
    priceId: plan.priceId,
    userId: input.user.id,
    interval: plan.interval,
    successUrl: `${input.config.siteUrl}/account?checkout=success`,
    cancelUrl: `${input.config.siteUrl}/pricing?checkout=cancelled`,
  });
}
