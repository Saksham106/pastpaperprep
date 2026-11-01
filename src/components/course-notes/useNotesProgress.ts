"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

export const PROGRESS_KEY = "notes-progress:ib-math-aa";
const LOCAL_EVENT = "notes-progress-change";

function read(): string | null {
  try {
    return window.localStorage.getItem(PROGRESS_KEY);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === PROGRESS_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(LOCAL_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(LOCAL_EVENT, onChange);
  };
}

function parse(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

function write(items: string[]) {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(items));
  } catch {
    // Storage unavailable (private mode, quota): progress just won't persist.
  }
  window.dispatchEvent(new Event(LOCAL_EVENT));
}

/** Understood lessons. Empty on the server and during hydration, then the stored set; synced across tabs. */
export function useNotesProgress() {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const understood = useMemo(() => new Set(parse(raw)), [raw]);
  const mark = useCallback((item: string) => write([...new Set([...parse(read()), item])]), []);
  const unmark = useCallback((item: string) => write(parse(read()).filter((entry) => entry !== item)), []);
  return { understood, mark, unmark };
}
