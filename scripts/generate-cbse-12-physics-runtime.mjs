#!/usr/bin/env node
/**
 * Build the CBSE Class 12 Physics (042) candidate runtime from the pinned source workspace
 * (cbse-12-physics-topic-practice, commit b2537af, built with ../ppp-ingestion-toolkit a470e32; 33/33 gates, coverage receipt
 * PASS, no waivers). Every input is SHA-256 pinned; any drift fails closed. The checks and the output shape live in
 * scripts/cbse-runtime-builder.mjs (shared by every CBSE bank); this file pins the source and holds the bank's decisions.
 *
 * Class 12 Physics specifics:
 *   - One theory paper (70 marks, 3 hours), 2023-2026 main and compartment. 405 questions held in the source (mostly scheme
 *     rows that do not reconcile, and crop defects); never served, nor their aliases.
 *   - Six disputed official keys (owner, 2026-11-27: "No auto-mark, show note"): served with CBSE's official key and the
 *     note beside it, never self-marked; each matches data/review/mcq-key-disputes.json (decided by the owner).
 *   - Thirteen "full marks for any option / no option is correct" items: served without a key, never self-marked, so the
 *     scheme's own words show.
 *   - Three keys the scheme prints as two answers ("(A) resistor / (C) capacitor"): either letter scores.
 *   - Six reviewed transcript fixes and one recorded label audit (2025-m-121 Q10 gains chapter 11).
 *   - Calculators are not allowed on any paper (src/lib/calculator-policy.mjs).
 *
 *   node scripts/generate-cbse-12-physics-runtime.mjs          write the outputs (a finalized runtime is never overwritten)
 *   node scripts/generate-cbse-12-physics-runtime.mjs --check  rebuild and compare with the committed outputs
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as builder from "./cbse-runtime-builder.mjs";

export const CONFIG = {
  bank: "cbse-12-physics",
  code: "cbse12p",
  label: "CBSE Physics",
  subject: "Physics",
  course: "CBSE Class 12 Physics (042)",
  sourceRepository: "cbse-12-physics-topic-practice",
  defaultSourceRoot: "/Users/sakshamgoel/Documents/ProjectsInternships/cbse-12-physics-topic-practice",
  sourceRootEnv: "PASTPAPERPREP_CBSE_12_PHYSICS_SOURCE_ROOT",
  sourceCommit: "b2537af",
  toolkitCommit: "a470e32",
  sha256: {
    canonicalManifest: "cfcd11cee747d26ef6cf11796f02d73eafaa52a93feee7ad6cac0199a44ede4a",
    labels: "c7521bdc3bc49f1c4526cce423b63b92de2dae6cfe501b5f29f3b37481ebe856",
    secondarySubtopics: "1ebd89a8326c1df4519b2c77e383ff8f70a801c991ad0be1cc187e85befaae93",
    segmentation: "dc15b7733a383a93b9321da171b8f50309029514017832e5afae43f824a4cc40",
    heldQuestions: "cbcdd834ac5ee4df846e2c6c731b0b6cab064bf71fe40b6973c8f23c8f209e6d",
    taxonomy: "7bf0ec4c5a297c2b7b3088f706895e76b5248e55ad670d61c2e7b0aa65a08eac",
    coverageReceipt: "51c8097321a97e39f549cb1a5c310272424f000bb6f11e6974d8c93e1f0b8f49",
    msRowReviews: "dda00c0997b50830dfedaeab59086aba672138961074665de794a43f31fd86e2",
    mcqKeySettlements: "93d2727b99b21890b865fc3ddeb2dffacb0d925388508300856e1c00035e83c5",
    mcqKeyDisputes: "dcb5c93988fe48e085beee2da768ca8c57c93c94dd94b9265c817a28eb5b5882",
    sourceManifest: "ddded51873fd9f108f2b03d81759b69df4ecf40ee4b16304290a106e2062108d",
    /** SHA-256 over the sorted "<file> <sha256>" lines of every top-level blind-results/*.json file. */
    blindResults: "69d6169e0b3fce1fefead479cbb52095e43a28974ef3404b66910e49979ecc90",
    transcriptCorrections: "0f8fb466d43180b804cdd1ad4d144508a2514dbc80aa35e28b3a7944262286ce",
    reviewCorrections: { "label-audit-2026-11-27.json": "2c14f9762c45ab1dac1a9c3acc58dc3734bd9a01f8beadc93493e62868b5c8b0" },
  },
  /** The CBSE Physics (042) theory paper: 70 marks, 3 hours (curriculum 2025-26 assessment scheme; every set's maximum). */
  paperFacts: { 1: { name: "Physics (Theory)", durationMinutes: 180, totalMarks: 70 } },
  sessions: ["main", "compartment"],
  /** Scheme-notice items (full marks for any option, no option correct): served without a key and never self-marked. */
  excludedFromSelfMarking: [
    "cbse12p-2023-m-112-q13", "cbse12p-2023-m-112-q4", "cbse12p-2023-m-141-q11", "cbse12p-2023-m-142-q4", "cbse12p-2023-m-151-q2", "cbse12p-2023-m-153-q16",
    "cbse12p-2023-m-153-q2", "cbse12p-2024-m-141-q11", "cbse12p-2024-m-142-q12", "cbse12p-2024-m-143-q5", "cbse12p-2024-m-143-q6", "cbse12p-2026-m-151-q9",
    "cbse12p-2026-m-153-q3",
  ],
  /** Disputed official keys: CBSE's key with the owner-approved note, never self-marked (mcq-key-disputes.json). */
  disputedKeys: [
    "cbse12p-2023-c-1c3-q17", "cbse12p-2023-m-121-q5", "cbse12p-2023-m-122-q13", "cbse12p-2023-m-123-q15", "cbse12p-2024-c-1s1-q10", "cbse12p-2025-c-1s1-q11",
  ],
  /** Keys the scheme prints as two answers ("(A) resistor / (C) capacitor"): either letter scores. */
  twoLetterKeys: { "cbse12p-2025-m-121-q12": ["A", "C"], "cbse12p-2025-m-122-q11": ["A", "C"], "cbse12p-2025-m-123-q10": ["A", "C"] },
  /** Questions whose accessible text is the reviewed fix in transcript-corrections.json, not the blind read. */
  transcriptCorrections: [
    "cbse12p-2024-c-1s1-q24-or", "cbse12p-2024-c-1s3-q12", "cbse12p-2024-m-111-q12", "cbse12p-2024-m-141-q9", "cbse12p-2024-m-151-q12", "cbse12p-2024-m-152-q12",
  ],
  expected: {
    canonical: 2029, aliasesInManifest: 894, held: 405, rows: 1624, servedAliases: 720, sets: 75, topics: 14, subtopics: 43,
    freeRows: 504, multipleChoice: 707, structured: 917, crops: 3909, years: "2023-2026",
  },
  freeYears: [2023],
  taxonomyNote: "Topics are the curriculum's fourteen chapters in curriculum order, grouped by its nine units; subtopics are its content clauses. One theory paper; no earlier-syllabus topics.",
  aliasNote: "CBSE Class 12 Physics: a question printed again in another set maps to its canonical question, from the source workspace's frozen canonical manifest.",
};

export const BANK = CONFIG.bank;
export const sourceRootPath = (environment = process.env) => builder.sourceRootPath(CONFIG, environment);
export const buildRuntime = (options = {}) => builder.buildRuntime(CONFIG, options);
export const reconstructCandidate = builder.reconstructCandidate;
export const createPrivateIndex = (artifact) => builder.createPrivateIndex(CONFIG, artifact);

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  builder.runCli(CONFIG, path.resolve(import.meta.dirname, "..")).catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
