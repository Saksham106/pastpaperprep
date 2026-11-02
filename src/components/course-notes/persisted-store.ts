"use client";

/**
 * A string value kept in a module-level snapshot and best-effort persisted to localStorage.
 * The snapshot is the source of truth for the page, so with blocked or full storage a write
 * still updates the UI (it just does not survive a reload). Other tabs sync via the `storage` event.
 * Use with useSyncExternalStore: `subscribe` and `read` are stable, and the caller passes its own
 * server snapshot, so server and hydration renders are unaffected.
 */
const stores: Array<() => void> = [];

/** Drop every store's snapshot so the next read goes back to storage (tests only). */
export function resetPersistedStoresForTests() {
  for (const reset of stores) reset();
}

export function createPersistedStore(key: string, localEvent: string) {
  // undefined = not read from storage yet.
  let snapshot: string | null | undefined;

  function read(): string | null {
    if (snapshot === undefined) {
      try {
        snapshot = window.localStorage.getItem(key);
      } catch {
        snapshot = null;
      }
    }
    return snapshot;
  }

  function write(value: string) {
    snapshot = value;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Not persisted (private mode, quota); the snapshot still updates this tab.
    }
    window.dispatchEvent(new Event(localEvent));
  }

  function subscribe(onChange: () => void) {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== key) return;
      // Another tab changed storage (key === null means it was cleared).
      snapshot = event.key === null ? null : event.newValue;
      onChange();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(localEvent, onChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(localEvent, onChange);
    };
  }

  function resetForTests() {
    snapshot = undefined;
  }

  stores.push(resetForTests);
  return { read, write, subscribe };
}
