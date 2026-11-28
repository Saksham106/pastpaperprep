#!/usr/bin/env node
/**
 * Build the CBSE Class 10 Science (086) candidate runtime from the pinned source workspace
 * (cbse-10-science-topic-practice, commit cd87616, built with ../ppp-ingestion-toolkit 247f6b7; coverage receipt PASS with one
 * recorded gate waiver). Every input is SHA-256 pinned; any drift fails closed. The checks and the output shape live in
 * scripts/cbse-runtime-builder.mjs (shared by every CBSE bank); this file pins the source and holds the bank's decisions.
 *
 * Class 10 Science specifics:
 *   - One combined paper (80 marks, 3 hours), 2023-2026: main (February-March), compartment (July) and the 2026 second
 *     board exam (May). The set code ("31/1/1") is `zone` and `component`.
 *   - Thirteen chapters in NCERT order, each in its science (chemistry 1-4, biology 5-8 and 13, physics 9-12): the app
 *     shows Biology / Chemistry / Physics tabs from the chapter. Subtopics are the 53 NCERT sections.
 *   - 144 questions held in the source (mostly scheme marks that do not reconcile, multi-letter keys, and OR parts that are
 *     not whole questions); never served, nor their aliases.
 *   - Gate waiver (coordinator, 2026-11-27, expires 2026-12-15): cbse.segmentation_clean on 13 papers whose 2026 subject
 *     sections leave sums short, and 2023-m-121 Q28's scheme OR lines. Every question the waiver names is held, except
 *     2023-m-121 Q28, reviewed and served; the builder checks each decision against the release.
 *   - One settled two-letter key (2026-m-121 Q8: A or C). No self-marking exclusions.
 *
 *   node scripts/generate-cbse-10-science-runtime.mjs          write the outputs (a finalized runtime is never overwritten)
 *   node scripts/generate-cbse-10-science-runtime.mjs --check  rebuild and compare with the committed outputs
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as builder from "./cbse-runtime-builder.mjs";

export const CONFIG = {
  bank: "cbse-10-science",
  code: "cbse10s",
  label: "CBSE Science",
  subject: "Science",
  course: "CBSE Class 10 Science (086)",
  sourceRepository: "cbse-10-science-topic-practice",
  defaultSourceRoot: "/Users/sakshamgoel/Documents/ProjectsInternships/cbse-10-science-topic-practice",
  sourceRootEnv: "PASTPAPERPREP_CBSE_10_SCIENCE_SOURCE_ROOT",
  sourceCommit: "cd87616",
  toolkitCommit: "247f6b7",
  sha256: {
    canonicalManifest: "b4a8d9c5e0e36f339ea5efbb8b4bee0692aa7f28ab645911e0a042c021f3ab33",
    labels: "5f3c97024f4ecc9ef4ed00334c51b1a665ae8c62ddec8a21da49fa58ceacc0c5",
    secondarySubtopics: "8b7cbb75a069f65dfb5e2d3f029a45b00e9f5340e16ea0126771333554cadb52",
    segmentation: "38e21b360d4dda960c9f049239b6f54a27fc0f6f7a781d76b5266bd9e9773218",
    heldQuestions: "bf381046330b0cb3e5dbc183c6b0d1eec2b80786542ec9092162ba281fd29fb0",
    taxonomy: "c6a1865f58ef545ec4b30bf5fba9929c3dd07358a021866509b0e361694a796f",
    coverageReceipt: "3a98776ba8aaaf82fda173bd8116531c890d5ee703d08c21ffab002f7419f6e9",
    gateWaivers: "de3034f31f6a7e8ce116f8828747efb673c0bfb2df358b08a9abe8aee53c6b09",
    mcqKeySettlements: "b025eb60d8e2d8de557d5ef132495b7584123a07eaa0f021121278f2a442f251",
    sourceManifest: "326b25ac6948f2e8c3ff7bd368e5bf6b35f688e9baae00ec60840a53d37cafa1",
    /** SHA-256 over the sorted "<file> <sha256>" lines of every top-level blind-results/*.json file. */
    blindResults: "a4e0fc3f9eee2025a06afd2b61776d7ce3235d95ce7a2f340c9e47c722b8a3d1",
  },
  /** The CBSE Science (086) paper: 80 marks, 3 hours (curriculum 2025-26 assessment scheme; every set's maximum). */
  paperFacts: { 1: { name: "Science", durationMinutes: 180, totalMarks: 80 } },
  sessions: ["main", "compartment", "second_exam"],
  excludedFromSelfMarking: [],
  /** Settled two-letter official keys (mcq-key-settlements.json): either letter scores. */
  twoLetterKeys: { "cbse10s-2026-m-121-q8": ["A", "C"] },
  waivedGates: ["cbse.segmentation_clean"],
  groupChapters: ["chemistry", "biology", "physics"],
  expected: {
    canonical: 2519, aliasesInManifest: 1052, held: 144, rows: 2375, servedAliases: 966, sets: 78, topics: 13, subtopics: 53,
    freeRows: 510, multipleChoice: 998, structured: 1377, crops: 5317, years: "2023-2026",
  },
  freeYears: [2023],
  taxonomyNote: "Topics are the thirteen NCERT chapters in book order, each in its science (chemistry, biology or physics); subtopics are the NCERT sections. One combined paper; no earlier-syllabus topics.",
  aliasNote: "CBSE Class 10 Science: a question printed again in another set maps to its canonical question, from the source workspace's frozen canonical manifest.",
};

export const BANK = CONFIG.bank;
export const sourceRootPath = (environment = process.env) => builder.sourceRootPath(CONFIG, environment);
export const buildRuntime = (options = {}) => builder.buildRuntime(CONFIG, options);
export const reconstructCandidate = builder.reconstructCandidate;
export const createPrivateIndex = (artifact) => builder.createPrivateIndex(CONFIG, artifact);

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  builder.runCli(CONFIG, path.resolve(import.meta.dirname, "..")).catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
