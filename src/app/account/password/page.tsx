import Link from "next/link";
import { redirect } from "next/navigation";
import { PasswordSettingsForm } from "@/components/PasswordSettingsForm";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Set your password" };

export default async function PasswordPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) {
    redirect("/login?next=/account/password");
  }

  return (
    <section className="auth-page shell">
      <div className="auth-card">
        <p className="eyebrow">Sign-in options</p>
        <h1>Add or change your password.</h1>
        <p>Email-link sign-in will keep working after you save a password.</p>
        <PasswordSettingsForm />
        <p className="auth-fine-print"><Link href="/account">Back to your account</Link></p>
      </div>
    </section>
  );
}
