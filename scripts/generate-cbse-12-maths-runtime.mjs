#!/usr/bin/env node
/**
 * Build the CBSE Class 12 Mathematics (041) candidate runtime from the pinned source workspace (cbse-12-maths-topic-practice,
 * commit ec81723, built with ../ppp-ingestion-toolkit 22063fa; all 53 gates pass, two recorded waivers; coverage receipt PASS).
 * Every input is SHA-256 pinned; any drift fails closed. The checks and the output shape live in scripts/cbse-runtime-builder.mjs
 * (shared by every CBSE bank); this file pins the source and holds the bank's decisions.
 *
 * Class 12 Mathematics specifics:
 *   - One 80-mark, 3-hour paper; 2023-2026 main and compartment, 75 sets (all official, question and scheme papers paired).
 *   - Thirteen curriculum chapters with 41 content clauses as subtopics. One clause is earlier syllabus: "Random variables and
 *     probability distributions (earlier syllabus)" under Probability, removed in 2025-26, served only on 2023-2025 papers.
 *   - Two disputed official keys under the owner's rule ("No auto-mark, show note"), applied by the coordinator: CBSE's key
 *     with the note, never self-marked. Four scheme-notice items served without a key. One key the scheme prints as two
 *     answers, settled (2024 Set 65/4/3 Q5: B or C).
 *   - Two recorded gate waivers (cbse.pages_alternate on 3 papers, cbse.segmentation_clean on 6; coordinator, expiring
 *     2026-12-15), enforced paper by paper. 201 questions held in the source.
 *
 *   node scripts/generate-cbse-12-maths-runtime.mjs          write the outputs (a finalized runtime is never overwritten)
 *   node scripts/generate-cbse-12-maths-runtime.mjs --check  rebuild and compare with the committed outputs
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as builder from "./cbse-runtime-builder.mjs";

export const CONFIG = {
  bank: "cbse-12-maths",
  code: "cbse12m",
  label: "CBSE Class 12 Maths",
  subject: "Mathematics",
  course: "CBSE Class 12 Mathematics (041)",
  sourceRepository: "cbse-12-maths-topic-practice",
  defaultSourceRoot: "/Users/sakshamgoel/Documents/ProjectsInternships/cbse-12-maths-topic-practice",
  sourceRootEnv: "PASTPAPERPREP_CBSE_12_MATHS_SOURCE_ROOT",
  sourceCommit: "ec81723",
  toolkitCommit: "22063fa",
  sha256: {
    canonicalManifest: "ddbfb8dba7934a23223f946403ab1df1bdb7682b8a2ac07e2f8348bf373f288a",
    labels: "6577a39dcde4490969e232c8b6bcf94183066219a37a615e6a6d0d6f6dc27e83",
    secondarySubtopics: "0be7eb9c9834de83144e210825023f31c3e9b2191b5ed494ece4c15fc2a3db14",
    segmentation: "8f4c7b3c37fe6ffb38830d8d2ebbf1b708a44504cef28b44406fbe9646b76638",
    heldQuestions: "50764e7fa8d6d57127026b528855afa88775fe83d10e6707670c2f58b5543ec3",
    taxonomy: "df40742d8a4104fb57951f9e0ddd13b992a1109a9c5ceb1ef0beec645a6355fb",
    coverageReceipt: "1b2eab5f14135364447c1dcae288d6d6bb1842d5870d85f8fe04fc719f398422",
    msRowReviews: "9ffbd97299be550b8416517b87066c07f8f7a8e1b3151217a09214a72a142e78",
    mcqKeySettlements: "37a995bfabf4029c57bd8a6ae825a7aa9c50680b06a888650de633e01f216747",
    mcqKeyDisputes: "eabb96e88479246afa1707b8d217014bdbf7bd59f23cf6cba7c8cd21bcf05479",
    gateWaivers: "ea9190c4d873dff908caa60502cd76ca2150d0c7c28eefb2232fca5a592baf87",
    sourceManifest: "48efef439fa8a8c368b3f2a454c79d5c45bf3c0e5a1d6b26e5b7250f3d6bb716",
    /** SHA-256 over the sorted "<file> <sha256>" lines of every top-level blind-results/*.json file. */
    blindResults: "269664c429c97b5968ed9be6fa59ce11f5411824fc54d9a832715f6e203dcea5",
    /** Reviewed overlay: a case study's (iii)(b) OR branch adds its chapter as a secondary (both readers agreed; 6 rows). */
    reviewOverlays: { "case-study-or-branch.json": { overlay: "case-study-or-branch-2026-11-27", sha256: "4d6b83a2607601710d1f659df00058132c537c1e12fe5c1752653c5e3f353025", additions: 6 } },
    transcriptCorrections: "6ffc43e9294013fb1c080e546917323150d3fa3fe6e8e169b0e3401a0375469e",
  },
  /** The CBSE Mathematics (041) paper: 80 marks, 3 hours (curriculum 2025-26 assessment scheme; every set's maximum). */
  paperFacts: { 1: { name: "Mathematics", durationMinutes: 180, totalMarks: 80 } },
  sessions: ["main", "compartment"],
  waivedGates: ["cbse.segmentation_clean", "cbse.pages_alternate"],
  /** Scheme-notice items (full marks for any option / any attempt): served without a key and never self-marked. */
  excludedFromSelfMarking: ["cbse12m-2023-m-121-q18", "cbse12m-2025-m-121-q6", "cbse12m-2025-m-161-q16", "cbse12m-2025-m-163-q17"],
  /** Disputed official keys: CBSE's key with the note, never self-marked (mcq-key-disputes.json, owner's rule). */
  disputedKeys: ["cbse12m-2023-m-142-q13", "cbse12m-2026-m-151-q18"],
  /** A settled two-letter key (the scheme prints "(B) −2 OR (C) −3/2"): either letter scores. */
  twoLetterKeys: { "cbse12m-2024-m-143-q5": ["B", "C"] },
  /** Questions whose accessible text is the reviewed fix in transcript-corrections.json, not the blind read. */
  transcriptCorrections: [
    "cbse12m-2024-c-1s1-q6", "cbse12m-2024-m-121-q11", "cbse12m-2024-m-131-q18", "cbse12m-2024-m-151-q4", "cbse12m-2025-c-1s1-q25", "cbse12m-2025-c-1s1-q35",
    "cbse12m-2025-m-112-q23-or", "cbse12m-2026-c-171-q25", "cbse12m-2026-c-172-q12", "cbse12m-2026-m-121-q24", "cbse12m-2026-m-121-q25", "cbse12m-2026-m-122-q33",
    "cbse12m-2026-m-131-q14", "cbse12m-2026-m-131-q15", "cbse12m-2026-m-131-q20", "cbse12m-2026-m-142-q24", "cbse12m-2026-m-142-q35", "cbse12m-2026-m-143-q22-or",
    "cbse12m-2026-m-143-q24", "cbse12m-2026-m-151-q17", "cbse12m-2026-m-151-q24", "cbse12m-2026-m-151-q24-or", "cbse12m-2026-m-151-q30-or", "cbse12m-2026-m-151-q35-or",
  ],
  expected: {
    canonical: 2289, aliasesInManifest: 1082, held: 201, rows: 2088, servedAliases: 1034, sets: 75, topics: 13, subtopics: 41, earlierSubtopics: 1,
    freeRows: 477, multipleChoice: 967, structured: 1121, crops: 4671, years: "2023-2026",
  },
  freeYears: [2023],
  taxonomyNote: "Topics are the curriculum's thirteen chapters in curriculum order, grouped by its six units; subtopics are its content clauses, one of them earlier syllabus (random variables, on 2023-2025 papers only). One paper.",
  aliasNote: "CBSE Class 12 Maths: a question printed again in another set maps to its canonical question, from the source workspace's frozen canonical manifest.",
};

export const BANK = CONFIG.bank;
export const sourceRootPath = (environment = process.env) => builder.sourceRootPath(CONFIG, environment);
export const buildRuntime = (options = {}) => builder.buildRuntime(CONFIG, options);
export const reconstructCandidate = builder.reconstructCandidate;
export const createPrivateIndex = (artifact) => builder.createPrivateIndex(CONFIG, artifact);

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  builder.runCli(CONFIG, path.resolve(import.meta.dirname, "..")).catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
