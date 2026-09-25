import { describe, expect, it } from "vitest";
import { BANK_PRODUCTS } from "@/lib/access";
import { getBillingBanks } from "@/lib/banks";
import { resolveAccountPlanTarget, readEditableCurrentPlan, type AccountPlanSubscription } from "@/lib/account-plan-target";
import type { StripeConfig } from "@/lib/stripe-config";

const config: StripeConfig = {
  secretKey: "sk_test_x", webhookSecret: "whsec_x", monthlyPriceId: "price_found_m", annualPriceId: "price_found_a",
  customMonthlyPriceId: "price_custom_m", customAnnualPriceId: "price_custom_a",
  singleMonthlyPriceId: "price_single_m", singleAnnualPriceId: "price_single_a",
  pairMonthlyPriceId: "price_pair_m", pairAnnualPriceId: "price_pair_a",
  allMonthlyPriceId: "price_all_m", allAnnualPriceId: "price_all_a", siteUrl: "https://pastpaperprep.com",
};
const env = {};
const available = getBillingBanks(env).map(({ slug }) => slug);
const one = available.find((id) => BANK_PRODUCTS[id])!;
const two = available.filter((id) => BANK_PRODUCTS[id]).slice(0, 2);
const item = (price: string, quantity: number) => ({ id: "si_1", price: { id: price, recurring: { interval: "month" } }, quantity });
const subscription = (product: string, price: string, quantity: number, metadata: Record<string, string> = {}) => ({
  status: "active", items: { data: [item(price, quantity)] }, metadata: { product_id: product, billing_interval: "monthly", price_id: price, ...metadata },
  schedule: null, cancel_at_period_end: false, cancel_at: null,
}) satisfies AccountPlanSubscription;

describe("resolveAccountPlanTarget", () => {
  it("maps one selected bank to its fixed product", () => {
    expect(resolveAccountPlanTarget({ selectedBankIds: [one], allAccess: false, interval: "monthly" }, config, env)).toEqual({
      productId: BANK_PRODUCTS[one], priceId: "price_single_m", quantity: 1, selectedBankIds: [one], interval: "monthly",
    });
  });
  it("maps two through five banks to the custom graduated price", () => {
    expect(resolveAccountPlanTarget({ selectedBankIds: two, allAccess: false, interval: "annual" }, config, env)).toMatchObject({
      productId: "bundle_custom", priceId: "price_custom_a", quantity: 2, selectedBankIds: [...two].sort(),
    });
  });
  it("maps all access to All Access", () => {
    expect(resolveAccountPlanTarget({ selectedBankIds: [], allAccess: true, interval: "monthly" }, config, env)).toEqual({
      productId: "bundle_all", priceId: "price_all_m", quantity: 1, interval: "monthly",
    });
  });
  it("rejects duplicate, unknown, gated, conflict, interval and malformed input", () => {
    for (const input of [
      { selectedBankIds: [one, one], allAccess: false, interval: "monthly" },
      { selectedBankIds: ["not-a-bank"], allAccess: false, interval: "monthly" },
      { selectedBankIds: ["igcse-biology-0610"], allAccess: false, interval: "monthly" },
      { selectedBankIds: [one], allAccess: true, interval: "monthly" },
      { selectedBankIds: [one], allAccess: false, interval: "weekly" },
      { selectedBankIds: null, allAccess: false, interval: "monthly" },
    ]) expect(() => resolveAccountPlanTarget(input as never, config, env)).toThrow();
  });
});

describe("readEditableCurrentPlan", () => {
  it("accepts an exact currently configured one-bank subscription", () => {
    const current = subscription(BANK_PRODUCTS[one]!, "price_single_m", 1);
    const result = readEditableCurrentPlan({ ...current, metadata: { product_id: BANK_PRODUCTS[one]! } }, config, env);
    expect(result).toEqual({ productId: BANK_PRODUCTS[one], priceId: "price_single_m", quantity: 1, selectedBankIds: [one], interval: "monthly" });
  });
  it("accepts custom bundle only when metadata selection and item quantity match", () => {
    expect(readEditableCurrentPlan(subscription("bundle_custom", "price_custom_m", 2, { selected_bank_ids: JSON.stringify(two) }), config, env)).toMatchObject({ productId: "bundle_custom", quantity: 2, selectedBankIds: [...two].sort() });
    expect(() => readEditableCurrentPlan(subscription("bundle_custom", "price_custom_m", 3, { selected_bank_ids: JSON.stringify(two) }), config, env)).toThrow();
  });
  it("accepts All Access without bank selection metadata", () => {
    expect(readEditableCurrentPlan({ ...subscription("bundle_all", "price_all_m", 1), metadata: { product_id: "bundle_all" } }, config, env)).toMatchObject({ productId: "bundle_all", interval: "monthly" });
  });
  it("rejects multiple items, legacy pair/grandfathered price, malformed metadata and scheduled/canceling plans", () => {
    const base = subscription("bundle_custom", "price_custom_m", 2, { selected_bank_ids: JSON.stringify(two) });
    const cases: AccountPlanSubscription[] = [
      { ...base, items: { data: [...base.items.data, item("price_custom_m", 2)] } },
      subscription("bundle_igcse", "price_pair_m", 2),
      subscription("bundle_custom", "price_old", 2, { selected_bank_ids: JSON.stringify(two) }),
      subscription("bundle_custom", "price_custom_m", 2),
      { ...base, schedule: "sub_sched_1" },
      { ...base, cancel_at_period_end: true },
      { ...base, cancel_at: 123 },
      { ...base, metadata: { ...base.metadata, price_id: "price_wrong" } },
      { ...base, metadata: { ...base.metadata, billing_interval: "annual" } },
    ];
    for (const value of cases) expect(() => readEditableCurrentPlan(value, config, env)).toThrow();
  });
});
