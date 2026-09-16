import Link from "next/link";
import { PortalButton } from "@/components/BillingActions";

export function AccountPlanOverview({ hasPaidAccess }: { hasPaidAccess: boolean }) {
  return (
    <div className="account-plan-overview">
      <div><strong>Plan and billing</strong><span>Plan details and billing live together on the pricing page.</span></div>
      <div className="account-plan-actions">
        {hasPaidAccess ? <PortalButton /> : null}
        <Link className="button primary" href="/pricing">{hasPaidAccess ? "Manage plan" : "View plans"}</Link>
      </div>
    </div>
  );
}
