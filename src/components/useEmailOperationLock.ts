"use client";

import { useCallback, useRef, useState } from "react";

// React pending state updates after the event. The ref closes that same-turn gap.
export function useEmailOperationLock() {
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const acquire = useCallback(() => {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    return true;
  }, []);
  const release = useCallback(() => {
    locked.current = false;
    setBusy(false);
  }, []);
  return { busy, acquire, release };
}
export type EmailOperationLock = ReturnType<typeof useEmailOperationLock>;
