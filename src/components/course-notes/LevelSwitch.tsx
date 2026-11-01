"use client";

import { useCallback, useContext, useSyncExternalStore } from "react";
import { LessonItemContext } from "./notes-context";
import { trackLevelSwitch } from "./track";
import styles from "./course-notes.module.css";

export type NotesLevel = "SL" | "HL";
export const LEVEL_KEY = "notes-level";
const LOCAL_EVENT = "notes-level-change";

function read(): string | null {
  try {
    return window.localStorage.getItem(LEVEL_KEY);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === LEVEL_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(LOCAL_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LOCAL_EVENT, onChange);
  };
}

/** The stored level, read directly (for one-off effects that must not see the hydration default). */
export function readStoredLevel(): NotesLevel {
  return read() === "SL" ? "SL" : "HL";
}

/** The student's level. "HL" on the server and during hydration, then the stored choice. */
export function useNotesLevel(): [NotesLevel, (level: NotesLevel) => void] {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const set = useCallback((next: NotesLevel) => {
    try {
      window.localStorage.setItem(LEVEL_KEY, next);
    } catch {
      // Not persisted; the in-tab event below still updates this page.
    }
    window.dispatchEvent(new Event(LOCAL_EVENT));
  }, []);
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
