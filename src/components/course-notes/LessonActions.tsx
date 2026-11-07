"use client";

import Link from "next/link";
import { useState } from "react";
import type { PracticeInfo } from "@/lib/course-notes/practice";
import type { ViewLevel } from "@/lib/course-notes/types";
import { useNotesLevel } from "./LevelSwitch";
import { useCourse, useNotesContext } from "./notes-context";
import { trackPracticeClick, trackReport, trackUnderstood } from "./track";
import { useNotesProgress } from "./useNotesProgress";
import styles from "./course-notes.module.css";

export type { PracticeInfo };

const plural = (n: number) => `${n} past-paper question${n === 1 ? "" : "s"}`;

/** `bankPrefix` names the bank in the copy with the level label: "AA" gives "in the AA SL bank". */
export function PractiseBand({ practice, bankPrefix }: { practice: PracticeInfo; bankPrefix: string }) {
  const [level] = useNotesLevel();
  const ctx = useNotesContext();
  const course = useCourse();
  const count = practice.counts[level];
  const other: ViewLevel = level === "base" ? "extension" : "base";
  // An item with nothing at this level (an extension-only item in the base view, AA: HL only in SL) points at the other bank instead.
  const bankLevel = count === 0 && practice.counts[other] > 0 ? other : level;
  const shown = practice.counts[bankLevel];
  // What the band practises: the item (AA, 0580) or the bank subtopic it shares with other lessons (IB Chemistry).
  const topic = practice.name ?? practice.items;
  return (
    <section id="practise" className={styles.practise} data-practise>
      <div>
        <h2>Practise this</h2>
        {shown === 0 ? (
          <p>No past-paper questions on {topic} yet.</p>
        ) : bankLevel !== level ? (
          practice.extensionOnly ? (
            <p>{practice.items}{` is ${course.levels.labels.extensionOnly}. `}<b>{plural(shown)}</b>{practice.name ? <> on {practice.name}</> : null}{` in the ${bankPrefix} `}{course.levels.labels[bankLevel]} bank, each with a mark scheme and a worked explanation.</p>
          ) : (
            <p>{`No ${course.levels.labels[level]} questions on ${topic} yet; `}<b>{shown}</b>{` ${course.bankPhrase.replace("{level}", course.levels.labels[bankLevel])}.`}</p>
          )
        ) : (
          <p><b>{plural(shown)}</b> on {topic}{` in the ${bankPrefix} `}{course.levels.labels[level]} bank, each with a mark scheme and a worked explanation.</p>
        )}
      </div>
      {shown === 0 ? null : <Link className={`${styles.btn} ${styles.btnPrimary}`} href={practice.hrefs[bankLevel]} onClick={() => trackPracticeClick(ctx, course.banks[bankLevel], practice.group)}>Practise {topic} →</Link>}
    </section>
  );
}

export type Neighbour = { item: string; title: string; href: string; level: string };

export const REPORT_ISSUES = [
  { issue: "maths_error", label: "A mistake in the notes" },
  { issue: "unclear", label: "Hard to follow" },
  { issue: "typo", label: "A typo" },
  { issue: "broken", label: "Something is broken" },
  { issue: "other", label: "Something else" },
] as const;

function ReportProblem() {
  const ctx = useNotesContext();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const send = (issue: (typeof REPORT_ISSUES)[number]["issue"]) => {
    trackReport(ctx, issue);
    setSent(true);
    setOpen(false);
  };
  return (
    <div className={styles.report}>
      Something wrong or unclear?{" "}
      {sent ? null : (
        <button type="button" className={styles.link} aria-expanded={open} aria-controls="report-menu" onClick={() => setOpen((value) => !value)}>Report a problem</button>
      )}
      {/* Always mounted and empty first, so screen readers announce the text when it is filled in. */}
      <span role="status">{sent ? "Thanks, we\u2019ll check it." : ""}</span>{" "}
      or email <a href="mailto:hello@pastpaperprep.com">hello@pastpaperprep.com</a>
      {open ? (
        <div id="report-menu" role="group" aria-label="What is wrong?" className={styles.reportMenu}>
          {REPORT_ISSUES.map(({ issue, label }) => (
            <button key={issue} type="button" onClick={() => send(issue)}>{label}</button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function LessonFooter({ item, lessons }: { item: string; lessons: Neighbour[] }) {
  const [level] = useNotesLevel();
  const ctx = useNotesContext();
  const { levels } = useCourse();
  const { understood, mark, unmark } = useNotesProgress();
  const done = understood.has(item);
  // Extension lessons (AA: AHL) are skipped in the base view.
  const visible = lessons.filter((lesson) => lesson.item === item || level === "extension" || lesson.level === levels.base);
  const at = visible.findIndex((lesson) => lesson.item === item);
  const prev = at > 0 ? visible[at - 1] : undefined;
  const next = at >= 0 ? visible[at + 1] : undefined;
  return (
    <footer className={styles.lFoot}>
      <button type="button" className={`${styles.btn} ${styles.got}`} aria-pressed={done} onClick={() => {
          if (done) {
            unmark(item);
            return;
          }
          trackUnderstood(ctx);
          mark(item);
        }}>
        {done ? "Understood ✓" : "I've got this ✓"}
      </button>
      <span className={styles.gotNote} role="status">{done ? "Saved on this device" : ""}</span>
      <div className={styles.pn}>
        {prev ? <Link href={prev.href} rel="prev">← {prev.item} {prev.title}</Link> : <span />}
        {next ? <Link href={next.href} rel="next">{next.item} {next.title} →</Link> : null}
      </div>
      <ReportProblem />
    </footer>
  );
}
