import { DashboardContent } from "@/components/DashboardContent";
import { hasBankAccess } from "@/lib/access";
import { getAvailableBanks, type BankSlug } from "@/lib/banks";
import { AccessReadRecovery } from "@/components/AccessReadRecovery";
import { isFutureIssuedJwtError } from "@/lib/access-recovery";
import { captureServerException } from "@/lib/server-error-tracking";
import { fetchAccessEntitlements } from "@/lib/custom-bundle-access";
import type { AccessEntitlement } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { announcementCandidates, newBankSlugs } from "@/lib/announcements";
import { helperConfigured } from "@/lib/helper/config";
import { qualificationIdOfSlug } from "@/lib/qualifications";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  let accessibleBanks: BankSlug[] = [];
  let entitlements: (AccessEntitlement & { source?: unknown })[] = [];

  if (typeof userId === "string") {
    const result = await fetchAccessEntitlements(supabase as never, userId);
    if (result.error) {
      if (isFutureIssuedJwtError(result.error)) {
        captureServerException(new Error("Access verification failed"), {
          route: "/dashboard", route_type: "render", stage: "entitlement",
          storage_provider: "supabase", error_code: "PGRST303", user_id: userId,
        });
        return <AccessReadRecovery retryPath="/dashboard" />;
      }
      throw result.error;
    }
    entitlements = result.rows as typeof entitlements;
    accessibleBanks = getAvailableBanks().filter(({ slug }) => hasBankAccess(slug, entitlements)).map(({ slug }) => slug);
  }

  const banks = getAvailableBanks();
  const now = new Date();
  // All Access, Lifetime and complimentary all-bank grants already include every new bank.
  const allAccess = banks.length > 0 && accessibleBanks.length === banks.length;
  const grants = (row: AccessEntitlement) => banks.some(({ slug }) => hasBankAccess(slug, [row], now));
  // Only a current Stripe subscription can be monthly; Lifetime has nothing to switch.
  const lifetime = entitlements.some((row) => row.productId === "lifetime_all_access" && grants(row));
  const announcements = typeof userId === "string" ? {
    userId,
    candidates: announcementCandidates({ banks, accessible: accessibleBanks, allAccess, now, pepper: helperConfigured() }),
    boards: allAccess ? [] : [...new Set(accessibleBanks.map(qualificationIdOfSlug))],
    annualCheck: !lifetime && entitlements.some((row) => row.source === "stripe" && grants(row)),
  } : undefined;
  return <DashboardContent authenticated={typeof userId === "string"} accessibleBanks={accessibleBanks} availableBanks={banks} newBanks={newBankSlugs({ banks, now })} announcements={announcements} />;
}
