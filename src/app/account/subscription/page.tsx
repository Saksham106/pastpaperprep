import { AccountBillingDetails } from "@/components/AccountBillingDetails";
import { ComplimentaryAllAccess } from "@/components/ComplimentaryAllAccess";
import { fetchAccessEntitlements } from "@/lib/custom-bundle-access";
import { hasComplimentaryAllAccess } from "@/lib/complimentary-access";
import { createClient } from "@/lib/supabase/server";
import type { AccessEntitlement } from "@/lib/access";

export const metadata = { title: "Subscription" };

export default async function SubscriptionPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  // The account layout has already authenticated this route; do not render a grant on uncertain readback.
  let complimentaryAllAccess = false;
  if (userId) {
    const result = await fetchAccessEntitlements(supabase as never, userId);
    if (result.error) throw result.error;
    complimentaryAllAccess = hasComplimentaryAllAccess(result.rows as (AccessEntitlement & { source?: unknown })[]);
  }
  return (
    <section className="account-section-page account-subscription-page">
      <p className="eyebrow">Account</p>
      <h1>Subscription</h1>
      {complimentaryAllAccess ? <ComplimentaryAllAccess /> : null}
      <AccountBillingDetails mode="subscription" complimentaryAllAccess={complimentaryAllAccess} />
      <p className="account-page-help">Payment methods and complete invoice history are in the secure billing portal. Changes to legacy or separately billed plans may need support.</p>
    </section>
  );
}
