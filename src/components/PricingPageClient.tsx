"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { PricingContent } from "@/components/PricingContent";
import type { Bank } from "@/lib/banks";
import { parsePricingAccount, SIGNED_OUT_PRICING_ACCOUNT, type PricingAccount } from "@/lib/pricing-account";
import { parsePricingIntent } from "@/lib/pricing-intent";
import { documentHasSupabaseAuthCookie, subscribeToSessionChanges } from "@/lib/supabase/auth-cookie";

type Props = { availableBanks: readonly Bank[]; updated?: { date: string; label: string } };
type AccountState = { status: "loading" } | { status: "ready"; account: PricingAccount } | { status: "delayed" } | { status: "failed" };

const readSessionCookie = () => documentHasSupabaseAuthCookie(document.cookie);

/**
 * Reads the signed-in plan state after the CDN-served page loads. Visitors without a session
 * cookie never call the API. The result only chooses what to display; checkout re-verifies.
 */
function usePricingAccount(): { state: AccountState; retry: () => void } {
  const hasSession = useSyncExternalStore(subscribeToSessionChanges, readSessionCookie, () => false);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; state: AccountState } | null>(null);
  const key = `${hasSession}:${attempt}`;
  useEffect(() => {
    if (!hasSession) return;
    let active = true;
    fetch("/api/pricing/account", { cache: "no-store", headers: { accept: "application/json" } })
      .then(async (response) => {
        const body: unknown = await response.json().catch(() => null);
        if (response.status === 503 && (body as { error?: unknown } | null)?.error === "access_check_delayed") return { status: "delayed" } as const;
        const account = response.ok ? parsePricingAccount(body) : null;
        return account ? { status: "ready", account } as const : { status: "failed" } as const;
      })
      .catch(() => ({ status: "failed" }) as const)
      .then((state) => { if (active) setResult({ key, state }); });
    return () => { active = false; };
  }, [hasSession, key]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  if (!hasSession) return { state: { status: "ready", account: SIGNED_OUT_PRICING_ACCOUNT }, retry };
  return { state: result?.key === key ? result.state : { status: "loading" }, retry };
}

/** Same header and selector position as the full page, with the rest reserved, so nothing moves when the plan loads. */
function PricingShell({ children, busy }: { children: React.ReactNode; busy?: boolean }) {
  return <div className="public-surface">
    <section className="simple-page pricing-page shell" aria-busy={busy || undefined}>
      <header className="pricing-recurring-intro" aria-label="Pricing plans">
        <h1>Invest in your future.</h1>
        <p>Start free. A plan unlocks the latest papers and every mark scheme.</p>
      </header>
      {children}
    </section>
  </div>;
}

function AccessProblem({ delayed, onRetry }: { delayed: boolean; onRetry: () => void }) {
  return <div className="public-surface"><section className="auth-page shell"><div className="auth-card" role="alert">
    <p className="eyebrow">{delayed ? "Access check delayed" : "Access check failed"}</p>
    <h1>We couldn&apos;t check your access.</h1>
    <p>Your account hasn&apos;t changed. Please try again in a moment.</p>
    <button className="button primary" type="button" onClick={onRetry}>Try again</button>
  </div></section></div>;
}

function PricingForVisitor({ availableBanks, updated }: Props) {
  // Called first: during prerender this bails out to the static fallback below.
  const searchParams = useSearchParams();
  const intent = useMemo(() => parsePricingIntent(searchParams, availableBanks), [searchParams, availableBanks]);
  const { state, retry } = usePricingAccount();
  if (state.status === "loading") {
    return <PricingShell busy><div className="pricing-account-pending" role="status"><span className="sr-only">Loading your plan</span></div></PricingShell>;
  }
  // Never offer checkout when the access lookup could not be completed.
  if (state.status !== "ready") return <AccessProblem delayed={state.status === "delayed"} onRetry={retry} />;
  return <PricingContent {...state.account} {...intent} availableBanks={availableBanks} updated={updated} />;
}

/**
 * /pricing is served from the CDN. The HTML holds the signed-out default page; the browser then
 * applies the URL's selection and, for signed-in visitors, their verified plan state.
 */
export function PricingPageClient({ availableBanks, updated }: Props) {
  return <Suspense fallback={<PricingContent authenticated={false} hasPaidAccess={false} availableBanks={availableBanks} updated={updated} staticFallback />}>
    <PricingForVisitor availableBanks={availableBanks} updated={updated} />
  </Suspense>;
}
