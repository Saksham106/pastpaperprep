import { DashboardContent } from "@/components/DashboardContent";
import { hasBankAccess } from "@/lib/access";
import { getAvailableBanks, type BankSlug } from "@/lib/banks";
import { AccessReadRecovery } from "@/components/AccessReadRecovery";
import { isFutureIssuedJwtError } from "@/lib/access-recovery";
import { captureServerException } from "@/lib/server-error-tracking";
import { fetchAccessEntitlements } from "@/lib/custom-bundle-access";
import type { AccessEntitlement } from "@/lib/access";
import { createClient } from "@/lib/supabase/server";
import { recentNews } from "@/lib/updates";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  let accessibleBanks: BankSlug[] = [];

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
    const entitlements = result.rows as AccessEntitlement[];
    accessibleBanks = getAvailableBanks().filter(({ slug }) => hasBankAccess(slug, entitlements)).map(({ slug }) => slug);
  }

  return <DashboardContent authenticated={typeof userId === "string"} accessibleBanks={accessibleBanks} availableBanks={getAvailableBanks()} news={recentNews(1)[0]} />;
}
