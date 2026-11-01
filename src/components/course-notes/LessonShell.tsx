"use client";

import type { CSSProperties, ReactNode } from "react";
import { useNotesLevel } from "./LevelSwitch";
import styles from "./course-notes.module.css";

/** Page root: carries the student's level as `data-view` so CSS can hide HL-only notes in the SL view. */
export function LessonShell({ topic, children }: { topic: number; children: ReactNode }) {
  const [level] = useNotesLevel();
  return (
    <main className={`${styles.lessonPage} shell`} data-view={level} style={{ "--tone": `var(--t${topic})`, "--tone-ink": `var(--t${topic}-ink)` } as CSSProperties}>
      {children}
    </main>
  );
}
