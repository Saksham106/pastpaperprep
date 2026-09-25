import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PRIVATE_ROBOTS } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { AccountSettingsNav } from "@/components/AccountSettingsNav";

export const metadata: Metadata = { robots: PRIVATE_ROBOTS };

export default async function AccountLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login?next=/account");

  return (
    <div className="account-settings-layout">
      <AccountSettingsNav />
      <div className="account-settings-content">{children}</div>
    </div>
  );
}
