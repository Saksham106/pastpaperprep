import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { AccountPlanOverview } from "@/components/AccountPlanOverview";
import { CURRENT_ENTITLEMENT_FILTERS } from "@/lib/current-entitlements";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Your account" };

type Entitlement = {
  status: string;
};

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) {
    redirect("/login?next=/account");
  }

  const [{ data: userData }, { data: entitlementData, error: entitlementError }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("entitlements")
      .select("status")
      .eq("user_id", claimsData.claims.sub)
      .in("status", ["active", "trialing"])
      .lte("starts_at", CURRENT_ENTITLEMENT_FILTERS.startsAt)
      .or(CURRENT_ENTITLEMENT_FILTERS.expiresAt),
  ]);
  if (entitlementError) throw entitlementError;

  const entitlements = (entitlementData ?? []) as Entitlement[];

  return (
    <section className="account-page shell">
      <div className="account-heading">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Your access and security.</h1>
          <p>{userData.user?.email}</p>
        </div>
        <form action={signOut}>
          <button className="button secondary" type="submit">Sign out</button>
        </form>
      </div>

      <article className="account-card"><AccountPlanOverview hasPaidAccess={entitlements.length > 0} /></article>
      <div className="account-security-row">
        <div><strong>Security</strong><span>Add or change your password.</span></div>
        <Link className="button secondary" href="/account/password">Password settings</Link>
      </div>
    </section>
  );
}