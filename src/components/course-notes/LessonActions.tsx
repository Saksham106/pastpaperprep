"use client";

import Link from "next/link";
import { useState } from "react";
import { useNotesLevel, type NotesLevel } from "./LevelSwitch";
import { useNotesContext } from "./notes-context";
import { trackPracticeClick, trackReport, trackUnderstood } from "./track";
import { useNotesProgress } from "./useNotesProgress";
import styles from "./course-notes.module.css";

export type PracticeInfo = {
  /** Taxonomy group id, sent with practice clicks. */
  group: string;
  /** The lesson's syllabus item, for the button and copy, e.g. "5.16". */
  items: string;
  counts: { SL: number; HL: number };
  hrefs: { SL: string; HL: string };
};

const plural = (n: number) => `${n} past-paper question${n === 1 ? "" : "s"}`;

export function PractiseBand({ practice }: { practice: PracticeInfo }) {
  const [level] = useNotesLevel();
  const ctx = useNotesContext();
  const count = practice.counts[level];
  const other: NotesLevel = level === "SL" ? "HL" : "SL";
  // An item with nothing at this level (an HL-only group in the SL view) points at the other bank instead.
  const bankLevel = count === 0 && practice.counts[other] > 0 ? other : level;
  const shown = practice.counts[bankLevel];
  return (
    <section id="practise" className={styles.practise} data-practise>
      <div>
        <h2>Practise this</h2>
        {shown === 0 ? (
          <p>No past-paper questions on {practice.items} yet.</p>
        ) : bankLevel !== level ? (
          <p>{practice.items} is HL only. <b>{plural(shown)}</b> in the AA {bankLevel} bank, each with a mark scheme and a worked explanation.</p>
        ) : (
          <p><b>{plural(shown)}</b> on {practice.items} in the AA {level} bank, each with a mark scheme and a worked explanation.</p>
        )}
      </div>
      {shown === 0 ? null : <Link className={`${styles.btn} ${styles.btnPrimary}`} href={practice.hrefs[bankLevel]} onClick={() => trackPracticeClick(ctx, bankLevel === "SL" ? "ib-sl" : "ib-hl", practice.group)}>Practise {practice.items} →</Link>}
    </section>
  );
}

export type Neighbour = { item: string; title: string; href: string; level: "SL" | "AHL" };

export const REPORT_ISSUES = [
  { issue: "maths_error", label: "A maths error" },
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
  const { understood, mark, unmark } = useNotesProgress();
  const done = understood.has(item);
  // AHL lessons are skipped in the SL view.
  const visible = lessons.filter((lesson) => lesson.item === item || level === "HL" || lesson.level === "SL");
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
