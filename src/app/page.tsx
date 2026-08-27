import { redirect } from "next/navigation";
import { MarketingHome } from "@/components/MarketingHome";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (typeof claimsData?.claims?.sub === "string") redirect("/dashboard");
  return <MarketingHome />;
}
