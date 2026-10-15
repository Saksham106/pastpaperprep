#!/usr/bin/env node
/**
 * IB Economics May 2026 addition (gated extension).
 *
 * The sealed 2021-2025 runtime (`src/data/production/ib-economics-{hl,sl}.json`) is never rewritten. The 2026 rows live in
 * separate extension files that `src/lib/economics-runtime.ts` merges only when PASTPAPERPREP_IB_ECONOMICS_2026_MAY_ASSETS_VERIFIED
 * is "true" (set it only after the owner has uploaded and read back the crops listed in the upload plan).
 *
 * Usage:
 *   PASTPAPERPREP_IB_ECONOMICS_SOURCE_ROOT=<source worktree> node scripts/generate-ib-economics-2026-may.mjs [--check]
 *
 * Writes: src/data/production/ib-economics-{hl,sl}-2026-may.json, src/data/private-index/ib-economics-{hl,sl}-2026-may.json,
 * docs/ib-economics-asset-manifests/ib-economics-{hl,sl}-2026-may-upload-manifest.json,
 * docs/ib-economics-2026-may-r2-upload-plan.json and docs/ib-economics-2026-may-addition.json.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourceRoot = resolve(process.env.PASTPAPERPREP_IB_ECONOMICS_SOURCE_ROOT ?? join(root, "..", "..", "..", "ib-economics-topic-practice", ".worktrees", "may-2026"));
const check = process.argv.includes("--check");

// Pins (regenerate and re-pin together when the source lane changes).
export const MAY_2026_PINS = {
  sourceRepository: "ib-economics-topic-practice",
  sourceBranch: "feat/may-2026-official",
  sourceCommit: "d2dfd7f928ee82f57881667b3f8774cf0b48ec20",
  releaseTaxonomySha256: "75527e47eb45a54bcc4b3aa8676e2143aa719c70aac23f63c980cd053e8d102c",
  baseline: {
    "ib-economics-hl": { runtimeFileSha256: "ecd646c63b45f8d384b5221416431c07990c239630364c2b389ba68d21addd5e", contentSha256: "0a386d1cf83cb659577a64fabbab9582537a389379539808ad12aa999fc11072", questionCount: 111, paperCount: 42 },
    "ib-economics-sl": { runtimeFileSha256: "b68078e6c7cc97bb34aef17a63ab1b0d5d99833523b71892fbe622afc5ca1fb9", contentSha256: "4c182c306e5c9772cdff331a8d951ff0b1da38a7a97ff28975a0829c8e496570", questionCount: 89, paperCount: 32 },
  },
};
const banks = [
  ["ib-economics-hl", "HL", "questions-hl-2026-may.json", 17, 7],
  ["ib-economics-sl", "SL", "questions-sl-2026-may.json", 15, 6],
];

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const md5 = (bytes) => createHash("md5").update(bytes).digest("hex");
const compact = (value) => `${JSON.stringify(value)}\n`;
const pretty = (value) => `${JSON.stringify(value, null, 2)}\n`;
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const sourceBytes = (relative) => readFile(join(sourceRoot, relative));

function publicQuestion(question) {
  const fields = [
    "id", "number", "paper", "year", "session", "primaryTopic", "secondaryTopics", "skills", "subtopics", "subject",
    "option", "zone", "component", "calculator", "marks", "questionImageHashes", "markschemeImageHashes", "officialCodeRefs", "retrievalFacets",
  ];
  return Object.fromEntries(fields.filter((field) => field in question).map((field) => [field, question[field]]));
}

const outputs = new Map();
const finalBytes = await sourceBytes("data/may-2026/classification/final-classifications.json");
const segmentationBytes = await sourceBytes("data/may-2026/segmentation-manifest.json");
const adjudication = await readJson(join(sourceRoot, "data/may-2026/classification/adjudication-report.json"));
const cropQa = await readJson(join(sourceRoot, "data/may-2026/crop-qa.json"));
const sourceScan = await readJson(join(sourceRoot, "data/may-2026/source-scan.json"));
const acquisition = await readJson(join(sourceRoot, "data/may-2026/acquisition-manifest.json"));
const segmentation = JSON.parse(segmentationBytes);
const segmentationAssets = new Map(segmentation.records.flatMap((record) => record.assets.map((asset) => [asset.path, asset])));
const finalSha = hash(finalBytes);
const segmentationSha = hash(segmentationBytes);

const plan = { objects: [], totals: {} };
const receiptBanks = {};
let allAssets = 0;
let allBytes = 0;

for (const [bank, level, siteFile, questionCount, paperCount] of banks) {
  const siteBytes = await sourceBytes(`data/may-2026/site-data/${siteFile}`);
  const source = JSON.parse(siteBytes);
  if (source.level !== level || source.questions.length !== questionCount || source.papers.length !== paperCount) throw new Error(`${bank}: 2026 counts differ`);
  for (const question of source.questions) {
    if (question.bankSlug !== bank || question.id !== question.canonicalId || question.year !== 2026) throw new Error(`${bank}: identity mismatch for ${question.id}`);
    if (question.classificationEvidence?.finalArtifactSha256 !== finalSha) throw new Error(`${bank}: classification provenance mismatch for ${question.id}`);
    if (!String(question.sourceQuestionUrl).startsWith("https://") || !String(question.sourceMarkSchemeUrl).startsWith("https://")) throw new Error(`${bank}: source URL missing for ${question.id}`);
    for (const path of [...question.questionImages, ...question.markschemeImages]) {
      if (!path.endsWith(".webp") || path.includes("..") || path.startsWith("/")) throw new Error(`${bank}: unsafe asset path for ${question.id}`);
    }
  }
  // Assets: every crop re-hashed against the lane segmentation manifest.
  const assets = new Map();
  for (const question of source.questions) {
    for (const [kind, paths] of [["question", question.questionImages], ["markschemes", question.markschemeImages]]) {
      for (const relativeAsset of paths) {
        const sourcePath = `site/assets/ib-economics/${relativeAsset}`;
        const bytes = await sourceBytes(sourcePath);
        const pinned = segmentationAssets.get(sourcePath);
        if (!pinned || pinned.sha256 !== hash(bytes) || pinned.bytes !== bytes.byteLength) throw new Error(`${bank}: crop differs from the lane manifest: ${sourcePath}`);
        const objectKey = `${bank}/${relativeAsset}`;
        const item = assets.get(objectKey) ?? { objectKey, sourcePath, kind: kind === "question" ? "question" : "markscheme", byteSize: bytes.byteLength, sha256: hash(bytes), md5: md5(bytes), referencedQuestionIds: [] };
        if (!item.referencedQuestionIds.includes(question.id)) item.referencedQuestionIds.push(question.id);
        assets.set(objectKey, item);
      }
    }
  }
  const manifestAssets = [...assets.values()].sort((a, b) => a.objectKey.localeCompare(b.objectKey)).map((asset) => ({ ...asset, referencedQuestionIds: [...asset.referencedQuestionIds].sort() }));
  const assetBytes = manifestAssets.reduce((sum, asset) => sum + asset.byteSize, 0);
  const uploadManifest = {
    schemaVersion: "ib-economics-derived-asset-upload-manifest-v1",
    extension: "2026-may",
    bank,
    sourceRepository: MAY_2026_PINS.sourceRepository,
    sourceBranch: MAY_2026_PINS.sourceBranch,
    sourceCommit: MAY_2026_PINS.sourceCommit,
    sourceRuntimeFile: `src/data/production/${bank}-2026-may.json`,
    upload: false,
    rawPdfIncluded: false,
    assets: manifestAssets.map(({ md5: _md5, ...asset }) => asset),
  };
  const uploadManifestText = pretty(uploadManifest);
  const manifestSha = hash(uploadManifestText);
  const runtimeArtifact = {
    schemaVersion: "ib-economics-2026-may-extension-v1",
    sourceRepository: MAY_2026_PINS.sourceRepository,
    sourceBranch: MAY_2026_PINS.sourceBranch,
    sourceCommit: MAY_2026_PINS.sourceCommit,
    finalClassificationsSha256: finalSha,
    segmentationManifestSha256: segmentationSha,
    siteDataSha256: hash(siteBytes),
    releaseTaxonomySha256: MAY_2026_PINS.releaseTaxonomySha256,
    published: false,
    assetVerification: "pending_upload",
    baseline: { runtimeFile: `src/data/production/${bank}.json`, ...MAY_2026_PINS.baseline[bank] },
    questionCount,
    paperCount,
    assetCount: manifestAssets.length,
    assetByteSize: assetBytes,
    assetManifestSha256: manifestSha,
    contentSha256: hash(JSON.stringify(source.questions)),
  };
  const runtime = {
    course: source.course, level, papers: source.papers, questions: source.questions, releaseStatus: "candidate_pending_upload",
    rightsStatus: source.rightsStatus, sourceType: source.sourceType, specimenQuestionsIncluded: false, version: 2, years: [2026], runtimeArtifact,
  };
  outputs.set(`src/data/production/${bank}-2026-may.json`, compact(runtime));
  outputs.set(`src/data/private-index/${bank}-2026-may.json`, compact({ schemaVersion: "ib-economics-private-index-v1", bank, runtimeArtifact, questions: source.questions.map(publicQuestion) }));
  outputs.set(`docs/ib-economics-asset-manifests/${bank}-2026-may-upload-manifest.json`, uploadManifestText);
  for (const asset of manifestAssets) plan.objects.push({ bank, ...asset, contentType: "image/webp" });
  allAssets += manifestAssets.length;
  allBytes += assetBytes;
  receiptBanks[bank] = {
    level, questionCount, paperCount, assetCount: manifestAssets.length, assetByteSize: assetBytes,
    questionIds: source.questions.map((question) => question.id), paperIds: source.papers.map((paper) => paper.id),
    marks: Object.fromEntries(source.questions.map((question) => [question.id, question.marks])),
    sites: { siteDataSha256: hash(siteBytes), runtimeContentSha256: runtimeArtifact.contentSha256, assetManifestSha256: manifestSha },
  };
}

plan.totals = { objects: allAssets, bytes: allBytes, byBank: Object.fromEntries(Object.entries(receiptBanks).map(([bank, value]) => [bank, { objects: value.assetCount, bytes: value.assetByteSize }])) };
outputs.set("docs/ib-economics-2026-may-r2-upload-plan.json", pretty({
  schemaVersion: "ib-economics-2026-may-r2-upload-plan-v1",
  executed: false,
  note: "Dry-run plan only. Nothing has been uploaded. Needs fresh owner approval; upload create-only (HEAD each key absent first) and read every object back by SHA-256 and size.",
  provider: "r2",
  bucket: "pastpaperprep-assets",
  createOnly: true,
  sourceRepository: MAY_2026_PINS.sourceRepository,
  sourceBranch: MAY_2026_PINS.sourceBranch,
  sourceCommit: MAY_2026_PINS.sourceCommit,
  sourceRootNote: "sourcePath is relative to the source worktree root (ib-economics-topic-practice, branch feat/may-2026-official); the WebPs are git-ignored there and rebuilt byte-identically by scripts/may_2026_lane.py check.",
  existingObjectsUntouched: "The 1604 verified 2021-2025 objects are not part of this plan.",
  totals: plan.totals,
  objects: plan.objects,
}));

const receipt = {
  schemaVersion: "ib-economics-2026-may-addition-v1",
  title: "IB Economics HL/SL May 2026 official papers (gated extension)",
  status: "candidate_not_released",
  gate: "PASTPAPERPREP_IB_ECONOMICS_2026_MAY_ASSETS_VERIFIED (default off; needs the production Economics flags too)",
  source: {
    repository: MAY_2026_PINS.sourceRepository, branch: MAY_2026_PINS.sourceBranch, commit: MAY_2026_PINS.sourceCommit,
    host: acquisition.source_host, papers: acquisition.pair_count,
    finalClassificationsSha256: finalSha, segmentationManifestSha256: segmentationSha, releaseTaxonomySha256: MAY_2026_PINS.releaseTaxonomySha256,
  },
  counts: { questions: Object.fromEntries(Object.entries(receiptBanks).map(([bank, value]) => [bank, value.questionCount])), papers: Object.fromEntries(Object.entries(receiptBanks).map(([bank, value]) => [bank, value.paperCount])), uniqueQuestions: 26, uniquePapers: 10, sharedHlSlQuestions: 6 },
  baseline: MAY_2026_PINS.baseline,
  watermarkScan: { files: sourceScan.files, clean: sourceScan.clean, bibliographicCreditsOnly: sourceScan.bibliographic_credits_only, blocked: sourceScan.blocked.length, scannerSha256: sourceScan.scanner.sha256 },
  cropQa: { questionCropsViewed: cropQa.question_crops_viewed, markschemeCropsViewed: cropQa.markscheme_crops_viewed, verdict: cropQa.verdict, defects: cropQa.defects.length },
  tagging: {
    drex: { ...adjudication.drex, role: "triage only: flags were re-read against the question and mark scheme before any label changed" },
    blindPass: { agreement: { primaryAgree: adjudication.stats.primary_agree, of: adjudication.stats.questions, meanDetailSetJaccard: adjudication.stats.set_jaccard_mean } },
    inputsSha256: adjudication.inputs_sha256,
  },
  banks: receiptBanks,
  upload: { executed: false, bucket: "pastpaperprep-assets", objects: allAssets, bytes: allBytes, plan: "docs/ib-economics-2026-may-r2-upload-plan.json" },
  ownerDecisions: [
    "Approve the create-only R2 upload of the planned crops, then set PASTPAPERPREP_IB_ECONOMICS_2026_MAY_ASSETS_VERIFIED=true after read-back.",
    "Extend the user-attested publication-rights decision to the May 2026 papers (the 2026-09-09 attestation covers the sealed 2021-2025 corpus only).",
    "Approve the PDF upload to pastpaperprep-free for the Full past papers entries.",
  ],
};
outputs.set("docs/ib-economics-2026-may-addition.json", pretty(receipt));

// Baseline proof: the sealed files are untouched.
for (const [bank, pin] of Object.entries(MAY_2026_PINS.baseline)) {
  const bytes = await readFile(join(root, `src/data/production/${bank}.json`));
  if (hash(bytes) !== pin.runtimeFileSha256) throw new Error(`${bank}: sealed baseline runtime changed`);
}

let drift = 0;
for (const [relative, text] of outputs) {
  const path = join(root, relative);
  if (check) {
    let current = null;
    try { current = await readFile(path, "utf8"); } catch { /* missing */ }
    if (current !== text) { drift += 1; console.error(`drift: ${relative}`); }
  } else {
    await mkdir(resolve(path, ".."), { recursive: true });
    await writeFile(path, text, "utf8");
  }
}
if (check) {
  console.log(JSON.stringify({ status: drift ? "drift" : "byte-identical", files: outputs.size }));
  process.exit(drift ? 1 : 0);
}
console.log(JSON.stringify({ sourceRoot, files: [...outputs.keys()], assets: allAssets, bytes: allBytes }, null, 2));
