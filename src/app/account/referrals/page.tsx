import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCustomerReferralSummary } from "@/lib/customer-referrals";
import { ReferralOverview } from "./ReferralOverview";

export const metadata = { title: "Referrals" };

export default async function ReferralsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login?next=/account/referrals");
  const summary = await getCustomerReferralSummary(data.claims.sub, supabase);

  if (!summary) {
    return (
      <section className="account-section-page">
        <p className="eyebrow">Account</p>
        <h1>Referrals</h1>
        <p>Customer referrals are not available for this account. Partner referrals have separate terms.</p>
      </section>
    );
  }

  return <ReferralOverview summary={summary} />;
}
