import Link from "next/link";
import { redirect } from "next/navigation";
import { PasswordSettingsForm } from "@/components/PasswordSettingsForm";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Set your password" };

export default async function PasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ invited?: string }>;
}) {
  const params = await searchParams;
  const invited = params?.invited === "1";
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) {
    redirect("/login?next=/account/password");
  }

  return (
    <section className="auth-page shell">
      <div className="auth-card">
        <p className="eyebrow">{invited ? "Account invitation" : "Sign-in options"}</p>
        <h1>{invited ? "Finish creating your account." : "Add or change your password."}</h1>
        <p>{invited
          ? "Create a password for this invited email address. You’ll use it to sign in next time."
          : "Email-link sign-in will keep working after you save a password."}</p>
        <PasswordSettingsForm />
        <p className="auth-fine-print"><Link href="/account">Back to your account</Link></p>
      </div>
    </section>
  );
}
