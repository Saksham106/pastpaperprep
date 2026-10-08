import { redirect } from "next/navigation";

export const metadata = { title: "Subscription & billing" };

export default function SubscriptionPage() {
  redirect("/account/billing#subscription");
}
