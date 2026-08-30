import Link from "next/link";
import type { Metadata } from "next";
import { SignInMethods } from "@/components/SignInMethods";
import { safeNextPath } from "@/lib/auth";
import { PRIVATE_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = { title: "Sign in", robots: PRIVATE_ROBOTS };

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
        <p className="eyebrow">Your study space</p>
        <h1>Pick up where you left off.</h1>
        <p>Use your password or request a secure email link.</p>
        {params.error && (
          <p className="form-message error auth-link-error" role="alert">
            That sign-in link is invalid or expired. Request a fresh one below.
          </p>
        )}
        <SignInMethods next={next} />
        <p className="auth-fine-print">By continuing, you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>
      </div>
    </section>
  );
}
