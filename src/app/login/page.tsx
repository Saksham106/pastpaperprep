import Link from "next/link";
import type { Metadata } from "next";
import { AuthEntry } from "@/components/AuthEntry";
import { safeNextPath } from "@/lib/auth";
import { PRIVATE_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = { title: "Sign in", robots: PRIVATE_ROBOTS };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; mode?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);

  return (
    <div className="public-surface">
      <section className="auth-page shell">
        <div className="auth-card">
          <AuthEntry next={next} hasLinkError={Boolean(params.error)} initialMode={params.mode === "sign-up" ? "sign-up" : "sign-in"} />
          <p className="auth-fine-print">By continuing, you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>
        </div>
      </section>
    </div>
  );
}
