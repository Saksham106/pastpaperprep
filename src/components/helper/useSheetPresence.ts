"use client";

import { useCallback, useEffect, useState } from "react";

/** Longest the close animation may take before the sheet is removed anyway. */
const EXIT_FALLBACK_MS = 400;

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Open / closing / closed for a helper sheet, so it can slide out before it unmounts. Under reduced motion it closes at
 * once; otherwise the sheet calls `exited` when its leave animation ends (with a timer as a backstop).
 */
export function useSheetPresence() {
  const [state, setState] = useState<"closed" | "open" | "closing">("closed");
  const open = useCallback(() => setState("open"), []);
  const close = useCallback(() => setState((current) => current === "open" ? (prefersReducedMotion() ? "closed" : "closing") : current), []);
  const exited = useCallback(() => setState((current) => current === "closing" ? "closed" : current), []);
  useEffect(() => {
    if (state !== "closing") return;
    const timer = window.setTimeout(exited, EXIT_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [state, exited]);
  return { mounted: state !== "closed", open: state === "open", closing: state === "closing", show: open, hide: close, exited };
}
