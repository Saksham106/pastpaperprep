import type { CustomerReferralSummary } from "@/lib/customer-referrals";
import { CopyReferralLink } from "./CopyReferralLink";
import { ReferralMoreInfo } from "./ReferralMoreInfo";

export function ReferralOverview({ summary }: { summary: CustomerReferralSummary }) {
  const { verifiedSignups, awardedRewards, awardedSignupMilestones, code } = summary;
  const progress = Math.min(5, Math.max(0, verifiedSignups - awardedSignupMilestones * 5));
  return (
    <section className="account-section-page account-referrals-page">
      <p className="eyebrow">Account</p>
      <h1>Share PastPaperPrep.</h1>
      <p>Give friends your link. Earn credit when they join.</p>
      <div className="account-readonly-note">
        <CopyReferralLink url={`https://pastpaperprep.com/invite/${code}`} />
      </div>
      <div className="account-referral-progress" aria-label="Referral progress">
        <div>
          <span className="account-referral-number">{progress} / 5</span>
          <strong>Verified signups</strong>
        </div>
        <div>
          <span className="account-referral-number">{awardedRewards}</span>
          <strong>Credits awarded</strong>
        </div>
      </div>
      <div className="account-referral-rewards">
        <p className="eyebrow">Two ways to earn</p>
        <div className="account-referral-reward-grid">
          <strong>5 verified signups <span aria-hidden="true">→</span> 1 month’s value</strong>
          <strong>1 first purchase <span aria-hidden="true">→</span> 1 month’s value</strong>
        </div>
        <div className="account-referral-reward-footer">
          <span>Credits are added manually to a future bill.</span>
          <ReferralMoreInfo />
        </div>
      </div>
    </section>
  );
}
