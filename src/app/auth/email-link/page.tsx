import Link from "next/link";
import { ArrowRight, EnvelopeSimpleOpen } from "@phosphor-icons/react/dist/ssr";
import { safeNextPath } from "@/lib/auth";
import { ConfirmationForm } from "@/app/auth/confirmation-form";
import { logAuthDiagnostic, validAuthAttemptId } from "@/lib/auth-diagnostics";

export const metadata = { title: "Continue signing in" };

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function validTokenHash(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{32,256}$/.test(value);
}

export default async function EmailLinkPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const tokenHash = first(params.token_hash);
  const type = first(params.type);
  const next = safeNextPath(first(params.next));
  const validType = type === "email" || type === "signup";
  const valid = validTokenHash(tokenHash) && validType;
  const rawAttempt = first(params.auth_attempt);
  const attemptId = validAuthAttemptId(rawAttempt) ? rawAttempt : undefined;
  if (valid && attemptId) logAuthDiagnostic({ attemptId, phase: "email_link_rendered" });

  return (
    <section className="auth-page shell">
      <div className="auth-card auth-card-compact">
        <p className="eyebrow">Secure sign in</p>
        <h1>Continue to PastPaperPrep.</h1>
        {valid ? (
          <>
            <p>Press continue to finish signing in. This extra step keeps email security scanners from using your one-time link first.</p>
            <ConfirmationForm className="auth-form">
              <input type="hidden" name="token_hash" value={tokenHash} />
              <input type="hidden" name="type" value={type} />
              <input type="hidden" name="next" value={next} />
              {attemptId && <input type="hidden" name="auth_attempt" value={attemptId} />}
              <button className="button primary" type="submit">
                <EnvelopeSimpleOpen weight="bold" /> Continue to PastPaperPrep <ArrowRight weight="bold" />
              </button>
            </ConfirmationForm>
          </>
        ) : (
          <>
            <p>This sign-in link is incomplete or no longer valid.</p>
            <Link className="button primary" href="/login">Request a new sign-in link</Link>
          </>
        )}
      </div>
    </section>
  );
}
