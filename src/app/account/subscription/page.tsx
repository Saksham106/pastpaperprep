import { AccountBillingDetails } from "@/components/AccountBillingDetails";

export const metadata = { title: "Subscription" };

export default function SubscriptionPage() {
  return (
    <section className="account-section-page account-subscription-page">
      <p className="eyebrow">Account</p>
      <h1>Subscription</h1>
      <AccountBillingDetails mode="subscription" />
      <p className="account-page-help">Payment methods and complete invoice history are in the secure billing portal. Changes to legacy or separately billed plans may need support.</p>
    </section>
  );
}
