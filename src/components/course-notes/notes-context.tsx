"use client";

import { createContext, useContext, useMemo } from "react";
import { useNotesLevel } from "./LevelSwitch";
import type { NotesContext } from "./track";

/** The lesson a component sits in. Absent outside a lesson page. */
export const LessonItemContext = createContext<string | undefined>(undefined);

/** Lesson item plus the student's current level: the context every notes event carries. */
export function useNotesContext(): NotesContext {
  const lesson = useContext(LessonItemContext);
  const [level] = useNotesLevel();
  return useMemo(() => (lesson ? { lesson, level } : { level }), [lesson, level]);
}
