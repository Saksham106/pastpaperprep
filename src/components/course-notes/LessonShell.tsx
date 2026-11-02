"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { readStoredLevel, useNotesLevel } from "./LevelSwitch";
import { LessonItemContext } from "./notes-context";
import { trackLessonView } from "./track";
import styles from "./course-notes.module.css";

/** Page root: carries the student's level as `data-view` so CSS can hide HL-only notes in the SL view. Also the lesson context and the once-per-mount lesson view. */
export function LessonShell({ topic, lesson, children }: { topic: number; lesson?: string; children: ReactNode }) {
  const [level] = useNotesLevel();
  const viewed = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!lesson || viewed.current === lesson) return;
    viewed.current = lesson;
    trackLessonView({ lesson, level: readStoredLevel() });
  }, [lesson]);
  return (
    <LessonItemContext.Provider value={lesson}>
      <div className={`${styles.lessonPage} shell`} data-view={level} style={{ "--tone": `var(--t${topic})`, "--tone-ink": `var(--t${topic}-ink)` } as CSSProperties}>
        {children}
      </div>
    </LessonItemContext.Provider>
  );
}
