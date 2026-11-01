"use client";

import Link from "next/link";
import { useState } from "react";
import { trackProductEvent } from "@/lib/product-analytics";
import { useNotesLevel, type NotesLevel } from "./LevelSwitch";
import { useNotesProgress } from "./useNotesProgress";
import styles from "./course-notes.module.css";

export type PracticeInfo = {
  /** Item label for the button and copy, e.g. "5.16" or "3.14–3.18". */
  items: string;
  counts: { SL: number; HL: number };
  hrefs: { SL: string; HL: string };
};

const plural = (n: number) => `${n} past-paper question${n === 1 ? "" : "s"}`;

export function PractiseBand({ practice }: { practice: PracticeInfo }) {
  const [level] = useNotesLevel();
  const count = practice.counts[level];
  const other: NotesLevel = level === "SL" ? "HL" : "SL";
  // A group with nothing at this level (an HL-only group in the SL view) points at the other bank instead.
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
      {shown === 0 ? null : <Link className={`${styles.btn} ${styles.btnPrimary}`} href={practice.hrefs[bankLevel]}>Practise {practice.items} →</Link>}
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

function ReportProblem({ item }: { item: string }) {
  const [level] = useNotesLevel();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const send = (issue: (typeof REPORT_ISSUES)[number]["issue"]) => {
    trackProductEvent("notes_report", { lesson: item, level, issue });
    setSent(true);
    setOpen(false);
  };
  return (
    <div className={styles.report}>
      Something wrong or unclear?{" "}
      {sent ? (
        <span role="status">Thanks, we&apos;ll check it.</span>
      ) : (
        <button type="button" className={styles.link} aria-expanded={open} aria-controls="report-menu" onClick={() => setOpen((value) => !value)}>Report a problem</button>
      )}{" "}
      or email <span>hello@pastpaperprep.com</span>
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
  const { understood, mark, unmark } = useNotesProgress();
  const done = understood.has(item);
  // AHL lessons are skipped in the SL view.
  const visible = lessons.filter((lesson) => lesson.item === item || level === "HL" || lesson.level === "SL");
  const at = visible.findIndex((lesson) => lesson.item === item);
  const prev = at > 0 ? visible[at - 1] : undefined;
  const next = at >= 0 ? visible[at + 1] : undefined;
  return (
    <footer className={styles.lFoot}>
      <button type="button" className={`${styles.btn} ${styles.got}`} aria-pressed={done} onClick={() => (done ? unmark(item) : mark(item))}>
        {done ? "Understood ✓" : "I've got this ✓"}
      </button>
      {done ? <span className={styles.gotNote} role="status">Saved on this device</span> : null}
      <div className={styles.pn}>
        {prev ? <Link href={prev.href} rel="prev">← {prev.item} {prev.title}</Link> : <span />}
        {next ? <Link href={next.href} rel="next">{next.item} {next.title} →</Link> : null}
      </div>
      <ReportProblem item={item} />
    </footer>
  );
}
