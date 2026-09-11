import { DashboardContent } from "@/components/DashboardContent";
import { hasBankAccess } from "@/lib/access";
import { getAvailableBanks, type BankSlug } from "@/lib/banks";
import { normalizeEntitlements } from "@/lib/entitlements";
import { requireEntitlementRows } from "@/lib/entitlement-query";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  let accessibleBanks: BankSlug[] = [];

  if (typeof userId === "string") {
    const result = await supabase
      .from("entitlements")
      .select("product_id, selected_bank_ids, status, starts_at, expires_at")
      .eq("user_id", userId);
    const entitlements = normalizeEntitlements(requireEntitlementRows(result));
    accessibleBanks = getAvailableBanks().filter(({ slug }) => hasBankAccess(slug, entitlements)).map(({ slug }) => slug);
  }

  return <DashboardContent authenticated={typeof userId === "string"} accessibleBanks={accessibleBanks} availableBanks={getAvailableBanks()} />;
}
