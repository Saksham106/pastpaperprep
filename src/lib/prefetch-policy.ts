import type { UrlObject } from "node:url";

/**
 * Per-request pages with no loading.tsx. Next prefetches a dynamic route only down to its
 * nearest loading boundary — the root layout here — so a prefetch runs the page's function and
 * keeps nothing for the click. On 2026-11-08..11 these drew ~35x more renders than visits.
 * (/pricing is left out: it is being made static, which makes its prefetch cheap.)
 */
export const NO_PREFETCH_PATHS: readonly string[] = ["/login", "/worksheets/build"];

export function prefetchesNothing(href: string | UrlObject): boolean {
  const raw = typeof href === "string" ? href : href.pathname ?? "";
  if (!raw.startsWith("/") || raw.startsWith("//")) return false;
  const path = raw.split(/[?#]/)[0];
  return NO_PREFETCH_PATHS.includes(path);
}
