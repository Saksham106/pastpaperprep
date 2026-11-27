import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SubscriptionExitFlow } from "@/components/SubscriptionExitFlow";
import { PRIVATE_ROBOTS } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Cancel subscription", robots: PRIVATE_ROBOTS };

export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login?next=/subscription/cancel");
  return <SubscriptionExitFlow start="cancel" />;
}
