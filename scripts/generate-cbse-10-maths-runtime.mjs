#!/usr/bin/env node
/**
 * Build the CBSE Class 10 Mathematics (Standard 041 + Basic 241) candidate runtime from the pinned source workspace
 * (cbse-10-maths-topic-practice, commit 369d650, built with ../ppp-ingestion-toolkit 40de9ef; every gate passes, including cbse.served_marks_reviewed, 0 waivers;
 * coverage receipt PASS). Every input is SHA-256 pinned; any drift fails closed. The checks and the output shape live in
 * scripts/cbse-runtime-builder.mjs (shared by every CBSE bank); this file pins the source and holds the bank's decisions.
 *
 * Class 10 Mathematics specifics:
 *   - Two levels, each its own 80-mark, 3-hour paper: Standard (set codes 30/…, paper 1) and Basic (430/…, paper 2). The
 *     app's Standard / Basic / All tabs follow `paper`. Five questions printed in both levels' papers are one canonical
 *     row each, marked `syllabusRoute: "both"`, so they show under both tabs.
 *   - 2023-2026 main (February-March), compartment (July) and the 2026 second exam (May); 156 sets, 10 of them recorded
 *     source gaps (Basic question papers CBSE does not publish), so 146 sets serve questions.
 *   - Fifteen chapters from the CBSE curriculum (it splits NCERT's "Some Applications of Trigonometry" into Trigonometric
 *     Identities and Heights and Distances), 31 content clauses as subtopics. 58 questions held in the source.
 *   - Unread scheme keys served with settled keys, and scheme totals that differ served at the printed marks, each with
 *     its reviewed decision (a "serve" only where every record's scheme crop holds the complete answer); five reviewed transcript fixes and one recorded label audit.
 *
 *   node scripts/generate-cbse-10-maths-runtime.mjs          write the outputs (a finalized runtime is never overwritten)
 *   node scripts/generate-cbse-10-maths-runtime.mjs --check  rebuild and compare with the committed outputs
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as builder from "./cbse-runtime-builder.mjs";

export const CONFIG = {
  bank: "cbse-10-maths",
  code: "cbse10m",
  label: "CBSE Class 10 Maths",
  subject: "Mathematics",
  course: "CBSE Class 10 Mathematics (Standard 041, Basic 241)",
  sourceRepository: "cbse-10-maths-topic-practice",
  defaultSourceRoot: "/Users/sakshamgoel/Documents/ProjectsInternships/cbse-10-maths-topic-practice",
  sourceRootEnv: "PASTPAPERPREP_CBSE_10_MATHS_SOURCE_ROOT",
  sourceCommit: "369d650",
  toolkitCommit: "40de9ef",
  sha256: {
    canonicalManifest: "be5c3fc08300819bac664d96af357e50bc5d7b9fdcbd1bbc93355601a8c6320f",
    labels: "e89c7bcd897a75aec756b1678533bf9bca3faebf42246821e9f6515be9f0533b",
    secondarySubtopics: "c9408f8831b32c959507c3159decd007a0e9cc70e8a960a192706fb48e854de1",
    segmentation: "708b9287210fda5f9b607be71639e12c6d2fb9d43d00ce2af8956bbb6d02faa5",
    heldQuestions: "9bc67b918922d8c378449815f7d88a21faa4b02bd934631b48ad9c1ca47480ad",
    taxonomy: "8fd0bc7ca10b87a22b34a1e6bed76f07e3dc61956f089c8ce40539ef1cedbd5e",
    coverageReceipt: "4f0d5e40c102913fe927715c2d7326cb6402dc33188fd3d1f175aa74397210f6",
    msRowReviews: "e55c2d2d837e812d216dcc67a75ea1e1426edf4cdb114c2506a1a18e5d1757ae",
    mcqKeySettlements: "3c68f6a5ab097539c3cf2e8adbaea191c3a437238471d5846398b3c42506cee4",
    sourceManifest: "67f8f092bd32da68d5d5d52b9f776cc388bb95fc032cdf284751320ace995623",
    /** SHA-256 over the sorted "<file> <sha256>" lines of every top-level blind-results/*.json file. */
    blindResults: "2b0d38b75753a72d6fba9b1ef412dd32b27716b4017f6f55455f34ab5aca0d94",
    transcriptCorrections: "fbec4f6da9e5af8f04dd3ae9afdee69542f18cba72ba42a3cbe4033b185b0f77",
    reviewCorrections: { "label-audit-2026-11-27.json": "a2684679c12f1eb86a807705dcfe5d0dfb2b789ffb693dd5e52d667d7a9404a7" },
  },
  /** Each level's paper: 80 marks, 3 hours (curriculum 2025-26 assessment scheme; every set's maximum). */
  paperFacts: {
    1: { name: "Mathematics (Standard)", durationMinutes: 180, totalMarks: 80 },
    2: { name: "Mathematics (Basic)", durationMinutes: 180, totalMarks: 80 },
  },
  /** The level of each paper number; the app's tabs (src/lib/cbse.ts CBSE_10_MATHS_LEVELS) use the same numbers. */
  levels: { standard: 1, basic: 2 },
  sessions: ["main", "compartment", "second_exam"],
  /** Basic question papers CBSE does not publish (recorded gaps in the source manifest; no mirror had them). */
  sourceGaps: [
    "cbse10m-2024-m-213", "cbse10m-2026-m-211", "cbse10m-2026-m-212", "cbse10m-2026-m-213", "cbse10m-2026-m-221", "cbse10m-2026-m-222",
    "cbse10m-2026-m-223", "cbse10m-2026-m-231", "cbse10m-2026-m-232", "cbse10m-2026-m-233",
  ],
  excludedFromSelfMarking: [],
  twoLetterKeys: {},
  /** Questions whose accessible text is the reviewed fix in transcript-corrections.json, not the blind read. */
  transcriptCorrections: ["cbse10m-2025-m-112-q11", "cbse10m-2026-e-171-q21", "cbse10m-2026-e-282-q20", "cbse10m-2026-m-121-q16", "cbse10m-2026-m-122-q11"],
  expected: {
    canonical: 3884, aliasesInManifest: 2538, held: 58, rows: 3826, servedAliases: 2503, sets: 156, topics: 15, subtopics: 31,
    freeRows: 969, multipleChoice: 1603, structured: 2223, crops: 8619, years: "2023-2026",
  },
  freeYears: [2023],
  taxonomyNote: "Topics are the curriculum's fifteen chapters in curriculum order, grouped by its seven units; subtopics are its content clauses. Standard and Basic share them; each level sits its own paper.",
  aliasNote: "CBSE Class 10 Maths: a question printed again in another set (of either level) maps to its canonical question, from the source workspace's frozen canonical manifest.",
};

export const BANK = CONFIG.bank;
export const sourceRootPath = (environment = process.env) => builder.sourceRootPath(CONFIG, environment);
export const buildRuntime = (options = {}) => builder.buildRuntime(CONFIG, options);
export const reconstructCandidate = builder.reconstructCandidate;
export const createPrivateIndex = (artifact) => builder.createPrivateIndex(CONFIG, artifact);

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  builder.runCli(CONFIG, path.resolve(import.meta.dirname, "..")).catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
