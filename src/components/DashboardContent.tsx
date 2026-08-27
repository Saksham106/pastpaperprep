import Link from "next/link";
import { ArrowRight, CaretDown, Gear, Key, LockOpen } from "@phosphor-icons/react/dist/ssr";
import { BANKS, type Bank, type BankSlug } from "@/lib/banks";

type BankGroup = {
  name: string;
  description: string;
  className: string;
  banks: Bank[];
};

export function DashboardContent({ authenticated, accessibleBanks }: { authenticated: boolean; accessibleBanks: BankSlug[] }) {
  const accessible = new Set(accessibleBanks);
  const hasPaidAccess = accessibleBanks.length > 0;
  const groups: BankGroup[] = [
    {
      name: "Cambridge IGCSE",
      description: "Mathematics 0580 and Additional Mathematics 0606",
      className: "cambridge",
      banks: BANKS.filter((bank) => bank.qualification === "Cambridge IGCSE"),
    },
    {
      name: "IB Mathematics",
      description: "Analysis and Approaches, Applications and Interpretation",
      className: "ib",
      banks: BANKS.filter((bank) => bank.qualification === "International Baccalaureate"),
    },
  ].sort((a, b) => Number(b.banks.some((bank) => accessible.has(bank.slug))) - Number(a.banks.some((bank) => accessible.has(bank.slug))));

  return (
    <section className="dashboard-page shell">
      <header className="dashboard-heading">
        <div>
          <p className="eyebrow">Study workspace</p>
          <h1>{hasPaidAccess ? "Your question banks" : "Choose a question bank"}</h1>
          <p>{hasPaidAccess ? "Your included banks are ready first. Everything else stays available to preview." : "Start with complete free exam years. Upgrade only when you need the full bank."}</p>
        </div>
        {authenticated ? (
          <details className="dashboard-settings">
            <summary><Gear /> Account & settings <CaretDown /></summary>
            <div className="dashboard-actions">
              <Link href="/pricing"><Gear /> Manage plan</Link>
              <Link href="/account"><Gear /> My account</Link>
              <Link href="/account/password"><Key /> Password settings</Link>
            </div>
          </details>
        ) : (
          <div className="dashboard-actions"><Link href="/login?next=/dashboard"><LockOpen /> Sign in</Link></div>
        )}
      </header>

      {!hasPaidAccess && (
        <aside className="dashboard-upgrade-strip">
          <div><strong>Need the full question set?</strong><span>Unlock one bank from $5/month, or choose a subject pair.</span></div>
          <Link className="button primary" href="/pricing">View plans <ArrowRight weight="bold" /></Link>
        </aside>
      )}

      <div className="dashboard-bank-groups">
        {groups.map((group) => (
          <section className={`dashboard-bank-family dashboard-bank-family-${group.className}`} key={group.name} aria-labelledby={`dashboard-${group.className}`}>
            <header>
              <div><h2 id={`dashboard-${group.className}`}>{group.name}</h2><p>{group.description}</p></div>
              <span>{group.banks.length} banks</span>
            </header>
            <div className="dashboard-bank-grid">
              {[...group.banks]
                .sort((a, b) => Number(accessible.has(b.slug)) - Number(accessible.has(a.slug)))
                .map((bank) => {
                  const included = accessible.has(bank.slug);
                  const href = included ? `/banks/${bank.slug}` : `/banks/${bank.slug}?free=1`;
                  return (
                    <Link
                      className={`dashboard-bank-card ${bank.accent}${included ? " is-included" : ""}`}
                      href={href}
                      aria-label={`${included ? "Open" : "Start free"} ${bank.shortName}`}
                      key={bank.slug}
                    >
                      <div className="dashboard-bank-meta"><span>{bank.subject}</span><strong>{included ? "Included" : "Free questions"}</strong></div>
                      <h3>{bank.shortName}</h3>
                      <p>{bank.description}</p>
                      <div className="dashboard-bank-stats"><span>{bank.questionCount.toLocaleString()} {included ? "questions" : "total questions"}</span><span>{bank.paperCount} papers</span></div>
                      <span className="dashboard-bank-link">{included ? "Open bank" : "Start free"} <ArrowRight weight="bold" /></span>
                    </Link>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
