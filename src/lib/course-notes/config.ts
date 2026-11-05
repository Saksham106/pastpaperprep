// Client-safe: the shape of src/content/notes/<course>/course.json. Adding a course is content plus this file.
import type { CourseLevels, PerView } from "./types";

/**
 * How lesson and topic pages build practice links and counts.
 * - `aa-items`: the AA overlay (item tags and taxonomy groups) through the ib-sl / ib-hl banks.
 * - `official-codes`: one bank whose questions carry official section codes as `officialCodeRefs`
 *   (`<refPrefix><code>`); a lesson practises `codes.base` in the base view and `codes.extension` in the
 *   extension view, where `{item}` is the lesson's item ("C{item}" for 1.1 is "C1.1").
 */
export type PracticeConfig =
  | { kind: "aa-items" }
  | { kind: "official-codes"; source: "igcse-0580-section-retrieval-v3"; refPrefix: string; codes: PerView<string> };

/** Words that differ per course. Everything else is built from `name` and the level labels. */
export type CourseCopy = {
  /** Course-home breadcrumb after "Notes", e.g. ["IB", "Maths AA"]. */
  crumbs: string[];
  /** The line under the course-home heading. */
  guide: string;
  /** The cheat sheet's last line. */
  sheetFooter: string;
  /** Exam board, for the command-terms description. */
  board: string;
  /** schema.org `educationalLevel` on lessons. */
  educationalLevel: string;
  /** Names the bank before its level label in a lesson's practise band: "AA" gives "in the AA SL bank". */
  bankPrefix: string;
};

export type CourseConfig = {
  slug: string;
  name: string;
  published: boolean;
  levels: CourseLevels;
  /** Bank slug per level label, e.g. { SL: "ib-sl", HL: "ib-hl" } or { Core: "igcse", Extended: "igcse" }. */
  banks: Record<string, string>;
  /** Repo-relative path of the syllabus items file (the generated index imports it). */
  items: string;
  practice: PracticeConfig;
  /** Lesson gate inputs: the sidecar folder (repo-relative) and the source-pack folder (relative to ../research). */
  gate: { sidecars: string; packs: string };
  copy: CourseCopy;
  topics: { n: number; slug: string; name: string }[];
};
