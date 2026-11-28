#!/usr/bin/env node
/**
 * Build the CBSE Class 12 Biology (044) candidate runtime from the pinned source workspace
 * (cbse-12-biology-topic-practice, commit 23da57a, built with ../ppp-ingestion-toolkit a470e32; every gate run, 0 failed,
 * 0 waived; coverage receipt PASS). Every input is SHA-256 pinned; any drift fails closed. The checks and the output shape
 * live in scripts/cbse-runtime-builder.mjs (shared by every CBSE bank); this file pins the source and holds the decisions.
 *
 * Class 12 Biology specifics:
 *   - One theory paper (70 marks, 3 hours), 2023-2026 main and compartment; 35 questions held in the source (crops that
 *     are incomplete or carry another question); never served, nor their aliases.
 *   - Thirteen current chapters and two earlier-syllabus topics, "Strategies for Enhancement in Food Production (earlier
 *     syllabus)" and "Environmental Issues (earlier syllabus)": NCERT chapters the rationalised curriculum dropped that
 *     2023-2026 papers still ask about (17 questions). They have no subtopics and list after the current chapters.
 *   - Keys: 71 settled keys replace a misread or unread scheme key (third independent reads, mcq-key-settlements.json);
 *     five settled multi-letter keys and three the scheme prints as two answers; six "award for any attempt" items served
 *     without a key, never self-marked. 114 scheme totals that differ from the printed marks are served at the printed
 *     marks, each with a reviewed "serve" (ms-row-reviews.json).
 *
 *   node scripts/generate-cbse-12-biology-runtime.mjs          write the outputs (a finalized runtime is never overwritten)
 *   node scripts/generate-cbse-12-biology-runtime.mjs --check  rebuild and compare with the committed outputs
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as builder from "./cbse-runtime-builder.mjs";

export const CONFIG = {
  bank: "cbse-12-biology",
  code: "cbse12b",
  label: "CBSE Biology",
  subject: "Biology",
  course: "CBSE Class 12 Biology (044)",
  sourceRepository: "cbse-12-biology-topic-practice",
  defaultSourceRoot: "/Users/sakshamgoel/Documents/ProjectsInternships/cbse-12-biology-topic-practice",
  sourceRootEnv: "PASTPAPERPREP_CBSE_12_BIOLOGY_SOURCE_ROOT",
  sourceCommit: "23da57a",
  toolkitCommit: "a470e32",
  sha256: {
    canonicalManifest: "ba8708c6be09e51ccc61c523a2654870b53d7990e40bd7177d6d1ec51dcfcd20",
    labels: "f3ae2039ba0cb79b4118db9caa88ce473acf432cf0668d22d7d7d9fadb45c26b",
    secondarySubtopics: "3bf45cfde0e4e93e15f40b2d3355270c1e5ebd1f1df6d4a5d3b453c7ce6ebb93",
    segmentation: "77f6f51064db8021f46371043def55a6da0ae4d4fabd5586500044109ceb6d5a",
    heldQuestions: "20b863ce03aa02d37a511f3664e63c3c9be8966abc2a6aa43967a9113d36fc57",
    taxonomy: "a5eefe87e3b6ca0f766019f1b7ad573644b69ff1f9a63844dd174bf3378c7a7c",
    coverageReceipt: "1f076b1e14b51cead004f62520241f162fecb247ecb92c7a2465440860e8bf7e",
    msRowReviews: "cd5fc9cfeb4594ef6e7cb381a532a1eadc011727baf8a6aa2ea18273c9877253",
    mcqKeySettlements: "28c069c913012e22a3c8c1f3e898207cbfbbf139ef9cd5026a5997bb18356af0",
    sourceManifest: "9c54fde132b9f7d5aee640e30886ba1ef1eff5b33b3a4da3c73271582c8ef883",
    /** SHA-256 over the sorted "<file> <sha256>" lines of every top-level blind-results/*.json file. */
    blindResults: "7203aa5262d9ead8c47762f64495f6809a2e305e18369ed1e3bccffd95cb6a8e",
  },
  /** The CBSE Biology (044) theory paper: 70 marks, 3 hours (curriculum 2025-26 assessment scheme; every set's maximum). */
  paperFacts: { 1: { name: "Biology (Theory)", durationMinutes: 180, totalMarks: 70 } },
  sessions: ["main", "compartment"],
  /** Scheme-notice items (award for any attempt / full marks): served without a key and never self-marked. */
  excludedFromSelfMarking: [
    "cbse12b-2023-m-131-q10", "cbse12b-2023-m-151-q4", "cbse12b-2023-m-152-q7", "cbse12b-2023-m-153-q5", "cbse12b-2025-m-153-q2", "cbse12b-2025-m-162-q12",
  ],
  /** Multi-letter keys, settled (third reads) or printed by the scheme as two answers: any listed letter scores. */
  twoLetterKeys: {
    "cbse12b-2023-c-1c1-q2": ["A", "D"], "cbse12b-2023-m-111-q7": ["C", "D"], "cbse12b-2023-m-131-q7": ["B", "D"], "cbse12b-2023-m-132-q6": ["A", "B", "C"],
    "cbse12b-2023-m-133-q3": ["A", "B"], "cbse12b-2025-m-121-q12": ["B", "D"], "cbse12b-2025-m-123-q9": ["B", "D"], "cbse12b-2025-m-161-q7": ["C", "D"],
  },
  expected: {
    canonical: 1840, aliasesInManifest: 815, held: 35, rows: 1805, servedAliases: 813, sets: 69, topics: 13, earlierTopics: 2, subtopics: 51,
    freeRows: 343, multipleChoice: 813, structured: 992, crops: 4093, years: "2023-2026",
  },
  /** Question papers CBSE does not publish (2023 compartment Biology): reviewed host exceptions, from the recorded mirror. */
  hostExceptions: ["cbse12b-2023-c-1c1:question_paper", "cbse12b-2023-c-1c2:question_paper", "cbse12b-2023-c-1c3:question_paper"],
  freeYears: [2023],
  taxonomyNote: "Topics are the curriculum's thirteen chapters in curriculum order, then two earlier-syllabus topics (NCERT chapters the rationalised curriculum dropped that the papers still ask about); subtopics are the current chapters' content clauses. One theory paper.",
  aliasNote: "CBSE Class 12 Biology: a question printed again in another set maps to its canonical question, from the source workspace's frozen canonical manifest.",
};

export const BANK = CONFIG.bank;
export const sourceRootPath = (environment = process.env) => builder.sourceRootPath(CONFIG, environment);
export const buildRuntime = (options = {}) => builder.buildRuntime(CONFIG, options);
export const reconstructCandidate = builder.reconstructCandidate;
export const createPrivateIndex = (artifact) => builder.createPrivateIndex(CONFIG, artifact);

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  builder.runCli(CONFIG, path.resolve(import.meta.dirname, "..")).catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
