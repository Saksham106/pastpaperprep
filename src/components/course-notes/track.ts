import { trackProductEvent } from "@/lib/product-analytics";

/**
 * One typed helper per course-notes event. Every property is an id, a boolean or a value from a fixed set:
 * never free text, a query, or a URL.
 */
export type NotesContext = {
  /** Syllabus item number, e.g. "5.16". Absent on course-home and topic pages. */
  lesson?: string;
  level: "SL" | "HL";
};

export type ReportIssue = "maths_error" | "unclear" | "typo" | "broken" | "other";

export const trackLessonView = (ctx: NotesContext) => trackProductEvent("notes_lesson_view", { ...ctx });

export const trackExampleStep = (ctx: NotesContext, example: string, step: number | "all") =>
  trackProductEvent("notes_example_step", { ...ctx, example, step });

export const trackCheckAnswer = (ctx: NotesContext, check: string, correct: boolean) =>
  trackProductEvent("notes_check_answer", { ...ctx, check, correct });

export const trackGlossaryOpen = (ctx: NotesContext, term: string) =>
  trackProductEvent("notes_glossary_open", { ...ctx, term });

export const trackPracticeClick = (ctx: NotesContext, bank: "ib-sl" | "ib-hl", group: string) =>
  trackProductEvent("notes_practice_click", { ...ctx, bank, group });

export const trackUnderstood = (ctx: NotesContext) => trackProductEvent("notes_understood", { ...ctx });

/** `ctx.level` is the new level. */
export const trackLevelSwitch = (ctx: NotesContext) => trackProductEvent("notes_level_switch", { ...ctx });

/** Only whether anything matched. The query text never leaves the page. */
export const trackSearch = (ctx: NotesContext, found: boolean) => trackProductEvent("notes_search", { ...ctx, found });

export const trackReport = (ctx: NotesContext, issue: ReportIssue) => trackProductEvent("notes_report", { ...ctx, issue });

/** `topic` is a topic slug, or "course" for the whole course. */
export const trackCheatsheetPrint = (ctx: NotesContext, topic: string) => trackProductEvent("notes_cheatsheet_print", { topic, level: ctx.level });
