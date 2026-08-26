import { describe, expect, it, vi } from "vitest";
import { startCheckout } from "@/lib/stripe-checkout";
import type { StripeConfig } from "@/lib/stripe-config";

const config: StripeConfig = {
  secretKey: "sk_test_example",
  webhookSecret: "whsec_example",
  monthlyPriceId: "price_monthly",
  annualPriceId: "price_annual",
  singleMonthlyPriceId: "price_single_monthly",
  singleAnnualPriceId: "price_single_annual",
  pairMonthlyPriceId: "price_pair_monthly",
  pairAnnualPriceId: "price_pair_annual",
  allMonthlyPriceId: "price_all_monthly",
  allAnnualPriceId: "price_all_annual",
  siteUrl: "https://pastpaperprep.com",
};

const user = { id: "150a3d0e-4c34-45cc-9748-68252f0fb8f1", email: "student@example.com" };

describe("Stripe checkout orchestration", () => {
  it("creates a server-owned annual subscription for the authenticated user", async () => {
    const dependencies = {
      findCustomerId: vi.fn().mockResolvedValue(null),
      createCustomer: vi.fn().mockResolvedValue("cus_new"),
      saveCustomer: vi.fn().mockResolvedValue("cus_new"),
      createSession: vi.fn().mockResolvedValue("https://checkout.stripe.com/session"),
    };

    const url = await startCheckout({ interval: "annual", productId: "bundle_all", user, config }, dependencies);

    expect(url).toBe("https://checkout.stripe.com/session");
    expect(dependencies.createCustomer).toHaveBeenCalledWith(user);
    expect(dependencies.saveCustomer).toHaveBeenCalledWith(user.id, "cus_new");
    expect(dependencies.createSession).toHaveBeenCalledWith({
      customerId: "cus_new",
      priceId: "price_all_annual",
      userId: user.id,
      interval: "annual",
      productId: "bundle_all",
      successUrl: "https://pastpaperprep.com/account?checkout=success",
      cancelUrl: "https://pastpaperprep.com/pricing?checkout=cancelled",
    });
  });

  it("uses the authoritative customer returned by the durable mapping claim", async () => {
    const dependencies = {
      findCustomerId: vi.fn().mockResolvedValue(null),
      createCustomer: vi.fn().mockResolvedValue("cus_raced"),
      saveCustomer: vi.fn().mockResolvedValue("cus_canonical"),
      createSession: vi.fn().mockResolvedValue("https://checkout.stripe.com/session"),
    };

    await startCheckout({ interval: "monthly", productId: "bank_ib_sl", user, config }, dependencies);

    expect(dependencies.saveCustomer).toHaveBeenCalledWith(user.id, "cus_raced");
    expect(dependencies.createSession).toHaveBeenCalledWith(expect.objectContaining({
      customerId: "cus_canonical",
    }));
  });

  it("reuses an existing Stripe customer and rejects client-supplied price IDs", async () => {
    const dependencies = {
      findCustomerId: vi.fn().mockResolvedValue("cus_existing"),
      createCustomer: vi.fn(),
      saveCustomer: vi.fn(),
      createSession: vi.fn().mockResolvedValue("https://checkout.stripe.com/session"),
    };

    await startCheckout({ interval: "monthly", productId: "bank_ib_sl", user, config }, dependencies);
    expect(dependencies.createCustomer).not.toHaveBeenCalled();
    expect(dependencies.createSession).toHaveBeenCalledWith(expect.objectContaining({ priceId: "price_single_monthly", productId: "bank_ib_sl" }));

    await expect(startCheckout({ interval: "price_annual", productId: "bank_ib_sl", user, config }, dependencies)).rejects.toThrow("Unknown billing interval");
  });
});
