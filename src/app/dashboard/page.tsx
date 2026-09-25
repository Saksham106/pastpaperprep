import { DashboardContent } from "@/components/DashboardContent";
import { hasBankAccess } from "@/lib/access";
import { getAvailableBanks, type BankSlug } from "@/lib/banks";
import { fetchAccessEntitlements } from "@/lib/custom-bundle-access";
import type { AccessEntitlement } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  let accessibleBanks: BankSlug[] = [];

  if (typeof userId === "string") {
    const result = await fetchAccessEntitlements(supabase as never, userId);
    if (result.error) throw result.error;
    const entitlements = result.rows as AccessEntitlement[];
    accessibleBanks = getAvailableBanks().filter(({ slug }) => hasBankAccess(slug, entitlements)).map(({ slug }) => slug);
  }

  return <DashboardContent authenticated={typeof userId === "string"} accessibleBanks={accessibleBanks} availableBanks={getAvailableBanks()} />;
}
