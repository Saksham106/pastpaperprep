import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { Bank } from "@/lib/banks";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { subjectGroups } from "@/components/CourseCards";
import { CourseIcon } from "@/components/CourseIcon";
import { PAGE_NAVIGATION } from "@/components/PageTransition";
import { QualificationTabs } from "@/components/QualificationTabs";
import { notesRows } from "@/lib/notes-home";
import cards from "./CourseCards.module.css";
import styles from "./NotesHome.module.css";

/** Subject cards for one qualification: a row per course, linked when its notes are out, "Coming soon" otherwise. */
function NotesCards({ banks }: { banks: readonly Bank[] }) {
  return <div className={cards.grid}>{subjectGroups(banks).map((group) => <section className={`${cards.card} course-tone-${group.tone}`} data-subject-tone={group.tone} key={group.name}>
    <header className={cards.head}><h3>{group.name}</h3><span className={cards.mark}><CourseIcon tone={group.tone} /></span></header>
    <div className={cards.rows}>{notesRows(group.banks).map((row) => row.notes
      ? <Link key={row.key} className={cards.row} transitionTypes={PAGE_NAVIGATION} href={row.notes.href} data-notes={row.key}>
          <strong>{row.name}{row.level && <em>{row.level}</em>}</strong><span>{row.notes.label}</span><ArrowRight aria-hidden="true" weight="bold" />
        </Link>
      : <div key={row.key} className={`${cards.row} ${styles.soon}`} data-notes-soon={row.key}>
          <strong>{row.name}{row.level && <em>{row.level}</em>}</strong><span>Coming soon</span>
        </div>)}
    </div>
  </section>)}</div>;
}

export function NotesHome({ banks }: { banks: readonly Bank[] }) {
  const cambridge = banks.filter((bank) => bank.qualification === "Cambridge IGCSE");
  const ib = banks.filter((bank) => bank.qualification === "International Baccalaureate");
  const aLevel = banks.filter((bank) => bank.qualification === "Cambridge A Level");
  return (
    <div className={`${styles.page} shell`}>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Notes" }]} />
      <header className={styles.head}>
        <h1>Revision notes</h1>
        <p>Free notes that follow the syllabus, linked to past-paper practice.</p>
      </header>
      <QualificationTabs items={[
        ...(cambridge.length ? [{ id: "notes-igcse", label: "Cambridge IGCSE", qualification: "igcse" as const, panel: <NotesCards banks={cambridge} /> }] : []),
        ...(ib.length ? [{ id: "notes-ib", label: "IB Diploma", qualification: "ib" as const, panel: <NotesCards banks={ib} /> }] : []),
        ...(aLevel.length ? [{ id: "notes-a-level", label: "Cambridge A Level", qualification: "a-level" as const, panel: <NotesCards banks={aLevel} /> }] : []),
      ]} />
    </div>
  );
}
