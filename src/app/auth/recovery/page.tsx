import Link from "next/link";
import { ArrowRight, Key } from "@phosphor-icons/react/dist/ssr";

export const metadata = { title: "Reset password" };

function validTokenHash(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{32,256}$/.test(value);
}

export default async function RecoveryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const tokenHash = Array.isArray(params.token_hash) ? params.token_hash[0] : params.token_hash;

  return (
    <section className="auth-page shell">
      <div className="auth-card auth-card-compact">
        <p className="eyebrow">Password reset</p>
        <h1>Set a new password.</h1>
        {validTokenHash(tokenHash) ? (
          <>
            <p>Continue when you are ready. This protects your one-time link from email scanners.</p>
            <form action="/auth/confirm" method="get" className="auth-form">
              <input type="hidden" name="token_hash" value={tokenHash} />
              <input type="hidden" name="type" value="recovery" />
              <input type="hidden" name="next" value="/account/password" />
              <button className="button primary" type="submit"><Key weight="bold" /> Continue to reset password <ArrowRight weight="bold" /></button>
            </form>
          </>
        ) : (
          <>
            <p>This reset link is incomplete or no longer valid.</p>
            <Link className="button primary" href="/login">Request a new reset link</Link>
          </>
        )}
      </div>
    </section>
  );
}
