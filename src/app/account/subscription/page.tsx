import Link from "next/link";
import { AccountBillingDetails } from "@/components/AccountBillingDetails";
import { ComplimentaryAllAccess } from "@/components/ComplimentaryAllAccess";
import { fetchAccessEntitlements } from "@/lib/custom-bundle-access";
import { hasComplimentaryAllAccess } from "@/lib/complimentary-access";
import { createClient } from "@/lib/supabase/server";
import type { AccessEntitlement } from "@/lib/access";
import { redirect } from "next/navigation";

export const metadata = { title: "Subscription" };

export default async function SubscriptionPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  // The layout also authenticates, but session state can change between reads.
  if (!userId) redirect("/login?next=/account/subscription");
  const result = await fetchAccessEntitlements(supabase as never, userId);
  if (result.error) throw result.error;
  const complimentaryAllAccess = hasComplimentaryAllAccess(result.rows as (AccessEntitlement & { source?: unknown })[]);
  return (
    <section className="account-section-page account-subscription-page">
      <div className="pricing-intro account-subscription-intro">
        <p className="eyebrow">Account / Subscription</p>
        <h1>Subscription</h1>
        <p className="page-lede">{complimentaryAllAccess ? "Every question bank is included in your access." : "Your access and available plans in one place. Review your current plan before making a change."}</p>
      </div>
      {complimentaryAllAccess ? <ComplimentaryAllAccess /> : null}
      <AccountBillingDetails mode="subscription" complimentaryAllAccess={complimentaryAllAccess} />
      {!complimentaryAllAccess ? <p className="account-page-help">Want to compare the plans? <Link href="/pricing">Change plan on Pricing</Link>. Payment methods and complete invoice history are in the secure billing portal. Changes to legacy or separately billed plans may need support.</p> : <p className="account-page-help">Payment methods and complete invoice history are in the secure billing portal. Complimentary access is not a billed plan.</p>}
    </section>
  );
}
