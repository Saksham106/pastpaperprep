import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { AccountPlanOverview } from "@/components/AccountPlanOverview";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AccessReadRecovery } from "@/components/AccessReadRecovery";
import { isFutureIssuedJwtError } from "@/lib/access-recovery";
import { captureServerException } from "@/lib/server-error-tracking";
import { fetchAccessEntitlements } from "@/lib/custom-bundle-access";
import { hasBankAccess, type AccessEntitlement } from "@/lib/access";
import { getEntitlementBanks } from "@/lib/banks";
import { createClient } from "@/lib/supabase/server";
import { CheckoutReturnStatus } from "@/components/CheckoutReturnTracker";
import { CHECKOUT_PENDING_COOKIE } from "@/lib/checkout-pending";
import { readCheckoutReturn } from "@/lib/checkout-return";

export const metadata = { title: "Your account" };


export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string | string[]; session_id?: string | string[] }>;
}) {
  const { checkout, session_id: sessionId } = await searchParams;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) {
    redirect("/login?next=/account");
  }

  const [{ data: userData }, accessResult] = await Promise.all([
    supabase.auth.getUser(),
    fetchAccessEntitlements(supabase as never, claimsData.claims.sub),
  ]);
  if (accessResult.error) {
    if (isFutureIssuedJwtError(accessResult.error)) {
      captureServerException(new Error("Access verification failed"), {
        route: "/account", route_type: "render", stage: "entitlement",
        storage_provider: "supabase", error_code: "PGRST303", user_id: claimsData.claims.sub,
      });
      return <AccessReadRecovery retryPath="/account" />;
    }
    throw accessResult.error;
  }
  const entitlements = accessResult.rows as AccessEntitlement[];
  const hasAnyBankAccess = getEntitlementBanks().some(({ slug }) => hasBankAccess(slug, entitlements));
  // The URL marker is stripped on arrival; the cookie keeps the pending state across refreshes.
  const checkoutReturn = await readCheckoutReturn({
    urlStatus: checkout,
    urlSessionId: sessionId,
    cookieValue: (await cookies()).get(CHECKOUT_PENDING_COOKIE)?.value,
    entitlements,
    userId: claimsData.claims.sub,
  });

  return (
    <section className="account-page account-overview-page">
      <div className="account-heading">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Your access and security.</h1>
          <p>{userData.user?.email}</p>
        </div>
        <form className="account-heading-actions" action={signOut}>
          <button className="button secondary" type="submit">Sign out</button>
        </form>
      </div>

      {checkoutReturn ? <CheckoutReturnStatus {...checkoutReturn} /> : null}
      <article className="account-card"><AccountPlanOverview hasBankAccess={hasAnyBankAccess} setupPending={Boolean(checkoutReturn && !checkoutReturn.settled)} /></article>
      <section className="account-setting-row account-appearance-row" role="group" aria-label="Appearance">
        <div><strong>Appearance</strong><span>Choose light or dark mode.</span></div>
        <ThemeToggle showLabel />
      </section>
      <div className="account-setting-row account-security-row">
        <div><strong>Security</strong><span>Add or change your password.</span></div>
        <Link className="button secondary" href="/account/password">Password settings</Link>
      </div>
    </section>
  );
}