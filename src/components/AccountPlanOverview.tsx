import Link from "next/link";

export function AccountPlanOverview({ hasBankAccess }: { hasBankAccess: boolean }) {
  return (
    <div className="account-plan-overview">
      <div>
        <strong>Your access</strong>
        <span>{hasBankAccess
          ? "Bank access is active. Check Subscription for any paid plans, their banks and renewal dates."
          : "You can practise free questions without a paid plan. Any complimentary access is shown separately from billing."}</span>
      </div>
      <div className="account-plan-actions">
        <Link className="button secondary" href={hasBankAccess ? "/account/subscription" : "/pricing"}>{hasBankAccess ? "Subscription details" : "View plans"}</Link>
      </div>
    </div>
  );
}
