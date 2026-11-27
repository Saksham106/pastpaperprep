import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SubscriptionExitFlow, type ExitFlowSource } from "@/components/SubscriptionExitFlow";
import { PRIVATE_ROBOTS } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Cancel subscription", robots: PRIVATE_ROBOTS };

/** "Keep my plan" links from the access-end email and the on-site strip tag their undo. */
const SOURCES = new Set<unknown>(["reminder", "notice"]);

export default async function Page({ searchParams }: { searchParams: Promise<{ from?: string | string[] }> }) {
  const { from } = await searchParams;
  const source = SOURCES.has(from) ? from as ExitFlowSource : undefined;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect(`/login?next=${encodeURIComponent(source ? `/subscription/cancel?from=${source}` : "/subscription/cancel")}`);
  return <SubscriptionExitFlow start="cancel" source={source} />;
}
