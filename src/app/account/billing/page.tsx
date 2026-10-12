import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAccessEntitlements } from "@/lib/custom-bundle-access";
import { hasComplimentaryAllAccess } from "@/lib/complimentary-access";
import { hasBankAccess, type AccessEntitlement } from "@/lib/access";
import { BANKS } from "@/lib/banks";
import { AccountBillingHub, type HubAccess } from "@/components/AccountBillingHub";
import { AccessReadRecovery } from "@/components/AccessReadRecovery";
import { isFutureIssuedJwtError } from "@/lib/access-recovery";
import { captureServerException } from "@/lib/server-error-tracking";
export const metadata = { title: "Subscription & billing" };
export default async function BillingPage() {
 const supabase=await createClient();
 const {data}=await supabase.auth.getClaims();
 const userId=data?.claims?.sub;
 if (!userId) redirect("/login?next=/account/billing");
 const result=await fetchAccessEntitlements(supabase as never,userId);
 if (result.error) {
  if (isFutureIssuedJwtError(result.error)) {
   captureServerException(new Error("Access verification failed"), {
    route: "/account/billing", route_type: "render", stage: "entitlement",
    storage_provider: "supabase", error_code: "PGRST303", user_id: userId,
   });
   return <AccessReadRecovery retryPath="/account/billing" />;
  }
  throw result.error;
 }
 const rows=result.rows as (AccessEntitlement & {source?:unknown})[];
 const manual=rows.filter(row=>row.source === "manual");
 const lifetime=rows.filter(row=>row.productId === "lifetime_all_access");
 const access: HubAccess | undefined = hasBankAccess("igcse",lifetime) ? "lifetime" : hasComplimentaryAllAccess(rows) ? "complimentary" : BANKS.some(bank=>hasBankAccess(bank.slug,manual)) ? "manual" : undefined;
 return <AccountBillingHub access={access} />;
}
