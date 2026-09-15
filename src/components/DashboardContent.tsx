"use client";

import Link from "next/link";
import { ArrowRight, CaretDown, Gear, Key } from "@phosphor-icons/react/dist/ssr";
import { useRef, useState, type KeyboardEvent } from "react";
import { CourseIcon, courseToneForBank, type CourseTone } from "@/components/CourseIcon";
import { BANKS, type Bank, type BankSlug } from "@/lib/banks";

type BankGroup = { name: string; className: string; tone: CourseTone; banks: Bank[] };
const CARD_NAMES: Partial<Record<BankSlug, string>> = {
  igcse: "Mathematics 0580", "igcse-additional": "Additional Mathematics 0606", "ib-hl": "Maths AA HL", "ib-sl": "Maths AA SL",
  "ib-ai-hl": "Maths AI HL", "ib-ai-sl": "Maths AI SL", "ib-chemistry-hl": "Chemistry HL", "ib-chemistry-sl": "Chemistry SL",
  "ib-physics-hl": "Physics HL", "ib-physics-sl": "Physics SL", "ib-biology-hl": "Biology HL", "ib-biology-sl": "Biology SL",
  "ib-economics-hl": "Economics HL", "ib-economics-sl": "Economics SL", "igcse-biology-0610": "Biology 0610",
  "igcse-economics-0455": "Economics 0455", "igcse-chemistry-0620": "Chemistry 0620", "igcse-physics-0625": "Physics 0625",
};

export function DashboardContent({ authenticated, accessibleBanks, availableBanks = BANKS }: { authenticated: boolean; accessibleBanks: BankSlug[]; availableBanks?: readonly Bank[] }) {
  const accessible = new Set(accessibleBanks);
  const hasPaidAccess = accessibleBanks.length > 0;
  const groups: BankGroup[] = [
    { name: "Cambridge IGCSE", className: "cambridge", tone: "math" as const, banks: availableBanks.filter((bank) => bank.qualification === "Cambridge IGCSE") },
    { name: "IB Analysis and Approaches", className: "ib-aa", tone: "math" as const, banks: availableBanks.filter((bank) => bank.slug === "ib-hl" || bank.slug === "ib-sl") },
    { name: "IB Applications and Interpretation", className: "ib-ai", tone: "math" as const, banks: availableBanks.filter((bank) => bank.slug === "ib-ai-hl" || bank.slug === "ib-ai-sl") },
    { name: "IB Chemistry", className: "ib-chemistry", tone: "chemistry" as const, banks: availableBanks.filter((bank) => bank.slug === "ib-chemistry-hl" || bank.slug === "ib-chemistry-sl") },
    { name: "IB Physics", className: "ib-physics", tone: "physics" as const, banks: availableBanks.filter((bank) => bank.slug === "ib-physics-hl" || bank.slug === "ib-physics-sl") },
    { name: "IB Biology", className: "ib-biology", tone: "biology" as const, banks: availableBanks.filter((bank) => bank.slug === "ib-biology-hl" || bank.slug === "ib-biology-sl") },
    { name: "IB Economics", className: "ib-economics", tone: "economics" as const, banks: availableBanks.filter((bank) => bank.slug === "ib-economics-hl" || bank.slug === "ib-economics-sl") },
  ].filter(({ banks }) => banks.length > 0).sort((a, b) => Number(b.banks.some((bank) => accessible.has(bank.slug))) - Number(a.banks.some((bank) => accessible.has(bank.slug))));
  const qualificationGroups = [
    { id: "cambridge-igcse", label: "Cambridge IGCSE", groups: groups.filter((group) => group.className === "cambridge") },
    { id: "ib-diploma", label: "IB Diploma", groups: groups.filter((group) => group.className !== "cambridge") },
  ].filter((qualification) => qualification.groups.length > 0);
  const [activeQualification, setActiveQualification] = useState(0);
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % qualificationGroups.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + qualificationGroups.length) % qualificationGroups.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = qualificationGroups.length - 1;
    else return;
    event.preventDefault(); setActiveQualification(next); tabsRef.current[next]?.focus();
  };
  return (
    <section className="dashboard-page dashboard-study-desk shell">
      <header className="dashboard-heading"><div><p className="eyebrow">Question banks</p><h1>{hasPaidAccess ? "Your study desk" : "Start practising"}</h1><p>{hasPaidAccess ? "Open an included bank or sample another course with free questions." : "Pick your course and start with complete older exam years for free."}</p></div>{authenticated ? <details className="dashboard-settings"><summary><Gear /> Account & settings <CaretDown /></summary><div className="dashboard-actions"><Link href="/pricing"><Gear /> Manage plan</Link><Link href="/account"><Gear /> My account</Link><Link href="/account/password"><Key /> Password settings</Link></div></details> : null}</header>
      {!hasPaidAccess && <aside className="dashboard-upgrade-strip"><div><strong>Ready for the complete bank?</strong><span>Unlock one course from $5/month, or get both levels in a subject pair.</span></div><Link className="button secondary" href="/pricing">View plans <ArrowRight weight="bold" /></Link></aside>}
      {qualificationGroups.length > 0 ? <>
        <div className="dashboard-qualification-tabs" role="tablist" aria-label="Choose a qualification">{qualificationGroups.map((qualification, index) => <button key={qualification.id} id={`${qualification.id}-tab`} ref={(node) => { tabsRef.current[index] = node; }} type="button" role="tab" aria-selected={activeQualification === index} aria-controls={`${qualification.id}-panel`} tabIndex={activeQualification === index ? 0 : -1} onClick={() => setActiveQualification(index)} onKeyDown={(event) => onTabKeyDown(event, index)}>{qualification.label}</button>)}</div>
        {qualificationGroups.map((qualification, index) => <div className="dashboard-qualification-panel" id={`${qualification.id}-panel`} role="tabpanel" aria-labelledby={`${qualification.id}-tab`} hidden={activeQualification !== index} key={qualification.id}>
          <div className="dashboard-bank-groups">{qualification.groups.map((group) => <section className={`dashboard-bank-family dashboard-bank-family-${group.className} course-tone-${group.tone}`} key={group.name} aria-labelledby={`dashboard-${group.className}`}>
            <header><div className="dashboard-bank-family-title"><CourseIcon tone={group.tone} /><h2 id={`dashboard-${group.className}`}>{group.name}</h2></div><span>{group.banks.length} banks</span></header>
            <div className="dashboard-bank-grid">{[...group.banks].sort((a, b) => Number(accessible.has(b.slug)) - Number(accessible.has(a.slug))).map((bank) => { const included = accessible.has(bank.slug); return <Link className={`dashboard-bank-card course-tone-${courseToneForBank(bank)} ${bank.accent}${included ? " is-included" : ""}`} href={included ? `/banks/${bank.slug}` : `/banks/${bank.slug}?free=1`} aria-label={`${included ? "Open" : "Start free"} ${bank.shortName}`} key={bank.slug}><div className="dashboard-bank-meta"><strong>{included ? "Included" : "Free exam years"}</strong></div><h3>{CARD_NAMES[bank.slug] ?? bank.shortName}</h3><div className="dashboard-bank-stats"><span>{bank.questionCount.toLocaleString()} questions</span><span>{bank.paperCount} papers</span></div><span className="dashboard-bank-link">{included ? "Open bank" : "Start free"} <ArrowRight weight="bold" /></span></Link>; })}</div>
          </section>)}</div>
        </div>)}
      </> : <p className="dashboard-empty-state">No question banks are available right now.</p>}
    </section>
  );
}
