import Link from "next/link";
import { ArrowRight, Gear, Key, LockOpen } from "@phosphor-icons/react/dist/ssr";
import { BANKS, type BankSlug } from "@/lib/banks";

export function DashboardContent({ authenticated, accessibleBanks }: { authenticated: boolean; accessibleBanks: BankSlug[] }) {
  const accessible = new Set(accessibleBanks);
  const orderedBanks = [...BANKS].sort((a, b) => Number(accessible.has(b.slug)) - Number(accessible.has(a.slug)));
  const hasPaidAccess = accessibleBanks.length > 0;

  return (
    <section className="dashboard-page shell">
      <header className="dashboard-heading">
        <div>
          <p className="eyebrow">Study workspace</p>
          <h1>{hasPaidAccess ? "Your question banks" : "Choose a question bank"}</h1>
          <p>{hasPaidAccess ? "Your included banks are ready first. Everything else stays available to preview." : "Start with complete free exam years. Upgrade only when you need the full bank."}</p>
        </div>
        <div className="dashboard-actions">
          {authenticated ? (
            <>
              <Link href="/pricing"><Gear /> Manage plan</Link>
              <Link href="/account"><Gear /> My account</Link>
              <Link href="/account/password"><Key /> Password settings</Link>
            </>
          ) : (
            <Link href="/login?next=/dashboard"><LockOpen /> Sign in</Link>
          )}
        </div>
      </header>

      <div className="dashboard-bank-grid">
        {orderedBanks.map((bank) => {
          const included = accessible.has(bank.slug);
          const href = included ? `/banks/${bank.slug}` : `/banks/${bank.slug}?free=1`;
          return (
            <article className={`dashboard-bank-card ${bank.accent}${included ? " is-included" : ""}`} key={bank.slug}>
              <div className="dashboard-bank-meta">
                <span>{bank.qualification}</span>
                <strong>{included ? "Included" : "Free questions"}</strong>
              </div>
              <h2>{bank.shortName}</h2>
              <p>{bank.description}</p>
              <div className="dashboard-bank-stats"><span>{bank.questionCount.toLocaleString()} {included ? "questions" : "total questions"}</span><span>{bank.paperCount} papers</span></div>
              <Link className="dashboard-bank-link" href={href} aria-label={`${included ? "Open" : "Start free"} ${bank.shortName}`}>
                {included ? "Open bank" : "Start free"} <ArrowRight weight="bold" />
              </Link>
            </article>
          );
        })}
      </div>

      {!hasPaidAccess && (
        <aside className="dashboard-upgrade-strip">
          <div><strong>Need the full question set?</strong><span>Unlock one bank from $5/month, or choose a subject pair.</span></div>
          <Link className="button primary" href="/pricing">View plans <ArrowRight weight="bold" /></Link>
        </aside>
      )}
    </section>
  );
}
