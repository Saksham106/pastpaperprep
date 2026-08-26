import Link from "next/link";
import { MagicLinkForm } from "@/components/MagicLinkForm";
import { PasswordSignInForm } from "@/components/PasswordSignInForm";
import { safeNextPath } from "@/lib/auth";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);

  return (
    <section className="auth-page shell">
      <div className="auth-card">
        <p className="eyebrow">Your study account</p>
        <h1>Sign in your way.</h1>
        <p>Use your password, or get a secure email link. New students can start with email and add a password later.</p>
        {next === "/pricing" && <div className="auth-next-step"><strong>What happens next</strong><span>Choose monthly or annual access, then every bank unlocks immediately.</span></div>}
        {params.error && <p className="form-message error">That sign-in link is invalid or expired. Request a fresh one below.</p>}
        <PasswordSignInForm next={next} />
        <div className="auth-divider"><span>or use a one-time link</span></div>
        <MagicLinkForm next={next} />
        <p className="auth-fine-print">By continuing, you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>
      </div>
    </section>
  );
}
