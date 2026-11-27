// Browser-safe settings for the site-wide helper (the one students open from any page). It shares the per-question
// helper's name, face, daily allowance and turn limits (src/lib/helper/config.ts).
import type { HelperBoard } from "@/lib/helper/config";

/**
 * Boards whose banks, topics and papers the site helper can find and open. All on, like the question helper's
 * HELPER_BOARDS. Separate so navigation can stay on for a board even if its question content is ever switched off:
 * the site helper only handles names and links already public in the site search.
 */
export const HELPER_SITE_BOARDS: Readonly<Record<HelperBoard, boolean>> = { igcse: true, "a-level": true, ib: true, cbse: false };

/** Model calls per student message: tool rounds plus the final answer. */
export const HELPER_SITE_MAX_ROUNDS = 5;
/** Pages Pepper may open for one message. */
export const HELPER_SITE_MAX_NAVIGATIONS = 1;

/** Starters under the greeting. They fill the box rather than send, because each needs the student's subject. */
export const HELPER_SITE_STARTERS = [
  { id: "set", label: "Make a practice set", fill: "Make me a 10-question set on " },
  { id: "questions", label: "Find questions", fill: "Find me questions on " },
  { id: "paper", label: "Find a past paper", fill: "Open the past paper for " },
  { id: "explain", label: "Explain a topic", fill: "Explain " },
] as const;

/** Paths where the site helper's button never shows. */
export function siteHelperHidden(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/auth") || pathname.startsWith("/helper/");
}

/** The question Pepper was opened from: attached to the conversation, with its mark scheme. */
export type PepperQuestion = { bank: string; questionId: string; label: string; freePreview: boolean };

/** Opens the one Pepper (mounted in the root layout): with a question from its Ask Pepper button, or the site chat. */
export const PEPPER_OPEN_EVENT = "pastpaperprep:pepper-open";
export type PepperOpenDetail = { question: PepperQuestion | null; opener?: HTMLElement | null };
