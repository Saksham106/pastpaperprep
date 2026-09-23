"use client";

import { track } from "@vercel/analytics";

type ProductEventProperties = Record<string, string | number | boolean | null | undefined>;

export function trackProductEvent(name: string, properties: ProductEventProperties = {}) {
  try {
    track(name, properties);
  } catch {
    // Analytics must never interrupt practice, checkout, or downloads.
  }
}
