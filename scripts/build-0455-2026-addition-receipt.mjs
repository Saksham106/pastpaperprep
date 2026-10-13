#!/usr/bin/env node
// Writes the 0455 2026 addition receipt and the dry-run R2 upload plan. Reads only local files:
// no storage client is created and no credentials are read.
// Usage: PASTPAPERPREP_IGCSE_ECONOMICS_SOURCE_ROOT=<source worktree> node scripts/build-0455-2026-addition-receipt.mjs [--check]
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { BASELINE_2019_2025, LANE_2026 } from "./generate-igcse-economics-0455-runtime.mjs";
import { buildReleaseManifest, manifestSha256, RELEASE_BANKS } from "./igcse-release.mjs";

const BANK = "igcse-economics-0455";
const repo = resolve(import.meta.dirname, "..");
const sourceRoot = process.env[RELEASE_BANKS[BANK].sourceRootEnv];
if (!sourceRoot) throw new Error(`${RELEASE_BANKS[BANK].sourceRootEnv} is required`);
const hash = (algorithm, bytes) => createHash(algorithm).update(bytes).digest("hex");
const runtimePath = resolve(repo, "src/data/production", `${BANK}.json`);
const runtimeText = await readFile(runtimePath, "utf8");
const runtime = JSON.parse(runtimeText);
const committedManifest = JSON.parse(await readFile(resolve(repo, "data/storage", `${BANK}.manifest.json`), "utf8"));
const committedReceipt = JSON.parse(await readFile(resolve(repo, "data/storage", `${BANK}.receipt.json`), "utf8"));
// The Jev corrections (#62) rewrote only the committed manifest's contentSha256 after finalization;
// restoring the pre-Jev value must reproduce the manifest seal the readback receipt verified.
const PRE_JEV_MANIFEST_CONTENT_SHA256 = "8ac5ead6373bbdbac361c530254c799f4786d1e1c22570bb977b1c623f2e0c5e";
const receiptKeys = JSON.stringify([...committedReceipt.completed].sort());
if (manifestSha256({ ...committedManifest, contentSha256: PRE_JEV_MANIFEST_CONTENT_SHA256 }) !== BASELINE_2019_2025.assetManifestSha256
  || committedReceipt.assetManifestSha256 !== BASELINE_2019_2025.assetManifestSha256 || committedReceipt.storageState !== "verified_readback"
  || receiptKeys !== JSON.stringify(committedManifest.assets.map((asset) => asset.objectKey).sort())) {
  throw new Error("committed 2019-2025 manifest/receipt pair is not the verified baseline release");
}

const manifest = await buildReleaseManifest({ bank: BANK, runtimePath, sourceRoot });
const verified = new Map(committedManifest.assets.map((asset) => [asset.objectKey, asset]));
for (const asset of manifest.assets) {
  const old = verified.get(asset.objectKey);
  if (old && (old.sha256 !== asset.sha256 || old.size !== asset.size)) throw new Error(`verified object would change: ${asset.objectKey}`);
}
if (committedManifest.assets.some((asset) => !manifest.assets.some((next) => next.objectKey === asset.objectKey))) throw new Error("a verified object is no longer referenced");
const canonicalSource = resolve(sourceRoot);
const objects = [];
for (const asset of manifest.assets.filter((item) => !verified.has(item.objectKey))) {
  const bytes = await readFile(asset.sourcePath);
  const reference = asset.objectKey.slice(manifest.objectPrefix.length);
  const [kind, paper, file] = reference.split("/");
  const question = runtime.questions.find((q) => (kind === "questions" ? q.questionImages : q.markschemeImages).includes(reference));
  const sourceRelative = relative(canonicalSource, asset.sourcePath);
  if (!paper.startsWith("0455-2026-") || !sourceRelative.startsWith(`${LANE_2026.laneRoot}/assets/${paper}/`) || !question) throw new Error(`unexpected new object ${asset.objectKey}`);
  if (hash("sha256", bytes) !== asset.sha256 || bytes.length !== asset.size || bytes.subarray(8, 12).toString("latin1") !== "WEBP") throw new Error(`source bytes mismatch ${asset.objectKey}`);
  objects.push({ key: asset.objectKey, questionId: question.id, kind: kind === "questions" ? "question" : "markscheme", sourcePath: sourceRelative, sha256: asset.sha256, md5: hash("md5", bytes), bytes: bytes.length, contentType: asset.contentType, file });
}
objects.forEach((object) => delete object.file);
const questions = objects.filter((o) => o.kind === "question").length;
if (objects.length !== LANE_2026.questionAssets + LANE_2026.markschemeAssets || questions !== LANE_2026.questionAssets) throw new Error("new object counts are not exact");

const added = runtime.questions.filter((q) => q.year === 2026);
const plan = {
  schemaVersion: 1,
  addition: "0455-2026",
  mode: "dry-run-plan-only",
  status: "NOT UPLOADED",
  provider: "cloudflare-r2",
  bucket: "pastpaperprep-assets",
  storageClass: "premium private release objects (2026 is not a 0455 free year; free year is 2021). No Supabase objects.",
  method: "buildReleaseManifest() from scripts/igcse-release.mjs over the 2026 candidate runtime, minus the 4,200 objects already verified by data/storage/igcse-economics-0455.receipt.json. No client was created and no credentials were read.",
  objectPrefix: manifest.objectPrefix,
  source: { repository: "igcse-economics-0455-topic-practice", branch: LANE_2026.sourceBranch, commit: LANE_2026.sourceCommitAtBuild, sourceRootEnv: RELEASE_BANKS[BANK].sourceRootEnv },
  runtimeOriginalCandidateSha256: runtime.runtimeArtifact.originalCandidateRuntimeSha256,
  runtimeContentSha256: runtime.runtimeArtifact.contentSha256,
  fullReleaseManifest: { assetCount: manifest.assets.length, alreadyVerified: committedManifest.assets.length, new: objects.length },
  objectCount: objects.length,
  questionObjects: questions,
  markschemeObjects: objects.length - questions,
  totalBytes: objects.reduce((sum, o) => sum + o.bytes, 0),
  operatorNotes: [
    "Owner approval is required before any upload.",
    "npm run r2:sync does not handle igcse-economics-0455 (its SOURCES list has no 0455 entry); 0455 release objects go through scripts/igcse-release.mjs, which resolves sources from PASTPAPERPREP_IGCSE_ECONOMICS_SOURCE_ROOT (ECON0455_SOURCE_ROOT is only read by the runtime generator).",
    "2026 sources live only under data/segmentation/full-extension-2026/ of the source worktree on feat/2026-acquisition; the main source checkout does not have them until that branch lands. Point PASTPAPERPREP_IGCSE_ECONOMICS_SOURCE_ROOT at a checkout that has both the 2019-2025 lanes and the 2026 lane (the source worktree has both).",
    "Upload: node scripts/igcse-release.mjs --upload igcse-economics-0455 rewrites data/storage/igcse-economics-0455.manifest.json (4,548 objects), skips the 4,200 keys already in the receipt, uploads these 348 create-only (IfNoneMatch), then GET-verifies all 4,548 and rewrites the receipt.",
    "Then node scripts/generate-igcse-release.mjs --finalize igcse-economics-0455, rerun npm test, and commit the manifest, receipt and finalized runtime together. Merge only after that: until finalized, the release gate keeps the whole 0455 bank closed (it requires verified_readback).",
  ],
  objects,
};

const receipt = {
  schemaVersion: 1,
  addition: "0455-2026",
  status: "authorized_production_candidate; storage upload and --finalize pending (operator-gated)",
  method: "pure insertion: the finalized 2019-2025 runtime is kept byte-identical and in order; 139 2026 rows are appended. Proof: node scripts/verify-0455-2026-addition.mjs",
  baseline: { ...BASELINE_2019_2025 },
  merged: {
    questionCount: runtime.questions.length, paperCount: runtime.paperCount, years: runtime.years,
    fileSha256: hash("sha256", runtimeText), runtimeSha256: runtime.runtimeArtifact.runtimeSha256,
    originalCandidateRuntimeSha256: runtime.runtimeArtifact.originalCandidateRuntimeSha256, contentSha256: runtime.runtimeArtifact.contentSha256,
    combinedIdSeal: runtime.runtimeArtifact.combinedIdSeal,
    baselinePrefixContentSha256: hash("sha256", JSON.stringify(runtime.questions.slice(0, BASELINE_2019_2025.questionCount))),
  },
  lane2026: {
    ...runtime.runtimeArtifact.extension2026,
    papers: [...new Set(added.map((q) => q.id.replace(/-q\d+$/, "")))].map((paper) => ({ paper, questions: added.filter((q) => q.id.startsWith(`${paper}-`)).length })),
    primaryTopics: Object.fromEntries([...new Set(added.map((q) => q.primaryTopic))].map((topic) => [topic, added.filter((q) => q.primaryTopic === topic).length])),
    confidence: Object.fromEntries(["high", "medium", "low"].map((level) => [level, added.filter((q) => q.classificationConfidence === level).length])),
  },
  rows: added.map((q) => ({
    id: q.id, marks: q.marks, primaryTopic: q.primaryTopic, codes: q.officialCodes.map((code) => code.official_code), assessmentObjectives: q.assessmentObjectives,
    confidence: q.classificationConfidence, questionImageHashes: q.questionImageHashes, markschemeImageHashes: q.markschemeImageHashes,
  })),
};

const outputs = [
  [resolve(repo, "docs/igcse-economics-0455-2026-r2-upload-plan.json"), `${JSON.stringify(plan, null, 2)}\n`],
  [resolve(repo, "docs/igcse-economics-0455-2026-addition.json"), `${JSON.stringify(receipt, null, 2)}\n`],
];
for (const [file, text] of outputs) {
  if (process.argv.includes("--check")) {
    if (await readFile(file, "utf8") !== text) throw new Error(`${file} is stale`);
  } else await writeFile(file, text);
}
console.log(JSON.stringify({ newObjects: objects.length, questionObjects: questions, totalBytes: plan.totalBytes, rows: added.length }));
