import Link from "next/link";
import { MagicLinkForm } from "@/components/MagicLinkForm";
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
        <h1>Sign in without another password.</h1>
        <p>We’ll email you a secure one-time link. New students get an account automatically.</p>
        {params.error && <p className="form-message error">That sign-in link is invalid or expired. Request a fresh one below.</p>}
        <MagicLinkForm next={next} />
        <p className="auth-fine-print">By continuing, you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>
      </div>
    </section>
  );
}
