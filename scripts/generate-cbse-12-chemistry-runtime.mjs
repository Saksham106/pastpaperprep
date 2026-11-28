#!/usr/bin/env node
/**
 * Build the CBSE Class 12 Chemistry (043) candidate runtime from the pinned source workspace
 * (cbse-12-chemistry-topic-practice, commit 33bc420, built with ../ppp-ingestion-toolkit 411e001; coverage receipt PASS).
 * Every input is SHA-256 pinned; any drift fails closed.
 *
 *   data/canonical-manifest.json               1,849 canonical questions (75 sets, 2023-2026 main + compartment) and 1,001
 *                                              alias questions: a question printed again in another set maps to its canonical
 *   data/segmentation/full/segmentation.json   every set's questions, crops (path + SHA-256), marks, MCQ keys, scheme notices
 *   data/classification/final-labels.json      1,844 labels: primary chapter, primary subtopic, secondary chapters
 *   data/classification/secondary-subtopics.json   reviewed overlay: the subtopics each secondary chapter (and any further
 *                                              subtopic of the primary chapter) earns marks for, with evidence
 *   data/classification/blind-results/*.json   blind-pass transcripts, used as accessible text (one per labelled question)
 *   data/taxonomy/taxonomy.json                10 chapters (cbse12c:2023:<n>) and 74 subtopics, CBSE curriculum 2025-26
 *   data/held-questions.json                   5 held, never served (no official scheme answer; 4 scheme render defects)
 *   data/review/ms-row-reviews.json            7 reviewed marking-scheme totals that differ from the printed marks: all served
 *                                              at the question paper's printed marks
 *   data/source-manifest.json                  the official cbse.gov.in zip each set came from
 *   data/coverage-receipt.json                 PASS
 *
 * CBSE specifics carried into the rows:
 *   - One theory paper (70 marks, 3 hours). `paper` is 1; the printed set code ("56/1/1") is `zone` and `component`;
 *     `session` is "Main" (February-March) or "Compartment" (July).
 *   - "OR" alternatives are separate rows with the printed number; the row's `label` reads "20 (OR)".
 *   - Multiple choice: CBSE's official key is `answer` with official provenance; a settled two-letter key adds
 *     `acceptedAnswers`. Six items whose scheme awards the mark for any option (printing errors) are served with
 *     `excludedFromSelfMarking: true` and no letter, so students see the scheme's own words instead of a key.
 *
 * Writes src/data/production/cbse-12-chemistry.json, src/data/private-index/cbse-12-chemistry.json,
 * src/data/cbse-12-chemistry-taxonomy.json and the bank's alias ids in src/data/question-id-aliases.json.
 * The runtime stays a candidate until the owner-approved R2 upload is read back and it is finalized.
 *
 * The checks and the output shape live in scripts/cbse-runtime-builder.mjs (shared by every CBSE bank); this file pins the
 * source and holds the bank's reviewed decisions.
 *
 *   node scripts/generate-cbse-12-chemistry-runtime.mjs          write the outputs (a finalized runtime is never overwritten)
 *   node scripts/generate-cbse-12-chemistry-runtime.mjs --check  rebuild and compare with the committed outputs (for a
 *                                                                finalized runtime, with its reconstructed candidate)
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as builder from "./cbse-runtime-builder.mjs";

export const CONFIG = {
  bank: "cbse-12-chemistry",
  code: "cbse12c",
  label: "CBSE Chemistry",
  subject: "Chemistry",
  course: "CBSE Class 12 Chemistry (043)",
  sourceRepository: "cbse-12-chemistry-topic-practice",
  defaultSourceRoot: "/Users/sakshamgoel/Documents/ProjectsInternships/cbse-12-chemistry-topic-practice",
  sourceRootEnv: "PASTPAPERPREP_CBSE_12_CHEMISTRY_SOURCE_ROOT",
  sourceCommit: "33bc420",
  toolkitCommit: "411e001",
  sha256: {
    canonicalManifest: "101ce00d5888691ffc078278707b99d7cde9af89524b163a8f0ebdb426d3f42e",
    labels: "f7102a180f32b0d27e024a2fc47f770ef103796515f91eeb2fe40bbf125205b7",
    secondarySubtopics: "eb074643bf2ffce327b525d8a2542b85c16243c33c7b2db8b8072432ef4f1dff",
    segmentation: "5421570c479edfba3350088af798e8f4b485a37ab928fcb3279a0e6c185b3cf1",
    heldQuestions: "b23b5bfbc71a3fa03ed154659de81d4ac56d7738d0caf708e221cc8f693c7ffb",
    taxonomy: "e186036140c4433457f01b7f8ed8bcaa2d31bdf03dc01c8a35fe69ec00ee499b",
    coverageReceipt: "b3bceeb54b016ab08febdaa0162897775d4b5a955faa1e22a06ac2c3e4f88655",
    msRowReviews: "44d1935789b603b69b85ca07a0c9fd50f0f0af6d5679fc149e9bae7e948aa147",
    sourceManifest: "f26eab45f1aac71da98b5700cce587b9b754fe7bba86f2f92edad54f4359ce92",
    /** SHA-256 over the sorted "<file> <sha256>" lines of every top-level blind-results/*.json file. */
    blindResults: "6e8e9c7a7940b408dbd441afff914e1fe5335d214d9660fbedf680c94eed1c7f",
    /** Reviewed row-level transcript fixes over the blind results (11 rows: marks or symbols the blind read missed). */
    transcriptCorrections: "4d977ba58e8963c4b82bda91036028bd918ac3408d7556185417d80ba8ce1c38",
  },
  /** The CBSE Chemistry (043) theory paper: 70 marks, 3 hours (curriculum 2025-26 assessment scheme; every set prints it). */
  paperFacts: { 1: { name: "Chemistry (Theory)", durationMinutes: 180, totalMarks: 70 } },
  sessions: ["main", "compartment"],
  /** Scheme-notice items (full marks for any option, printing errors): served without a key and never self-marked. */
  excludedFromSelfMarking: [
    "cbse12c-2023-m-111-q13", "cbse12c-2023-m-111-q6", "cbse12c-2023-m-112-q4", "cbse12c-2023-m-133-q9", "cbse12c-2024-m-112-q4", "cbse12c-2025-c-1s2-q14",
  ],
  /** Questions whose accessible text is the reviewed fix in transcript-corrections.json, not the blind read. */
  transcriptCorrections: [
    "cbse12c-2023-m-121-q22", "cbse12c-2023-m-121-q23", "cbse12c-2023-m-121-q24", "cbse12c-2023-m-121-q27", "cbse12c-2023-m-121-q29", "cbse12c-2023-m-121-q31",
    "cbse12c-2023-m-151-q31", "cbse12c-2024-c-1s1-q32-or", "cbse12c-2025-m-121-q32", "cbse12c-2025-m-143-q27", "cbse12c-2026-c-171-q29",
  ],
  /** Settled two-letter official keys (mcq-key-settlements.json): either letter scores. */
  twoLetterKeys: {
    "cbse12c-2023-m-151-q16": ["A", "B"], "cbse12c-2024-m-151-q14": ["A", "B"], "cbse12c-2024-m-152-q15": ["A", "B"], "cbse12c-2024-m-153-q13": ["A", "B"], "cbse12c-2026-m-121-q14": ["A", "B"],
  },
  expected: {
    canonical: 1849, aliasesInManifest: 1001, held: 5, rows: 1844, servedAliases: 997, sets: 75, topics: 10, subtopics: 74,
    freeRows: 448, multipleChoice: 933, structured: 911, crops: 4072, years: "2023-2026",
  },
  freeYears: [2023],
  taxonomyNote: "Topics are the curriculum's ten chapters (units), in curriculum order; subtopics are its content clauses. One theory paper; no earlier-syllabus topics.",
  aliasNote: "CBSE Class 12 Chemistry: a question printed again in another set maps to its canonical question, from the source workspace's frozen canonical manifest.",
};

export const BANK = CONFIG.bank;
export const sourceRootPath = (environment = process.env) => builder.sourceRootPath(CONFIG, environment);
export const buildRuntime = (options = {}) => builder.buildRuntime(CONFIG, options);
export const reconstructCandidate = builder.reconstructCandidate;
export const createPrivateIndex = (artifact) => builder.createPrivateIndex(CONFIG, artifact);

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  builder.runCli(CONFIG, path.resolve(import.meta.dirname, "..")).catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
