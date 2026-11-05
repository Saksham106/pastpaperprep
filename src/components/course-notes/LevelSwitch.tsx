"use client";

import { useCallback, useContext, useSyncExternalStore } from "react";
import type { ClientCourse } from "@/lib/course-notes/client-course";
import type { ViewLevel } from "@/lib/course-notes/types";
import { CourseContext, LessonItemContext } from "./notes-context";
import { createPersistedStore } from "./persisted-store";
import { trackLevelSwitch } from "./track";
import styles from "./course-notes.module.css";

/** AA's key (other courses use "notes-level:<slug>"). The stored value is the level's label, e.g. "SL". */
export const LEVEL_KEY = "notes-level";

const stores = new Map<string, ReturnType<typeof createPersistedStore>>();
function storeFor(key: string) {
  let store = stores.get(key);
  if (!store) {
    store = createPersistedStore(key, `${key}-change`);
    stores.set(key, store);
  }
  return store;
}

const toView = (course: ClientCourse, raw: string | null): ViewLevel => (raw === course.levels.labels.base ? "base" : "extension");

/** The stored level, read directly (for one-off effects that must not see the hydration default). */
export function readStoredLevel(course: ClientCourse): ViewLevel {
  return toView(course, storeFor(course.levelKey).read());
}

/** The student's view. "extension" (AA: HL) on the server and during hydration, then the stored choice. */
export function useNotesLevel(): [ViewLevel, (level: ViewLevel) => void] {
  const course = useContext(CourseContext);
  const store = storeFor(course.levelKey);
  const raw = useSyncExternalStore(store.subscribe, store.read, () => null);
  const labels = course.levels.labels;
  const set = useCallback((next: ViewLevel) => store.write(labels[next]), [store, labels]);
  return [toView(course, raw), set];
}

export function LevelSwitch({ level, onChange }: { level: ViewLevel; onChange: (level: ViewLevel) => void }) {
  const lesson = useContext(LessonItemContext);
  const course = useContext(CourseContext);
  return (
    <div className={styles.levelSwitch} role="group" aria-label="Level">
      {(["base", "extension"] as const).map((entry) => (
        <button key={entry} type="button" aria-pressed={level === entry} onClick={() => {
            if (entry !== level) trackLevelSwitch({ ...(lesson ? { lesson } : {}), level: course.levels.labels[entry], ...(course.analyticsCourse ? { course: course.analyticsCourse } : {}) });
            onChange(entry);
          }}>
          {course.levels.labels[entry]}
        </button>
      ))}
    </div>
  );
}
