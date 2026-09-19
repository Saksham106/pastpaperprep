#!/usr/bin/env node
/**
 * Deterministic PRODUCTION runtime generator for IGCSE Economics 0455 (v6).
 *
 * Never hand-edit the generated JSON: regenerate it from the frozen tuple.
 *
 * Frozen input tuple (all sha256-pinned, fail-closed):
 *   projected runtime   <APP>/src/data/local-preview/igcse-economics-0455.json
 *                 emitted by the bank repo's canonical writer
 *                 (app-integration/build_local_preview_bank.py with
 *                 ECON0455_CANDIDATE=data/classification/full-selected-v6-row-restore/selected-candidate.json)
 *   taxonomy           <APP>/src/data/igcse-economics-0455-taxonomy.json
 *
 * v6 provenance (bank repo igcse-economics-0455-topic-practice):
 *   - 1,190 v5 rows byte-identical in labels, source-refreshed from the
 *     repaired segmentation lane (data/segmentation/full-repaired);
 *   - 30 row-loss rows restored through blind A/B adjudication
 *     (build-receipt-v6.json in the bank repo records every ruling);
 *   - 1 honest blocked row (0455-2021-s-22-q1) excluded by design;
 *   - marks backfilled from printed QP brackets; 0 null marks; 0 furniture.
 *
 * Expected shape (asserted, not assumed): 1,219 runtime rows / 70 papers,
 * 1,045 one-mark MCQ rows reconciled against printed answer keys, 0 rows
 * without a mark, 34 thirty-mark Paper-2 source questions (printed totals).
 *
 * Output (candidate only): src/data/production/igcse-economics-0455.json
 * with honest pre-release seals: assetVerification 'pending_storage_release'
 * and null storage receipts. `generate-igcse-release.mjs --finalize` (plus the
 * storage upload/readback that produces the receipt) is the later,
 * operator-gated step that completes the seal.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const BANK = "igcse-economics-0455";
export const COURSE = "Cambridge IGCSE Economics 0455";
export const RIGHTS_STATUS = "user_attested_non_blocking_for_named_corpus";
export const CANDIDATE_PUBLICATION_STATUS = "authorized_production_candidate";
export const SOURCE_REVIEW_STATUS = "source_paired_review_completed_pending_release";

/** sha256 of the canonical projected runtime emitted by the bank repo writer. */
export const PROJECTED_RUNTIME_SHA256 = "38e74b66586f99a7748f01d0287602d5b367199ff7b0dafedaa1cd55d857fc26";
/** sha256 (file bytes) of the emitted student-facing taxonomy. */
export const TAXONOMY_FILE_SHA256 = "d09b76146edf1ff02cfd88261b400bc48263c6af7b88ab61abbd3d885a21937c";
/** v6 classification candidate (bank repo) the projection was built from. */
export const V6_CANDIDATE_SHA256 = "9fae73bcd2a9ef9f249387dba2c8c3dedfc0808e134dcc171e741f641e587cc6";
/** Unchanged acquisition manifest and taxonomy overlay provenance. */
export const SOURCE_MANIFEST_SHA256 = "8fd2396ed6dab79a19803efa66cb4d8af3d0ce136c3c6d1c34756295338e0351";
export const RELEASE_TAXONOMY_SHA256 = "df318a9cb73b0a02f43003dc0a47189cd603ad33e8cc29d0f6c462c3e0299c2e";

export const DEFAULT_SOURCE_ROOT = "/Users/sakshamgoel/Documents/ProjectsInternships/igcse-economics-0455-topic-practice";
export const EXPECTED = {
  rows: 1219,
  papers: 70,
  years: "2021-2025",
  excluded: 1,
  mcqRows: 1045,
  marksReady: true,
};

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function sourceRootPath(environment = process.env) {
  return environment.ECON0455_SOURCE_ROOT?.trim() || DEFAULT_SOURCE_ROOT;
}

export function seal(artifact) {
  const blanked = (fields) => JSON.stringify({
    ...artifact,
    runtimeArtifact: {
      ...artifact.runtimeArtifact,
      sourceCandidateSha256: fields.includes("candidate") ? null : artifact.runtimeArtifact.sourceCandidateSha256,
      originalCandidateRuntimeSha256: fields.includes("candidate") ? null : artifact.runtimeArtifact.originalCandidateRuntimeSha256,
      runtimeSha256: fields.includes("runtime") ? null : artifact.runtimeArtifact.runtimeSha256,
    },
  });
  const candidate = sha256(blanked(["candidate", "runtime"]));
  artifact.runtimeArtifact.sourceCandidateSha256 = candidate;
  artifact.runtimeArtifact.originalCandidateRuntimeSha256 = candidate;
  artifact.runtimeArtifact.runtimeSha256 = sha256(blanked(["runtime"]));
  return { candidate, runtime: artifact.runtimeArtifact.runtimeSha256 };
}

export async function buildRuntime({ sourceRoot = sourceRootPath() } = {}) {
  const projectedPath = path.resolve("src/data/local-preview/igcse-economics-0455.json");
  const taxonomyPath = path.resolve("src/data/igcse-economics-0455-taxonomy.json");

  const projectedBytes = await readFile(projectedPath);
  if (sha256(projectedBytes) !== PROJECTED_RUNTIME_SHA256) {
    throw new Error(`0455 projected runtime sha256 mismatch: regenerate via the bank repo writer and re-pin`);
  }
  const taxonomyBytes = await readFile(taxonomyPath);
  if (sha256(taxonomyBytes) !== TAXONOMY_FILE_SHA256) {
    throw new Error(`0455 emitted taxonomy sha256 mismatch: ${sha256(taxonomyBytes)}`);
  }

  const projected = JSON.parse(projectedBytes.toString("utf8"));
  const taxonomy = JSON.parse(taxonomyBytes.toString("utf8"));

  // ---- shape asserts (fail closed) ---------------------------------------
  const questions = projected.questions;
  if (!Array.isArray(questions) || questions.length !== EXPECTED.rows) {
    throw new Error(`0455 runtime must carry exactly ${EXPECTED.rows} rows, got ${questions?.length}`);
  }
  if (projected.paperCount !== EXPECTED.papers || projected.years !== EXPECTED.years) {
    throw new Error("0455 projected runtime header disagrees with the expected corpus shape");
  }
  if (projected.sourceCandidate?.sha256 !== V6_CANDIDATE_SHA256) {
    throw new Error(`0455 projected runtime is not built from the pinned v6 candidate`);
  }
  const ids = new Set(questions.map((question) => question.id));
  if (ids.size !== questions.length) throw new Error("0455 runtime has duplicate question ids");
  const mcqRows = questions.filter((question) => question.component === "P1");
  if (mcqRows.length !== EXPECTED.mcqRows) throw new Error(`0455 MCQ row count drifted: ${mcqRows.length}`);
  if (!questions.every((question) => Number.isInteger(question.marks) && question.marks > 0)) {
    throw new Error("0455 runtime must carry a positive printed mark on every row");
  }
  if (!questions.every((question) => typeof question.accessibleText === "string" && question.accessibleText.length > 0)) {
    throw new Error("0455 runtime must carry accessible text on every row");
  }
  if (!questions.every((question) => question.questionImages.length > 0 && question.markschemeImages.length > 0)) {
    throw new Error("0455 runtime must carry question and mark-scheme assets on every row");
  }
  if (!questions.every((question) => question.classificationReviewStatus === SOURCE_REVIEW_STATUS)) {
    throw new Error("0455 runtime carries an unexpected review state");
  }

  const runtimeQuestions = questions.map((question) => {
    if (question.publicationStatus !== "local_preview_candidate") {
      throw new Error(`0455 row carries an unexpected publication state: ${question.id}`);
    }
    return { ...question, publicationStatus: CANDIDATE_PUBLICATION_STATUS };
  });

  // Provenance files must be unchanged since the sealed release.
  const sourceManifestBytes = await readFile(path.join(sourceRoot, "data/source-manifest.json"));
  if (sha256(sourceManifestBytes) !== SOURCE_MANIFEST_SHA256) {
    throw new Error("0455 source manifest drifted from the pinned acquisition state");
  }
  const overlayBytes = await readFile(path.join(sourceRoot, "data/classification/reconciliation/final-v2/taxonomy-overlay-v2.json"));
  if (sha256(overlayBytes) !== RELEASE_TAXONOMY_SHA256) {
    throw new Error("0455 taxonomy overlay drifted from the pinned release state");
  }

  const artifact = {
    version: "igcse-economics-0455-repaired-v6-9fae73bcd2a9",
    course: COURSE,
    subject: "Economics 0455",
    qualification: "Cambridge IGCSE",
    boardcode: "0455",
    releaseStatus: CANDIDATE_PUBLICATION_STATUS,
    rightsStatus: RIGHTS_STATUS,
    sourceType: "actual_past_paper",
    specimenQuestionsIncluded: false,
    years: EXPECTED.years,
    paperCount: EXPECTED.papers,
    questionCount: EXPECTED.rows,
    classificationVersion: "economics0455_source_backed_taxonomy@2-exchange-rates",
    sourceCandidate: {
      path: "data/classification/full-selected-v6-row-restore/selected-candidate.json",
      sha256: V6_CANDIDATE_SHA256,
      questionCount: 1220,
    },
    taxonomy: {
      path: "data/classification/reconciliation/final-v2/taxonomy-overlay-v2.json",
      sha256: RELEASE_TAXONOMY_SHA256,
      version: "economics0455_source_backed_taxonomy@2-exchange-rates",
    },
    sourceManifest: {
      path: "data/source-manifest.json",
      sha256: SOURCE_MANIFEST_SHA256,
    },
    publicationStatus: CANDIDATE_PUBLICATION_STATUS,
    assetVerification: "pending_storage_release",
    storageNamespace: "igcse-economics-0455/",
    wholeBankSemanticApproval: "not_claimed",
    knownCoverageGaps: "preserved_from_candidate; whole-bank semantic approval pending",
    runtimeArtifact: {
      schemaVersion: "igcse-normalized-runtime-v1",
      sourceRepository: "igcse-economics-0455-topic-practice",
      releaseTaxonomySha256: RELEASE_TAXONOMY_SHA256,
      publicationStatus: CANDIDATE_PUBLICATION_STATUS,
      rightsStatus: RIGHTS_STATUS,
      assetVerification: "pending_storage_release",
      storageReceiptSha256: null,
      assetManifestSha256: null,
      contentSha256: sha256(JSON.stringify(runtimeQuestions)),
      runtimeTaxonomySha256: sha256(JSON.stringify(taxonomy)),
      marksReady: true,
      marksRepairStatus: "verified_against_print",
      marksRepairUnresolvedCount: 0,
      originalCandidateRuntimeSha256: null,
      sourceCandidateSha256: null,
      runtimeSha256: null,
    },
    questions: runtimeQuestions,
  };

  const seals = seal(artifact);
  return { artifact, seals };
}

export function createPrivateIndex(artifact) {
  return {
    version: 1,
    bank: BANK,
    questions: artifact.questions.map((question) => ({
      id: question.id,
      number: question.number,
      paper: question.paper,
      year: question.year,
      session: question.session,
      primaryTopic: question.primaryTopic,
      secondaryTopics: [...(question.secondaryTopics ?? [])],
      skills: [...(question.skills ?? [])],
      subtopics: [...(question.subtopics ?? [])],
      subject: question.subject,
      zone: question.zone,
      component: question.component,
      marks: question.marks,
    })),
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.pathname ?? process.argv[1]);

export async function writeRuntime() {
  const { artifact, seals } = await buildRuntime();
  const out = path.resolve("src/data/production/igcse-economics-0455.json");
  await writeFile(out, `${JSON.stringify(artifact)}\n`);
  // Metadata-only candidate private index (same compact shape as the other
  // private banks). No answers, text, or asset paths cross this boundary.
  const privateIndexOut = path.resolve("src/data/private-index/igcse-economics-0455.json");
  await writeFile(privateIndexOut, `${JSON.stringify(createPrivateIndex(artifact))}\n`);
  return { out, privateIndexOut, seals, rows: artifact.questions.length };
}

if (isMain) {
  writeRuntime()
    .then(({ out, privateIndexOut, seals, rows }) => {
      console.log(JSON.stringify({ out, privateIndexOut, rows, candidateSha256: seals.candidate, runtimeSha256: seals.runtime }, null, 2));
    })
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
