// Browser-safe settings for the site-wide helper (the one students open from any page). It shares the per-question
// helper's name, face, daily allowance and turn limits (src/lib/helper/config.ts).
import type { HelperBoard } from "@/lib/helper/config";

/**
 * Boards whose banks, topics and papers the site helper can find and open. It only ever handles names and links that
 * are already public in the site search, never question content, so IB is on here even while the question helper's
 * IB switch is off. Turn IB off here too if the IB terms check says so.
 */
export const HELPER_SITE_BOARDS: Readonly<Record<HelperBoard, boolean>> = { igcse: true, "a-level": true, ib: true };

/** Model calls per student message: tool rounds plus the final answer. */
export const HELPER_SITE_MAX_ROUNDS = 5;
/** Pages Pepper may open for one message; the browser follows the last. */
export const HELPER_SITE_MAX_NAVIGATIONS = 2;

/** Starters under the greeting. They fill the box rather than send, because each needs the student's subject. */
export const HELPER_SITE_STARTERS = [
  { id: "questions", label: "Find questions", fill: "Find me questions on " },
  { id: "paper", label: "Find a past paper", fill: "Open the past paper for " },
  { id: "explain", label: "Explain a topic", fill: "Explain " },
] as const;

/** Paths where the site helper's button never shows. */
export function siteHelperHidden(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/auth") || pathname.startsWith("/helper/");
}

/** sessionStorage key for the open conversation, so a full reload keeps it. */
export const HELPER_SITE_STORAGE_KEY = "ppp:site-helper:v1";
