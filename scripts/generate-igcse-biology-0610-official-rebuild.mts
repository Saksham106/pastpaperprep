#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-explicit-any */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildBiology0610Runtime } from "../src/lib/igcse-biology-0610-official-rebuild";

const runtime = await buildBiology0610Runtime();
const questions = runtime.rows.map((row) => ({
  ...row,
  marks_ready: true,
  answerProvenance: row.answer == null ? null : { status: "official", questionId: row.id },
  assetStorage: "local-preview-source",
}));
const artifact = {
  version: "igcse-biology-0610-official-rebuild-v3",
  releaseStatus: "candidate",
  rightsStatus: "user_attested_private_acquisition_publication_blocked",
  sourceType: "actual_past_paper",
  specimenQuestionsIncluded: false,
  years: "2021-2025",
  paperCount: new Set(questions.map((row: any) => `${row.year}-${row.session}-${row.component}`)).size,
  questionCount: questions.length,
  marks_ready: true,
  sourceCandidate: { path: "data/classification/full-bank-assembly/working-assembly-ms-repair.json", questionCount: questions.length },
  taxonomy: { path: "src/data/classification/igcse-biology-0610-official-taxonomy-v2.json", eras: runtime.eras },
  overlay: { path: "src/data/classification/igcse-biology-0610-final-reviewed-overlay.reconciled.json", sha256: runtime.overlaySha256, counts: runtime.counts },
  questions,
  publicationStatus: "candidate",
  assetVerification: "not_run",
  storageNamespace: "igcse-biology-0610",
  wholeBankSemanticApproval: "reviewed-overlay-bound",
  knownCoverageGaps: questions.filter((row) => row.reviewStatus === "blocked").map((row) => row.id),
};
const outputPath = path.resolve("src/data/local-preview/igcse-biology-0610.json");
const indexPath = path.resolve("src/data/local-preview/igcse-biology-0610-index.json");
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
await mkdir(path.dirname(indexPath), { recursive: true });
await writeFile(indexPath, `${JSON.stringify({ bankSlug: "igcse-biology-0610", questionCount: questions.length, paperCount: artifact.paperCount, questions: questions.map((row: any) => ({ id: row.id, year: row.year, paper: row.paper, component: row.component, primaryTopic: row.primaryTopic, secondaryTopics: row.secondaryTopics, subtopics: row.subtopics, courseEra: row.courseEra, marks: row.marks })) }, null, 2)}\n`);
console.log(JSON.stringify({ status: "PASS", rows: questions.length, paperCount: artifact.paperCount, blocked: artifact.knownCoverageGaps.length, overlaySha256: runtime.overlaySha256 }));
