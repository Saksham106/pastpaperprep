const PRICE_ENVIRONMENT_KEYS = {
  foundingMonthly: "STRIPE_FOUNDING_MONTHLY_PRICE_ID",
  foundingAnnual: "STRIPE_FOUNDING_ANNUAL_PRICE_ID",
  customMonthly: "STRIPE_CUSTOM_MONTHLY_PRICE_ID",
  customAnnual: "STRIPE_CUSTOM_ANNUAL_PRICE_ID",
  singleMonthly: "STRIPE_SINGLE_MONTHLY_PRICE_ID",
  singleAnnual: "STRIPE_SINGLE_ANNUAL_PRICE_ID",
  pairMonthly: "STRIPE_PAIR_MONTHLY_PRICE_ID",
  pairAnnual: "STRIPE_PAIR_ANNUAL_PRICE_ID",
  allMonthly: "STRIPE_ALL_MONTHLY_PRICE_ID",
  allAnnual: "STRIPE_ALL_ANNUAL_PRICE_ID",
};

const singleProducts = [
  "bank_igcse", "bank_igcse_additional", "bank_ib_hl", "bank_ib_sl", "bank_ib_ai_hl", "bank_ib_ai_sl",
  "bank_ib_chemistry_hl", "bank_ib_chemistry_sl", "bank_ib_physics_hl", "bank_ib_physics_sl",
  "bank_ib_biology_hl", "bank_ib_biology_sl",
];
const pairProducts = [
  "bundle_igcse", "bundle_ib_aa", "bundle_ib_ai", "bundle_ib_chemistry", "bundle_ib_physics", "bundle_ib_biology",
];

function requiredPrice(key) {
  const environmentKey = PRICE_ENVIRONMENT_KEYS[key];
  const value = process.env[environmentKey];
  if (!value || !/^price_[A-Za-z0-9_]+$/.test(value)) {
    throw new Error(`Missing or invalid ${environmentKey}`);
  }
  return value;
}

function sql(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

const prices = Object.fromEntries(Object.keys(PRICE_ENVIRONMENT_KEYS).map((key) => [key, requiredPrice(key)]));
const rows = [
  [prices.foundingMonthly, "bundle_all", "monthly", true],
  [prices.foundingAnnual, "bundle_all", "annual", true],
  [prices.customMonthly, "bundle_custom", "monthly", false],
  [prices.customAnnual, "bundle_custom", "annual", false],
  ...singleProducts.flatMap((productId) => [
    [prices.singleMonthly, productId, "monthly", true],
    [prices.singleAnnual, productId, "annual", true],
  ]),
  ...pairProducts.flatMap((productId) => [
    [prices.pairMonthly, productId, "monthly", true],
    [prices.pairAnnual, productId, "annual", true],
  ]),
  [prices.allMonthly, "bundle_all", "monthly", false],
  [prices.allAnnual, "bundle_all", "annual", false],
];

const values = rows
  .map(([priceId, productId, interval, grandfathered]) => `  (${sql(priceId)}, ${sql(productId)}, ${sql(interval)}, ${grandfathered ? "true" : "false"}, true)`)
  .join(",\n");

process.stdout.write(`begin;\n\ninsert into public.stripe_price_catalog (price_id, product_id, billing_interval, grandfathered, active)\nvalues\n${values}\non conflict (price_id, product_id, billing_interval) do update\nset grandfathered = excluded.grandfathered, active = excluded.active, updated_at = now();\n\ncommit;\n`);
