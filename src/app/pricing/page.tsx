import { PricingContent } from "@/components/PricingContent";
import { hasBankAccess } from "@/lib/access";
import { BANKS } from "@/lib/banks";
import { normalizeEntitlements } from "@/lib/entitlements";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Pricing" };

export default async function PricingPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  let hasPaidAccess = false;

  if (userId) {
    const { data } = await supabase
      .from("entitlements")
      .select("product_id, status, starts_at, expires_at")
      .eq("user_id", userId);
    const entitlements = normalizeEntitlements(data ?? []);
    hasPaidAccess = BANKS.every(({ slug }) => hasBankAccess(slug, entitlements));
  }

  return <PricingContent authenticated={Boolean(userId)} hasPaidAccess={hasPaidAccess} />;
}
