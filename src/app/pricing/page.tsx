import type { Metadata } from "next";
import { PricingContent } from "@/components/PricingContent";
import { hasBankAccess, type ProductId } from "@/lib/access";
import { BANKS } from "@/lib/banks";
import { CURRENT_ENTITLEMENT_FILTERS } from "@/lib/current-entitlements";
import { normalizeEntitlements } from "@/lib/entitlements";
import { requireEntitlementRows } from "@/lib/entitlement-query";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Compare PastPaperPrep plans for Cambridge IGCSE, IB Mathematics, IB Chemistry, IB Physics, and IB Biology topical question banks, worked answers, and printable PDF revision sets.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "PastPaperPrep Pricing",
    description: "Choose one question bank, a subject pair, or all twelve IGCSE, IB Mathematics, IB Chemistry, IB Physics, and IB Biology banks.",
    url: "/pricing",
    type: "website",
  },
};

const PURCHASABLE_PRODUCTS: readonly ProductId[] = [
  "bank_igcse", "bank_igcse_additional", "bank_ib_hl", "bank_ib_sl", "bank_ib_ai_hl", "bank_ib_ai_sl",
  "bank_ib_chemistry_hl", "bank_ib_chemistry_sl", "bank_ib_physics_hl", "bank_ib_physics_sl", "bank_ib_biology_hl", "bank_ib_biology_sl", "bundle_igcse", "bundle_ib_aa", "bundle_ib_ai", "bundle_ib_chemistry", "bundle_ib_physics", "bundle_ib_biology", "bundle_all",
];

function purchaseProduct(value: string | undefined): ProductId | undefined {
  return PURCHASABLE_PRODUCTS.find((productId) => productId === value);
}

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ interval?: string; product?: string }> }) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  let hasPaidAccess = false;
  let currentPlanNames: string[] = [];

  if (userId) {
    const result = await supabase
      .from("entitlements")
      .select("product_id, status, starts_at, expires_at, products(name)")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .lte("starts_at", CURRENT_ENTITLEMENT_FILTERS.startsAt)
      .or(CURRENT_ENTITLEMENT_FILTERS.expiresAt);
    const entitlements = normalizeEntitlements(requireEntitlementRows(result));
    hasPaidAccess = BANKS.some(({ slug }) => hasBankAccess(slug, entitlements));
    currentPlanNames = Array.from(new Set((result.data ?? []).flatMap((row) => {
      const product = Array.isArray(row.products) ? row.products[0] : row.products;
      return product?.name ? [product.name] : [];
    })));
  }

  return <PricingContent
    authenticated={Boolean(userId)}
    hasPaidAccess={hasPaidAccess}
    currentPlanNames={currentPlanNames}
    initialInterval={params.interval === "annual" ? "annual" : "monthly"}
    initialProductId={purchaseProduct(params.product)}
  />;
}
