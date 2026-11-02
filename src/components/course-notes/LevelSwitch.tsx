"use client";

import { useCallback, useContext, useSyncExternalStore } from "react";
import { LessonItemContext } from "./notes-context";
import { createPersistedStore } from "./persisted-store";
import { trackLevelSwitch } from "./track";
import styles from "./course-notes.module.css";

export type NotesLevel = "SL" | "HL";
export const LEVEL_KEY = "notes-level";
const LOCAL_EVENT = "notes-level-change";

const store = createPersistedStore(LEVEL_KEY, LOCAL_EVENT);

/** The stored level, read directly (for one-off effects that must not see the hydration default). */
export function readStoredLevel(): NotesLevel {
  return store.read() === "SL" ? "SL" : "HL";
}

/** The student's level. "HL" on the server and during hydration, then the stored choice. */
export function useNotesLevel(): [NotesLevel, (level: NotesLevel) => void] {
  const raw = useSyncExternalStore(store.subscribe, store.read, () => null);
  const set = useCallback((next: NotesLevel) => store.write(next), []);
  return [raw === "SL" ? "SL" : "HL", set];
}

export function LevelSwitch({ level, onChange }: { level: NotesLevel; onChange: (level: NotesLevel) => void }) {
  const lesson = useContext(LessonItemContext);
  return (
    <div className={styles.levelSwitch} role="group" aria-label="Level">
      {(["SL", "HL"] as const).map((entry) => (
        <button key={entry} type="button" aria-pressed={level === entry} onClick={() => {
            if (entry !== level) trackLevelSwitch(lesson ? { lesson, level: entry } : { level: entry });
            onChange(entry);
          }}>
          {entry}
        </button>
      ))}
    </div>
  );
}
