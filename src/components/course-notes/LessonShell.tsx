"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { readStoredLevel, useNotesLevel } from "./LevelSwitch";
import { LessonItemContext, useCourse } from "./notes-context";
import { trackLessonView } from "./track";
import styles from "./course-notes.module.css";

/**
 * Page root: carries the student's level as `data-view` (the course's label) and `data-base-view` in the base view, so CSS
 * can hide extension-only notes (AA: HL only) in the base view. Also the lesson context and the once-per-mount lesson view.
 */
export function LessonShell({ topic, lesson, children }: { topic: number; lesson?: string; children: ReactNode }) {
  const course = useCourse();
  const [level] = useNotesLevel();
  const viewed = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!lesson || viewed.current === lesson) return;
    viewed.current = lesson;
    trackLessonView({ lesson, level: course.levels.labels[readStoredLevel(course)], ...(course.analyticsCourse ? { course: course.analyticsCourse } : {}) });
  }, [lesson, course]);
  return (
    <LessonItemContext.Provider value={lesson}>
      <div className={`${styles.lessonPage} shell`} data-view={course.levels.labels[level]} data-base-view={level === "base" ? "" : undefined} style={{ "--tone": `var(--t${topic})`, "--tone-ink": `var(--t${topic}-ink)` } as CSSProperties}>
        {children}
      </div>
    </LessonItemContext.Provider>
  );
}
