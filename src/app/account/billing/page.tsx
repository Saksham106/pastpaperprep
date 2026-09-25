import { PortalButton } from "@/components/BillingActions";
import { AccountBillingDetails } from "@/components/AccountBillingDetails";

export const metadata = { title: "Billing" };

export default function BillingPage() {
  return (
    <section className="account-section-page">
      <p className="eyebrow">Account</p>
      <h1>Billing</h1>
      <div className="account-readonly-note">
        <strong>Payment methods and invoices</strong>
        <p>Open the secure billing portal to update payment methods, review invoices, and manage billing documents. Card details are not stored on this page.</p>
        <PortalButton />
      </div>
      <AccountBillingDetails mode="billing" />
    </section>
  );
}
