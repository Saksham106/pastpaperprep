"use client";

import { useSyncExternalStore } from "react";

/**
 * How Pepper sits on this screen:
 * - "docked" (desktop): a side panel; the page narrows beside it instead of being covered.
 * - "overlay" (tablet width): a sheet over the right edge, as there isn't room to narrow the page.
 * - "phone": a bottom sheet at half height, the question visible above it.
 */
export type PepperLayout = "docked" | "overlay" | "phone";

const DOCKED = "(min-width: 900px)";
const PHONE = "(max-width: 640px)";

function current(): PepperLayout {
  if (typeof window === "undefined" || !window.matchMedia) return "overlay";
  if (window.matchMedia(PHONE).matches) return "phone";
  return window.matchMedia(DOCKED).matches ? "docked" : "overlay";
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const lists = [window.matchMedia(DOCKED), window.matchMedia(PHONE)];
  for (const list of lists) list.addEventListener?.("change", onChange);
  return () => { for (const list of lists) list.removeEventListener?.("change", onChange); };
}

export function usePepperLayout(): PepperLayout {
  return useSyncExternalStore(subscribe, current, () => "overlay");
}
