import Link from "next/link";
export function AccountPlanOverview({ hasPaidAccess }: { hasPaidAccess: boolean }) {
  return (
    <div className="account-plan-overview">
      <div><strong>Plan and billing</strong><span>Plan details and billing live together on the pricing page.</span></div>
      <Link className="button primary" href="/pricing">{hasPaidAccess ? "Manage plan" : "View plans"}</Link>
    </div>
  );
}
