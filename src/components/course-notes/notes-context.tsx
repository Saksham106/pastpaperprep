"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import aaCourseJson from "@/content/notes/ib-math-aa/course.json";
import { clientCourse, type ClientCourse } from "@/lib/course-notes/client-course";
import type { CourseConfig } from "@/lib/course-notes/config";
import { useNotesLevel } from "./LevelSwitch";
import type { NotesContext } from "./track";

/** The lesson a component sits in. Absent outside a lesson page. */
export const LessonItemContext = createContext<string | undefined>(undefined);

/** AA when no provider is mounted (components rendered on their own, as in unit tests). */
const DEFAULT_COURSE = clientCourse(aaCourseJson as CourseConfig);

/** The course a notes page belongs to: its level labels, banks and storage keys. */
export const CourseContext = createContext<ClientCourse>(DEFAULT_COURSE);

/** Mounted by every course-notes page around its content. Renders no markup. */
export function CourseNotesProvider({ course, children }: { course: ClientCourse; children: ReactNode }) {
  return <CourseContext.Provider value={course}>{children}</CourseContext.Provider>;
}

export const useCourse = (): ClientCourse => useContext(CourseContext);

/** Lesson item plus the student's current level (as the course labels it): the context every notes event carries. */
export function useNotesContext(): NotesContext {
  const lesson = useContext(LessonItemContext);
  const course = useCourse();
  const [view] = useNotesLevel();
  const level = course.levels.labels[view];
  return useMemo(
    () => ({ ...(lesson ? { lesson } : {}), level, ...(course.analyticsCourse ? { course: course.analyticsCourse } : {}) }),
    [lesson, level, course.analyticsCourse],
  );
}
