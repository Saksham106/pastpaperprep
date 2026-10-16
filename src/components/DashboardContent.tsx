"use client";

import Link from "next/link";
import { PAGE_NAVIGATION } from "@/components/PageTransition";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CaretDown, Gear, Key } from "@phosphor-icons/react/dist/ssr";
import { QualificationTabs } from "@/components/QualificationTabs";
import { CourseCards, groupCourses, type CourseRow } from "@/components/CourseCards";
import { PRACTICE_MODES } from "@/components/practice-modes";
import { bankEntryHref, hasFreeTier } from "@/lib/access";
import { BANKS, type Bank, type BankSlug } from "@/lib/banks";
import { UPGRADE_PRICE_MONTH } from "@/lib/upgrade-copy";
import { SEARCH_SUBJECTS_PATH, validSearchSubjects } from "@/lib/site-search";

type PaperLinks = Record<string, { href: string; count: number }>;

/** Full-paper links per bank from the static search file, so this per-request page never reads the paper archive. */
function usePaperLinks(): PaperLinks {
  const [links, setLinks] = useState<PaperLinks>({});
  useEffect(() => {
    let live = true;
    fetch(SEARCH_SUBJECTS_PATH).then((response) => response.ok ? response.json() : null).then((value) => {
      if (!live || !validSearchSubjects(value)) return;
      setLinks(Object.fromEntries(value.subjects.filter((subject) => subject.papersHref).map((subject) => [subject.bank, { href: subject.papersHref!, count: subject.paperCount }])));
    }).catch(() => {});
    return () => { live = false; };
  }, []);
  return links;
}

export function DashboardContent({ authenticated, accessibleBanks, availableBanks = BANKS }: { authenticated: boolean; accessibleBanks: BankSlug[]; availableBanks?: readonly Bank[] }) {
  const worksheetTrigger = useRef<HTMLButtonElement>(null);
  const worksheetDialog = useRef<HTMLDialogElement>(null);
  const accessible = new Set(accessibleBanks);
  const paperLinks = usePaperLinks();
  const hasPaidAccess = accessibleBanks.length > 0;
  // Included courses lead, inside each card and across cards.
  const row = (bank: Bank): CourseRow => {
    const included = accessible.has(bank.slug);
    const free = hasFreeTier(bank.slug);
    return { slug: bank.slug, name: bank.shortName, topics: { href: included || !free ? `/banks/${bank.slug}` : bankEntryHref(bank.slug), count: bank.questionCount }, papers: paperLinks[bank.slug], tag: included ? "Included" : undefined, freeTier: free };
  };
  const byAccess = (banks: readonly Bank[]) => [...banks].sort((a, b) => Number(accessible.has(b.slug)) - Number(accessible.has(a.slug)));
  const groupsFor = (qualification: Bank["qualification"]) => groupCourses(byAccess(availableBanks.filter((bank) => bank.qualification === qualification)), row)
    .sort((a, b) => Number(b.rows.some((r) => r.tag)) - Number(a.rows.some((r) => r.tag)));
  const qualificationPanels = ([
    { id: "cambridge-igcse", label: "Cambridge IGCSE", qualification: "igcse", groups: groupsFor("Cambridge IGCSE") },
    { id: "ib-diploma", label: "IB Diploma", qualification: "ib", groups: groupsFor("International Baccalaureate") },
  ] as const).filter((panel) => panel.groups.length > 0).map((panel) => ({ id: panel.id, label: panel.label, qualification: panel.qualification, panel: <CourseCards groups={panel.groups} pageTransition /> }));
  // A plan says which qualification a student studies, until they pick one themselves.
  const includedIb = availableBanks.filter((bank) => accessible.has(bank.slug) && bank.qualification === "International Baccalaureate").length;
  const includedIgcse = availableBanks.filter((bank) => accessible.has(bank.slug) && bank.qualification === "Cambridge IGCSE").length;
  const preferredQualification = includedIb > includedIgcse ? "ib" : includedIgcse > 0 ? "igcse" : undefined;
  return (
    <section className="dashboard-page dashboard-study-desk shell">
      <header className="dashboard-heading"><div><p className="eyebrow">Question banks</p><h1>{hasPaidAccess ? "Your study desk" : "Start practising"}</h1><p>{hasPaidAccess ? "Open an included bank or sample another course with free questions." : "Pick your course and start with its free exam years."}</p></div>{authenticated ? <div className="dashboard-heading-actions">{hasPaidAccess ? <Link transitionTypes={PAGE_NAVIGATION} className="dashboard-worksheets-link" href="/worksheets">My worksheets <ArrowRight weight="bold" /></Link> : <button ref={worksheetTrigger} type="button" className="dashboard-worksheets-link" onClick={() => worksheetDialog.current?.showModal()}>My worksheets <ArrowRight weight="bold" /></button>}<details className="dashboard-settings"><summary><Gear /> Account & settings <CaretDown /></summary><div className="dashboard-actions"><Link transitionTypes={PAGE_NAVIGATION} href={hasPaidAccess ? "/account/subscription" : "/pricing"}><Gear /> {hasPaidAccess ? "View your access" : "View plans"}</Link><Link transitionTypes={PAGE_NAVIGATION} href="/account"><Gear /> My account</Link><Link transitionTypes={PAGE_NAVIGATION} href="/account/password"><Key /> Password settings</Link></div></details></div> : null}</header>
      {!hasPaidAccess && <section className="dashboard-plan-card" aria-label="Your plan: Free"><div><p className="eyebrow">Your plan · Free</p><strong>You have the free exam years of every bank.</strong><span>Plans add the newest papers, every mark scheme and PDFs. From {UPGRADE_PRICE_MONTH}.</span></div><Link transitionTypes={PAGE_NAVIGATION} className="button primary" href="/pricing?from=dashboard">See plans <ArrowRight weight="bold" /></Link></section>}
      <div className="dashboard-qualification-row">{qualificationPanels.length > 0 ? <QualificationTabs items={qualificationPanels} className="dashboard-qualification-tabs" modes={PRACTICE_MODES} preferredQualification={preferredQualification} /> : <p className="dashboard-empty-state">No question banks are available right now.</p>}</div>
      {authenticated && !hasPaidAccess && <dialog ref={worksheetDialog} className="dashboard-worksheets-dialog" aria-labelledby="dashboard-worksheets-dialog-title" onCancel={(event) => { event.preventDefault(); worksheetDialog.current?.close(); }} onClose={() => worksheetTrigger.current?.focus()}><h2 id="dashboard-worksheets-dialog-title">Unlock worksheets</h2><p>Worksheets and PDF exports need a plan.</p><div className="dashboard-worksheets-dialog-actions"><Link transitionTypes={PAGE_NAVIGATION} className="button primary" href="/pricing" onClick={() => worksheetDialog.current?.close()}>See plans</Link><button type="button" className="button secondary" onClick={() => worksheetDialog.current?.close()}>Not now</button></div></dialog>}
    </section>
  );
}
