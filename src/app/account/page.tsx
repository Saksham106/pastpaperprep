import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { AccountPlanOverview } from "@/components/AccountPlanOverview";
import { fetchAccessEntitlements } from "@/lib/custom-bundle-access";
import { hasBankAccess, type AccessEntitlement } from "@/lib/access";
import { getEntitlementBanks } from "@/lib/banks";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Your account" };


export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string | string[] }>;
}) {
  const checkout = (await searchParams).checkout;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) {
    redirect("/login?next=/account");
  }

  const [{ data: userData }, accessResult] = await Promise.all([
    supabase.auth.getUser(),
    fetchAccessEntitlements(supabase as never, claimsData.claims.sub),
  ]);
  if (accessResult.error) throw accessResult.error;
  const entitlements = accessResult.rows as AccessEntitlement[];
  const hasPaidAccess = getEntitlementBanks().some(({ slug }) => hasBankAccess(slug, entitlements));

  return (
    <section className="account-page shell">
      <div className="account-heading">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Your access and security.</h1>
          <p>{userData.user?.email}</p>
        </div>
        <div className="account-heading-actions"><form action={signOut}>
          <button className="button secondary" type="submit">Sign out</button>
        </form></div>
      </div>

      {checkout === "success" && (
        <div className="account-checkout-status" role="status">
          <strong>Finishing your plan setup.</strong>
          <span>If you just completed checkout, your access should appear shortly. Refresh this page in a few seconds if it is not visible yet.</span>
        </div>
      )}
      <article className="account-card"><AccountPlanOverview hasPaidAccess={hasPaidAccess} /></article>
      <div className="account-security-row">
        <div><strong>Security</strong><span>Add or change your password.</span></div>
        <Link className="button secondary" href="/account/password">Password settings</Link>
      </div>
    </section>
  );
}