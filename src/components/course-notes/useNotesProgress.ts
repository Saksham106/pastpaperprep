"use client";

import { useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { CourseContext } from "./notes-context";
import { createPersistedStore } from "./persisted-store";

/** AA's key; every course stores its own set under "notes-progress:<slug>". */
export const PROGRESS_KEY = "notes-progress:ib-math-aa";

const stores = new Map<string, ReturnType<typeof createPersistedStore>>();
function storeFor(key: string) {
  let store = stores.get(key);
  if (!store) {
    store = createPersistedStore(key, `${key}-change`);
    stores.set(key, store);
  }
  return store;
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

/** Understood lessons. Empty on the server and during hydration, then the stored set; synced across tabs. */
export function useNotesProgress() {
  const { progressKey } = useContext(CourseContext);
  const store = storeFor(progressKey);
  const raw = useSyncExternalStore(store.subscribe, store.read, () => null);
  const understood = useMemo(() => new Set(parse(raw)), [raw]);
  const mark = useCallback((item: string) => store.write(JSON.stringify([...new Set([...parse(store.read()), item])])), [store]);
  const unmark = useCallback((item: string) => store.write(JSON.stringify(parse(store.read()).filter((entry) => entry !== item))), [store]);
  return { understood, mark, unmark };
}
