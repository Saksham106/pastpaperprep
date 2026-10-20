import type { CustomerReferralSummary } from "@/lib/customer-referrals";
import { CopyReferralLink } from "./CopyReferralLink";
import { PreferredSourceBonus } from "./PreferredSourceBonus";
import { ReferralMoreInfo } from "./ReferralMoreInfo";

export function ReferralOverview({ summary }: { summary: CustomerReferralSummary }) {
  const { verifiedSignups, awardedRewards, awardedSignupMilestones, code, preferredSourceBonus } = summary;
  // Points = verified referrals + the one-time Google bonus; the award trigger counts the same way.
  const points = verifiedSignups + (preferredSourceBonus ? 1 : 0);
  const progress = Math.min(5, Math.max(0, points - awardedSignupMilestones * 5));
  const breakdown = `${verifiedSignups} ${verifiedSignups === 1 ? "referral" : "referrals"}${preferredSourceBonus ? " + Google bonus" : ""}`;
  return (
    <section className="account-section-page account-referrals-page">
      <p className="eyebrow">Account</p>
      <h1>Share PastPaperPrep.</h1>
      <p>Earn points. 5 points = 1 month free.</p>
      <div className="account-referral-progress" aria-label="Referral progress">
        <div>
          <span className="account-referral-number">{progress} / 5</span>
          <strong>Points</strong>
          <small>All time: {breakdown}</small>
        </div>
        <div>
          <span className="account-referral-number">{awardedRewards}</span>
          <strong>Credits awarded</strong>
        </div>
      </div>
      <ol className="account-referral-actions" aria-label="Ways to earn points">
        <li>
          <div className="account-referral-action-head">
            <strong>Refer a friend who verifies their account</strong>
            <span>+1 point each</span>
          </div>
          <CopyReferralLink url={`https://pastpaperprep.com/invite/${code}`} />
        </li>
        <li>
          <div className="account-referral-action-head">
            <strong>Add us as a preferred source on Google</strong>
            <span>+1 point, once</span>
          </div>
          <PreferredSourceBonus claimed={preferredSourceBonus} />
        </li>
      </ol>
      <div className="account-referral-rewards">
        <p className="eyebrow">Also</p>
        <strong className="account-referral-purchase">1 referred first purchase <span aria-hidden="true">→</span> 1 month free</strong>
        <div className="account-referral-reward-footer">
          <span>Credits are added manually to a future bill after review.</span>
          <ReferralMoreInfo />
        </div>
      </div>
    </section>
  );
}
