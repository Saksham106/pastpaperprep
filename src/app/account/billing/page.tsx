import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchAccessEntitlements } from "@/lib/custom-bundle-access";
import { hasComplimentaryAllAccess } from "@/lib/complimentary-access";
import { hasBankAccess, type AccessEntitlement } from "@/lib/access";
import { BANKS } from "@/lib/banks";
import { AccountBillingHub, type HubAccess } from "@/components/AccountBillingHub";
export const metadata = { title: "Subscription & billing" };
export default async function BillingPage() {
 const supabase=await createClient();
 const {data}=await supabase.auth.getClaims();
 const userId=data?.claims?.sub;
 if (!userId) redirect("/login?next=/account/billing");
 const result=await fetchAccessEntitlements(supabase as never,userId);
 if (result.error) throw result.error;
 const rows=result.rows as (AccessEntitlement & {source?:unknown})[];
 const manual=rows.filter(row=>row.source === "manual");
 const lifetime=rows.filter(row=>row.productId === "lifetime_all_access");
 const access: HubAccess | undefined = hasBankAccess("igcse",lifetime) ? "lifetime" : hasComplimentaryAllAccess(rows) ? "complimentary" : BANKS.some(bank=>hasBankAccess(bank.slug,manual)) ? "manual" : undefined;
 return <AccountBillingHub access={access} />;
}
