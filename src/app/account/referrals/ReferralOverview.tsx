import type { CustomerReferralSummary } from "@/lib/customer-referrals";
import { CopyReferralLink } from "./CopyReferralLink";

export function ReferralOverview({ summary }: { summary: CustomerReferralSummary }) {
  const { verifiedSignups, awardedRewards, awardedSignupMilestones, code } = summary;
  const progress = Math.min(5, Math.max(0, verifiedSignups - awardedSignupMilestones * 5));
  return (
    <section className="account-section-page account-referrals-page">
      <p className="eyebrow">Account</p>
      <h1>Share PastPaperPrep.</h1>
      <p>Send your link to someone who hasn’t used PastPaperPrep yet. We’ll keep track when they create and verify an account.</p>
      <div className="account-readonly-note">
        <CopyReferralLink url={`https://pastpaperprep.com/invite/${code}`} />
      </div>
      <div className="account-referral-progress" aria-label="Referral progress">
        <div>
          <span className="account-referral-number">{progress} / 5</span>
          <strong>Verified signups toward your next credit</strong>
          <p>{verifiedSignups} total verified {verifiedSignups === 1 ? "signup" : "signups"}. New accounts only; no click counting.</p>
        </div>
        <div>
          <span className="account-referral-number">{awardedRewards}</span>
          <strong>Credits awarded</strong>
          <p>Only credits already added to your account appear here. Purchase rewards are reviewed manually.</p>
        </div>
      </div>
      <div className="account-readonly-note account-referral-terms">
        <strong>How you earn a credit</strong>
        <p>For every five eligible new people who verify their accounts, or when a referred person makes their first paid subscription purchase, you can earn a credit worth one month of your paid plan. We review eligibility and add credits manually to a future bill after checking the purchase; purchases aren’t shown as a live counter here.</p>
        <p>For annual plans, one month means one-twelfth of your annual plan price as a future-bill credit—not an extra month added to your term. If you’re on a free account, we’ll review the credit when you choose an eligible paid plan. Self-referrals, existing accounts, refunded payments and $0 invoices don’t qualify. Credits are not cash.</p>
      </div>
    </section>
  );
}
