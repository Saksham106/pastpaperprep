import { PricingContent } from "@/components/PricingContent";
import { hasBankAccess } from "@/lib/access";
import { BANKS } from "@/lib/banks";
import { CURRENT_ENTITLEMENT_FILTERS } from "@/lib/current-entitlements";
import { normalizeEntitlements } from "@/lib/entitlements";
import { requireEntitlementRows } from "@/lib/entitlement-query";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Pricing" };

export default async function PricingPage() {
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

  return <PricingContent authenticated={Boolean(userId)} hasPaidAccess={hasPaidAccess} currentPlanNames={currentPlanNames} />;
}
