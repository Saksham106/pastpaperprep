"use client";

import { useSyncExternalStore } from "react";
import { annualSaleLiveInBrowser } from "@/lib/annual-sale";

// Re-check once a minute so an open tab drops the sale price when the window closes.
function subscribe(onChange: () => void) {
  const timer = window.setInterval(onChange, 60_000);
  return () => window.clearInterval(timer);
}

/** False on the server and in the static HTML; true in the browser while the sale is live. */
export function useAnnualSaleLive(): boolean {
  return useSyncExternalStore(subscribe, annualSaleLiveInBrowser, () => false);
}
