import Link from "next/link";
import { ArrowRight, CaretDown, Gear, Key } from "@phosphor-icons/react/dist/ssr";
import { BANKS, type Bank, type BankSlug } from "@/lib/banks";

type BankGroup = {
  name: string;
  className: string;
  banks: Bank[];
};

const CARD_NAMES: Record<BankSlug, string> = {
  igcse: "Mathematics 0580",
  "igcse-additional": "Additional Mathematics 0606",
  "ib-hl": "Maths AA HL",
  "ib-sl": "Maths AA SL",
  "ib-ai-hl": "Maths AI HL",
  "ib-ai-sl": "Maths AI SL",
  "ib-chemistry-hl": "Chemistry HL",
  "ib-chemistry-sl": "Chemistry SL",
};

export function DashboardContent({ authenticated, accessibleBanks }: { authenticated: boolean; accessibleBanks: BankSlug[] }) {
  const accessible = new Set(accessibleBanks);
  const hasPaidAccess = accessibleBanks.length > 0;
  const groups: BankGroup[] = [
    {
      name: "Cambridge IGCSE",
      className: "cambridge",
      banks: BANKS.filter((bank) => bank.qualification === "Cambridge IGCSE"),
    },
    {
      name: "IB Analysis and Approaches",
      className: "ib-aa",
      banks: BANKS.filter((bank) => bank.slug === "ib-hl" || bank.slug === "ib-sl"),
    },
    {
      name: "IB Applications and Interpretation",
      className: "ib-ai",
      banks: BANKS.filter((bank) => bank.slug === "ib-ai-hl" || bank.slug === "ib-ai-sl"),
    },
    {
      name: "IB Chemistry",
      className: "ib-chemistry",
      banks: BANKS.filter((bank) => bank.slug === "ib-chemistry-hl" || bank.slug === "ib-chemistry-sl"),
    },
  ].sort((a, b) => Number(b.banks.some((bank) => accessible.has(bank.slug))) - Number(a.banks.some((bank) => accessible.has(bank.slug))));

  return (
    <section className="dashboard-page dashboard-study-desk shell">
      <header className="dashboard-heading">
        <div>
          <p className="eyebrow">Question banks</p>
          <h1>{hasPaidAccess ? "Your study desk" : "Start practising"}</h1>
          <p>{hasPaidAccess ? "Open an included bank or sample another course with free questions." : "Pick your course and start with complete older exam years for free."}</p>
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
        ) : null}
      </header>

      {!hasPaidAccess && (
        <aside className="dashboard-upgrade-strip">
          <div><strong>Ready for the complete bank?</strong><span>Unlock one course from $5/month, or get both levels in a subject pair.</span></div>
          <Link className="button secondary" href="/pricing">View plans <ArrowRight weight="bold" /></Link>
        </aside>
      )}

      <div className="dashboard-bank-groups">
        {groups.map((group) => (
          <section className={`dashboard-bank-family dashboard-bank-family-${group.className}`} key={group.name} aria-labelledby={`dashboard-${group.className}`}>
            <header>
              <h2 id={`dashboard-${group.className}`}>{group.name}</h2>
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
                      <div className="dashboard-bank-meta"><strong>{included ? "Included" : "Free exam years"}</strong></div>
                      <h3>{CARD_NAMES[bank.slug]}</h3>
                      <div className="dashboard-bank-stats"><span>{bank.questionCount.toLocaleString()} questions</span><span>{bank.paperCount} papers</span></div>
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
