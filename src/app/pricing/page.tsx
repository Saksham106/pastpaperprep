import type { Metadata } from "next";
import { PricingContent } from "@/components/PricingContent";
import { hasBankAccess, type ProductId } from "@/lib/access";
import { getBillingBanks, getEntitlementBanks, type BankSlug } from "@/lib/banks";
import { CURRENT_ENTITLEMENT_FILTERS } from "@/lib/current-entitlements";
import { normalizeEntitlements } from "@/lib/entitlements";
import { requireEntitlementRows } from "@/lib/entitlement-query";
import { SOCIAL_IMAGE } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Choose one PastPaperPrep question bank across IGCSE and IB Maths, Biology, Chemistry, Physics and Economics; build an exact bundle of two to five, or unlock every current bank.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "PastPaperPrep Pricing",
    description: "Choose one bank, build your exact bundle, or get All Access across every PastPaperPrep question bank.",
    url: "/pricing",
    type: "website",
    images: [SOCIAL_IMAGE],
  },
};

const PURCHASABLE_PRODUCTS: readonly ProductId[] = [
  "bank_igcse", "bank_igcse_additional", "bank_ib_hl", "bank_ib_sl", "bank_ib_ai_hl", "bank_ib_ai_sl",
  "bank_ib_chemistry_hl", "bank_ib_chemistry_sl", "bank_ib_physics_hl", "bank_ib_physics_sl", "bank_ib_biology_hl", "bank_ib_biology_sl", "bank_igcse_biology_0610", "bank_igcse_economics_0455", "bank_igcse_chemistry_0620", "bank_igcse_physics_0625", "bank_igcse_coordinated_sciences_0654", "bundle_igcse", "bundle_ib_aa", "bundle_ib_ai", "bundle_ib_chemistry", "bundle_ib_physics", "bundle_ib_biology", "bundle_all", "bundle_custom",
];

function purchaseBanks(value: string | undefined): BankSlug[] | undefined {
  if (!value) return undefined;
  const ids = value.split(",");
  const billingBanks = getBillingBanks();
  const selected = ids.filter((id, index) => ids.indexOf(id) === index && billingBanks.some((bank) => bank.slug === id));
  return selected.length ? selected as BankSlug[] : undefined;
}

function purchaseProduct(value: string | undefined): ProductId | undefined {
  return PURCHASABLE_PRODUCTS.find((productId) => productId === value);
}

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ interval?: string; product?: string; banks?: string }> }) {
  const params = await searchParams;
  const billingBanks = getBillingBanks();
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  let hasPaidAccess = false;
  let ownedBankIds: BankSlug[] = [];
  let currentPlanNames: string[] = [];

  if (userId) {
    const result = await supabase
      .from("entitlements")
      .select("product_id, selected_bank_ids, status, starts_at, expires_at, products(name)")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .lte("starts_at", CURRENT_ENTITLEMENT_FILTERS.startsAt)
      .or(CURRENT_ENTITLEMENT_FILTERS.expiresAt);
    const entitlements = normalizeEntitlements(requireEntitlementRows(result));
    ownedBankIds = billingBanks.filter(({ slug }) => hasBankAccess(slug, entitlements)).map(({ slug }) => slug);
    hasPaidAccess = getEntitlementBanks().some(({ slug }) => hasBankAccess(slug, entitlements));
    currentPlanNames = Array.from(new Set((result.data ?? []).flatMap((row) => {
      const product = Array.isArray(row.products) ? row.products[0] : row.products;
      return product?.name ? [product.name] : [];
    })));
  }

  return <PricingContent
    authenticated={Boolean(userId)}
    hasPaidAccess={hasPaidAccess}
    ownedBankIds={ownedBankIds}
    currentPlanNames={currentPlanNames}
    initialInterval={params.interval === "annual" ? "annual" : "monthly"}
    initialProductId={purchaseProduct(params.product)}
    initialBankIds={purchaseBanks(params.banks)}
    availableBanks={billingBanks}
  />;
}
