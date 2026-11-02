"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { createPersistedStore } from "./persisted-store";

export const PROGRESS_KEY = "notes-progress:ib-math-aa";
const LOCAL_EVENT = "notes-progress-change";

const store = createPersistedStore(PROGRESS_KEY, LOCAL_EVENT);

function parse(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

const write = (items: string[]) => store.write(JSON.stringify(items));

/** Understood lessons. Empty on the server and during hydration, then the stored set; synced across tabs. */
export function useNotesProgress() {
  const raw = useSyncExternalStore(store.subscribe, store.read, () => null);
  const understood = useMemo(() => new Set(parse(raw)), [raw]);
  const mark = useCallback((item: string) => write([...new Set([...parse(store.read()), item])]), []);
  const unmark = useCallback((item: string) => write(parse(store.read()).filter((entry) => entry !== item)), []);
  return { understood, mark, unmark };
}
