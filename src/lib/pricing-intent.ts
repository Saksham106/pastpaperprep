import type { ProductId } from "@/lib/access";
import type { Bank, BankSlug } from "@/lib/banks";
import { isUpgradePlacement, type UpgradePlacement } from "@/lib/upgrade-copy";

/**
 * What a /pricing URL asks for. Parsed in the browser from an allowlist so the page itself can
 * be served from the CDN. These values only preselect UI: checkout re-validates every product,
 * interval and bank on the server.
 */
export type PricingIntent = {
  initialInterval: "monthly" | "annual";
  initialLifetimeSelected: boolean;
  initialProductId?: ProductId;
  initialBankIds?: BankSlug[];
  addOnIntent: boolean;
  source?: UpgradePlacement;
  checkoutStatus?: "cancelled";
};

export const PURCHASABLE_PRODUCTS: readonly ProductId[] = [
  "bank_igcse", "bank_igcse_additional", "bank_ib_hl", "bank_ib_sl", "bank_ib_ai_hl", "bank_ib_ai_sl",
  "bank_ib_chemistry_hl", "bank_ib_chemistry_sl", "bank_ib_physics_hl", "bank_ib_physics_sl", "bank_ib_biology_hl", "bank_ib_biology_sl", "bank_igcse_biology_0610", "bank_igcse_economics_0455", "bank_igcse_chemistry_0620", "bank_igcse_physics_0625", "bank_igcse_coordinated_sciences_0654", "bank_igcse_computer_science_0478", "bank_ib_computer_science_hl", "bank_ib_computer_science_sl", "bank_a_level_maths_9709", "bundle_igcse", "bundle_ib_aa", "bundle_ib_ai", "bundle_ib_chemistry", "bundle_ib_physics", "bundle_ib_biology", "bundle_all", "bundle_custom",
];

function purchaseBanks(value: string | null, availableBanks: readonly Pick<Bank, "slug">[]): BankSlug[] | undefined {
  if (!value) return undefined;
  const ids = value.split(",");
  const selected = ids.filter((id, index) => ids.indexOf(id) === index && availableBanks.some((bank) => bank.slug === id));
  return selected.length ? selected as BankSlug[] : undefined;
}

function purchaseProduct(value: string | null): ProductId | undefined {
  return PURCHASABLE_PRODUCTS.find((productId) => productId === value);
}

export function parsePricingIntent(params: { get(name: string): string | null }, availableBanks: readonly Pick<Bank, "slug">[]): PricingIntent {
  const initialProductId = purchaseProduct(params.get("product"));
  const initialBankIds = purchaseBanks(params.get("banks"), availableBanks);
  const from = params.get("from") ?? undefined;
  return {
    initialInterval: params.get("interval") === "annual" ? "annual" : "monthly",
    initialLifetimeSelected: params.get("plan") === "lifetime",
    initialProductId,
    initialBankIds,
    addOnIntent: Boolean(initialProductId || initialBankIds?.length),
    source: isUpgradePlacement(from) ? from : undefined,
    checkoutStatus: params.get("checkout") === "cancelled" ? "cancelled" : undefined,
  };
}

/**
 * Runs before the pricing markup is parsed. When the URL changes what the first screen shows
 * (annual, Lifetime, a bank or a builder selection), the CDN's default grid is hidden by CSS until
 * the browser renders the requested view, so it never swaps in visibly.
 */
export const PRICING_INTENT_HINT_SCRIPT = `try{var p=new URLSearchParams(location.search);if(p.get("interval")==="annual"||p.get("plan")==="lifetime"||p.has("product")||p.has("banks"))document.documentElement.dataset.pricingIntent="1"}catch(e){}`;
