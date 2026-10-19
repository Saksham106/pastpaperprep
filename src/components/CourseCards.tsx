import Link from "next/link";
import { Fragment } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { Bank } from "@/lib/banks";
import { CourseIcon, type CourseTone } from "@/components/CourseIcon";
import { PAGE_NAVIGATION } from "@/components/PageTransition";
import styles from "./CourseCards.module.css";

/** One course inside a subject card: its topic-practice link and, when the library has it, its full papers. */
export type CourseRow = {
  slug: string;
  name: string;
  topics: { href: string; count: number };
  papers?: { href: string; count: number };
  /** Short status beside the name, e.g. "Included" on the dashboard. */
  tag?: string;
  freeTier?: boolean;
};
export type CourseGroup = { name: string; tone: CourseTone; rows: CourseRow[] };

const SUBJECTS: readonly { name: string; tone: CourseTone; matches: (bank: Bank) => boolean }[] = [
  { name: "Mathematics", tone: "math", matches: (bank) => bank.subject.includes("Mathematics") || bank.subject.includes("Additional") },
  { name: "Chemistry", tone: "chemistry", matches: (bank) => bank.subject.includes("Chemistry") },
  { name: "Physics", tone: "physics", matches: (bank) => bank.subject.includes("Physics") },
  { name: "Biology", tone: "biology", matches: (bank) => bank.subject.includes("Biology") },
  { name: "Economics", tone: "economics", matches: (bank) => bank.subject.includes("Economics") },
  { name: "Co-ordinated Sciences", tone: "coordinated", matches: (bank) => bank.subject.includes("Co-ordinated") },
  { name: "Computer Science", tone: "computer-science", matches: (bank) => bank.subject.includes("Computer Science") },
];

/** Banks grouped into the subject cards students recognise, in a fixed subject order. */
export function groupCourses(banks: readonly Bank[], row: (bank: Bank) => CourseRow): CourseGroup[] {
  return SUBJECTS.map((s) => ({ name: s.name, tone: s.tone, rows: banks.filter(s.matches).map(row) })).filter((group) => group.rows.length > 0);
}

/**
 * Pastel subject cards, one row per course. A row shows the topic link or the full-paper link
 * depending on the By topic / Full papers switch (data-mode on an ancestor); courses without
 * full papers keep their topic link in both modes.
 */
export function CourseCards({ groups, pageTransition = false }: { groups: readonly CourseGroup[]; pageTransition?: boolean }) {
  const transition = pageTransition ? PAGE_NAVIGATION : undefined;
  return <div className={styles.grid}>{groups.map((group) => <section className={`${styles.card} course-tone-${group.tone}`} data-subject-tone={group.tone} key={group.name}>
    <header className={styles.head}><h3>{group.name}</h3><span className={styles.mark}><CourseIcon tone={group.tone} /></span></header>
    <div className={styles.rows}>{group.rows.map((row) => <Fragment key={row.slug}>
      <Link className={styles.row} transitionTypes={transition} href={row.topics.href} data-bank-slug={row.slug} data-mode-item={row.papers ? "topics" : undefined} data-has-free-tier={row.freeTier ? "true" : undefined} aria-label={`${row.name}, practice by topic`}>
        <strong>{row.name}{row.tag && <em>{row.tag}</em>}</strong><span>{row.topics.count.toLocaleString("en-US")} questions</span><ArrowRight aria-hidden="true" weight="bold" />
      </Link>
      {row.papers && <Link className={styles.row} transitionTypes={transition} href={row.papers.href} data-papers-slug={row.slug} data-mode-item="papers" aria-label={`${row.name}, full past papers`}>
        <strong>{row.name}{row.tag && <em>{row.tag}</em>}</strong><span>{row.papers.count.toLocaleString("en-US")} papers</span><ArrowRight aria-hidden="true" weight="bold" />
      </Link>}
    </Fragment>)}</div>
  </section>)}</div>;
}
