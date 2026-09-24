"use client";

import Link from "next/link";
import { ArrowRight, CaretDown, Gear, Key } from "@phosphor-icons/react/dist/ssr";
import { QualificationTabs } from "@/components/QualificationTabs";
import { CourseIcon, courseToneForBank, type CourseTone } from "@/components/CourseIcon";
import { WorksheetList } from "@/components/WorksheetList";
import { bankEntryHref, hasFreeTier } from "@/lib/access";
import { BANKS, type Bank, type BankSlug } from "@/lib/banks";

type BankGroup = { name: string; className: string; tone: CourseTone; banks: Bank[] };
/**
 * Cambridge rows carry ONE coherent full bank label ("Mathematics 0580"), never a syllabus code
 * split away from its subject. The runtime subject already reads "subject + code" for Cambridge,
 * so the row title and the closed family heading can no longer disagree.
 * IB keeps its subject-plus-level presentation ("Maths AA HL"), which the user asked not to change.
 */
function displayBankName(bank: Bank): string {
  if (bank.qualification === "Cambridge IGCSE") return bank.subject;
  if (bank.subject.startsWith("Mathematics ")) return `Maths ${bank.subject.replace("Mathematics ", "")}`;
  return bank.subject;
}

export function DashboardContent({ authenticated, accessibleBanks, availableBanks = BANKS }: { authenticated: boolean; accessibleBanks: BankSlug[]; availableBanks?: readonly Bank[] }) {
  const accessible = new Set(accessibleBanks);
  const hasPaidAccess = accessibleBanks.length > 0;
  const cambridgeSubjects = [...new Set(availableBanks.filter((bank) => bank.qualification === "Cambridge IGCSE").map((bank) => bank.subject.replace(/\s+\d{4}$/, "")))];
  const cambridgeGroups: BankGroup[] = cambridgeSubjects.map((subject) => ({
    name: subject,
    className: `cambridge-${subject.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    tone: courseToneForBank(availableBanks.find((bank) => bank.qualification === "Cambridge IGCSE" && bank.subject.replace(/\s+\d{4}$/, "") === subject)!),
    banks: availableBanks.filter((bank) => bank.qualification === "Cambridge IGCSE" && bank.subject.replace(/\s+\d{4}$/, "") === subject),
  })).filter(({ banks }) => banks.length > 0);
  const groups: BankGroup[] = [
    ...cambridgeGroups,
    { name: "Analysis and Approaches", className: "ib-aa", tone: "math" as const, banks: availableBanks.filter((bank) => bank.slug === "ib-hl" || bank.slug === "ib-sl") },
    { name: "Applications and Interpretation", className: "ib-ai", tone: "math" as const, banks: availableBanks.filter((bank) => bank.slug === "ib-ai-hl" || bank.slug === "ib-ai-sl") },
    { name: "Chemistry", className: "ib-chemistry", tone: "chemistry" as const, banks: availableBanks.filter((bank) => bank.slug === "ib-chemistry-hl" || bank.slug === "ib-chemistry-sl") },
    { name: "Physics", className: "ib-physics", tone: "physics" as const, banks: availableBanks.filter((bank) => bank.slug === "ib-physics-hl" || bank.slug === "ib-physics-sl") },
    { name: "Biology", className: "ib-biology", tone: "biology" as const, banks: availableBanks.filter((bank) => bank.slug === "ib-biology-hl" || bank.slug === "ib-biology-sl") },
    { name: "Economics", className: "ib-economics", tone: "economics" as const, banks: availableBanks.filter((bank) => bank.slug === "ib-economics-hl" || bank.slug === "ib-economics-sl") },
  ].filter(({ banks }) => banks.length > 0).sort((a, b) => Number(b.banks.some((bank) => accessible.has(bank.slug))) - Number(a.banks.some((bank) => accessible.has(bank.slug))));
  const qualificationGroups = [
    { id: "cambridge-igcse", label: "Cambridge IGCSE", groups: groups.filter((group) => group.className.startsWith("cambridge-")) },
    { id: "ib-diploma", label: "IB Diploma", groups: groups.filter((group) => !group.className.startsWith("cambridge-")) },
  ].filter((qualification) => qualification.groups.length > 0);
  const qualificationPanels = qualificationGroups.map((qualification) => ({
    id: qualification.id,
    label: qualification.label,
    panel: <div className={`dashboard-bank-groups${qualification.id === "cambridge-igcse" ? " dashboard-cambridge-subject-grid" : ""}`}>{qualification.groups.map((group) => <section className={`dashboard-bank-family dashboard-bank-family-${group.className} course-tone-${group.tone}`} data-subject-tone={group.tone} key={group.name} aria-labelledby={`dashboard-${group.className}`}>
      <header><div className="dashboard-bank-family-title"><CourseIcon tone={group.tone} /><h2 id={`dashboard-${group.className}`}>{group.name}</h2></div><span>{group.banks.length} banks</span></header>
      <div className="dashboard-bank-grid">{[...group.banks].sort((a, b) => Number(accessible.has(b.slug)) - Number(accessible.has(a.slug))).map((bank) => { const included = accessible.has(bank.slug); const free = hasFreeTier(bank.slug); const openCopy = included ? { label: "Open the full bank", hint: "All questions and mark schemes" } : free ? { label: "Start free", hint: "Complete older exam years" } : { label: "Open bank", hint: "Unlocks with any plan" }; return <Link className={`dashboard-bank-card course-tone-${courseToneForBank(bank)} ${bank.accent}${included ? " is-included" : ""}`} href={included || !free ? `/banks/${bank.slug}` : bankEntryHref(bank.slug)} data-has-free-tier={free ? "true" : undefined} aria-label={`${included || !free ? "Open" : "Start free"} ${bank.shortName}`} key={bank.slug}><div className="dashboard-bank-meta"><strong>{included ? "Included" : free ? "Free exam years" : "Paid bank"}</strong></div><h3>{displayBankName(bank)}</h3><div className="dashboard-bank-stats"><span>{bank.questionCount.toLocaleString()} questions</span><span>{bank.paperCount} papers</span></div><span className="dashboard-bank-link">{openCopy.label}<small>{openCopy.hint}</small><ArrowRight weight="bold" /></span></Link>; })}</div>
      <span className="dashboard-bank-family-watermark" data-subject-watermark="true" aria-hidden="true"><CourseIcon tone={group.tone} marker={false} /></span>
    </section>)}</div>,
  }));
  return (
    <section className="dashboard-page dashboard-study-desk shell">
      <header className="dashboard-heading"><div><p className="eyebrow">Question banks</p><h1>{hasPaidAccess ? "Your study desk" : "Start practising"}</h1><p>{hasPaidAccess ? "Open an included bank or sample another course with free questions." : "Pick your course and start with complete older exam years for free."}</p></div>{authenticated ? <details className="dashboard-settings"><summary><Gear /> Account & settings <CaretDown /></summary><div className="dashboard-actions"><Link href="/pricing"><Gear /> Manage plan</Link><Link href="/account"><Gear /> My account</Link><Link href="/account/password"><Key /> Password settings</Link></div></details> : null}</header>
      {!hasPaidAccess && <aside className="dashboard-upgrade-strip"><div><strong>Ready for the complete bank?</strong><span>Unlock one course from $6/month, or build a two-bank plan from $10/month.</span></div><Link className="button secondary" href="/pricing">View plans <ArrowRight weight="bold" /></Link></aside>}
      {authenticated && <WorksheetList />}
      {qualificationGroups.length > 0 ? <QualificationTabs items={qualificationPanels} className="dashboard-qualification-tabs" /> : <p className="dashboard-empty-state">No question banks are available right now.</p>}
    </section>
  );
}
