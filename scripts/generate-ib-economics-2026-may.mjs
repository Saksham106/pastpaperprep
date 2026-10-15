#!/usr/bin/env node
/**
 * IB Economics May 2026 addition: fold the 26 official questions into the Economics runtime.
 *
 * Pure append over the sealed 2021-2025 files at BASE_COMMIT: every existing row, paper and asset entry stays
 * byte-identical (the generator rebuilds each file from the base blob and `--check` proves it). The new crops were
 * uploaded create-only and read back; the combined verified storage receipt is built from the committed upload log.
 *
 * Usage:
 *   PASTPAPERPREP_IB_ECONOMICS_SOURCE_ROOT=<source worktree> node scripts/generate-ib-economics-2026-may.mjs [--check]
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourceRoot = resolve(process.env.PASTPAPERPREP_IB_ECONOMICS_SOURCE_ROOT ?? join(root, "..", "..", "..", "ib-economics-topic-practice", ".worktrees", "may-2026"));
const check = process.argv.includes("--check");

export const MAY_2026_PINS = {
  baseCommit: "5d0f243624e449a7b589d83708145102e3b5bfb3",
  sourceRepository: "ib-economics-topic-practice",
  sourceBranch: "feat/may-2026-official",
  sourceCommit: "911f3d4506d7b646fde4773f26b4698bbf5341d4",
  releaseTaxonomySha256: "75527e47eb45a54bcc4b3aa8676e2143aa719c70aac23f63c980cd053e8d102c",
  bucket: "pastpaperprep-assets",
};
const banks = [
  ["ib-economics-hl", "HL", "questions-hl-2026-may.json", 17, 7],
  ["ib-economics-sl", "SL", "questions-sl-2026-may.json", 15, 6],
];
const UPLOAD_LOG = "docs/ib-economics-2026-may-r2-upload-log.jsonl";
const ATTESTATION = "docs/ib-economics-2026-may-rights-attestation.json";
const BASE_RECEIPT = "docs/ib-economics-storage-receipts/ib-economics-storage-release-receipt.json";
const COMBINED_RECEIPT = "docs/ib-economics-storage-receipts/ib-economics-storage-release-receipt-with-2026-may.json";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const md5 = (bytes) => createHash("md5").update(bytes).digest("hex");
const compact = (value) => `${JSON.stringify(value)}\n`;
const pretty = (value) => `${JSON.stringify(value, null, 2)}\n`;
const baseBlob = (path) => execFileSync("git", ["show", `${MAY_2026_PINS.baseCommit}:${path}`], { cwd: root, maxBuffer: 1 << 28 });
const baseJson = (path) => {
  const bytes = baseBlob(path);
  const value = JSON.parse(bytes);
  if (compact(value) !== bytes.toString("utf8")) throw new Error(`${path}: base blob does not round-trip`);
  return value;
};
const sourceBytes = (relative) => readFile(join(sourceRoot, relative));
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

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
const attestationText = await readFile(join(root, ATTESTATION), "utf8");
const attestationSha = hash(attestationText);

// ---- the 2026 assets, re-hashed against the lane manifest and the upload log
const logText = await readFile(join(root, UPLOAD_LOG), "utf8");
const log = logText.split("\n").filter(Boolean).map((line) => JSON.parse(line));
const logByKey = new Map();
for (const row of log) {
  if (logByKey.has(row.key)) throw new Error(`duplicate upload log key ${row.key}`);
  logByKey.set(row.key, row);
}

const newAssetsByBank = {};
const extension = {};
for (const [bank, level, siteFile, questionCount, paperCount] of banks) {
  const siteBytes = await sourceBytes(`data/may-2026/site-data/${siteFile}`);
  const site = JSON.parse(siteBytes);
  if (site.level !== level || site.questions.length !== questionCount || site.papers.length !== paperCount) throw new Error(`${bank}: 2026 counts differ`);
  for (const question of site.questions) {
    if (question.bankSlug !== bank || question.id !== question.canonicalId || question.year !== 2026) throw new Error(`${bank}: identity mismatch for ${question.id}`);
    if (question.classificationEvidence?.finalArtifactSha256 !== finalSha) throw new Error(`${bank}: classification provenance mismatch for ${question.id}`);
    if (question.classificationReviewStatus !== "blind_adjudicated") throw new Error(`${bank}: unexpected review status for ${question.id}`);
  }
  const assets = new Map();
  for (const question of site.questions) {
    for (const [kind, paths] of [["question", question.questionImages], ["markscheme", question.markschemeImages]]) {
      for (const relativeAsset of paths) {
        const sourcePath = `site/assets/ib-economics/${relativeAsset}`;
        const bytes = await sourceBytes(sourcePath);
        const pinned = segmentationAssets.get(sourcePath);
        if (!pinned || pinned.sha256 !== hash(bytes) || pinned.bytes !== bytes.byteLength) throw new Error(`${bank}: crop differs from the lane manifest: ${sourcePath}`);
        const objectKey = `${bank}/${relativeAsset}`;
        const logged = logByKey.get(objectKey);
        if (!logged || logged.status !== "verified" || logged.sha256 !== hash(bytes) || logged.bytes !== bytes.byteLength || logged.bucket !== MAY_2026_PINS.bucket || logged.existedBefore !== false) {
          throw new Error(`${bank}: upload log does not verify ${objectKey}`);
        }
        const item = assets.get(objectKey) ?? { objectKey, sourcePath, kind, byteSize: bytes.byteLength, sha256: hash(bytes), md5: md5(bytes), referencedQuestionIds: [] };
        if (!item.referencedQuestionIds.includes(question.id)) item.referencedQuestionIds.push(question.id);
        assets.set(objectKey, item);
      }
    }
  }
  newAssetsByBank[bank] = [...assets.values()].sort((a, b) => a.objectKey.localeCompare(b.objectKey)).map((asset) => ({ ...asset, referencedQuestionIds: [...asset.referencedQuestionIds].sort() }));
  extension[bank] = { site, siteSha: hash(siteBytes) };
}
const allNew = banks.flatMap(([bank]) => newAssetsByBank[bank]);
if (logByKey.size !== allNew.length || log.length !== allNew.length) throw new Error("upload log does not cover exactly the planned objects");
const newBytes = allNew.reduce((sum, asset) => sum + asset.byteSize, 0);

// ---- merged asset manifests (base entries untouched) and the combined manifest seal
const baseReceipt = JSON.parse(baseBlob(BASE_RECEIPT));
const mergedManifests = {};
const combinedForSeal = [];
for (const [bank] of banks) {
  const base = baseJson(`docs/ib-economics-asset-manifests/${bank}-upload-manifest.json`);
  const added = newAssetsByBank[bank].map((asset) => ({ objectKey: asset.objectKey, sourcePath: asset.sourcePath, kind: asset.kind, byteSize: asset.byteSize, sha256: asset.sha256, referencedQuestionIds: asset.referencedQuestionIds }));
  const keys = new Set(base.assets.map((asset) => asset.objectKey));
  if (added.some((asset) => keys.has(asset.objectKey))) throw new Error(`${bank}: a 2026 key collides with a sealed key`);
  const assets = [...base.assets, ...added].sort((a, b) => a.objectKey.localeCompare(b.objectKey));
  mergedManifests[bank] = { ...base, assets };
  combinedForSeal.push(...assets);
  outputs.set(`docs/ib-economics-asset-manifests/${bank}-upload-manifest.json`, compact(mergedManifests[bank]));
}
const combinedManifestSha = hash(JSON.stringify(combinedForSeal.sort((a, b) => a.objectKey.localeCompare(b.objectKey))));
const baseObjectCount = baseReceipt.final.objectCount;
const baseByteSize = baseReceipt.final.byteSize;
const objectCount = baseObjectCount + allNew.length;
const byteSize = baseByteSize + newBytes;
if (combinedForSeal.length !== objectCount) throw new Error("combined manifest object count mismatch");

// ---- combined verified storage receipt (base receipt + read-back log)
const lastVerifiedAt = log.map((row) => row.at).sort().at(-1);
const receipt = {
  ...baseReceipt,
  manifestSha256: combinedManifestSha,
  local: { objectCount, byteSize },
  objects: {
    ...baseReceipt.objects,
    ...Object.fromEntries(allNew.sort((a, b) => a.objectKey.localeCompare(b.objectKey)).map((asset) => {
      const row = logByKey.get(asset.objectKey);
      return [asset.objectKey, { status: "verified", method: "create_only_upload_with_get_readback", localBytes: asset.byteSize, localSha256: asset.sha256, remoteBytes: row.bytes, remoteSha256: row.sha256, verifiedAt: row.at }];
    })),
  },
  final: { verifiedAt: lastVerifiedAt, objectCount, byteSize, sha256VerifiedByGet: true, unexpectedCount: 0 },
  extension2026May: {
    note: "Combines the sealed 2021-2025 receipt (unchanged file) with the create-only upload and SHA-256 read-back of the May 2026 crops.",
    baselineReceiptFile: BASE_RECEIPT,
    baselineReceiptSha256: hash(baseBlob(BASE_RECEIPT)),
    baselineManifestSha256: baseReceipt.manifestSha256,
    baselineObjectCount: baseObjectCount,
    baselineByteSize: baseByteSize,
    sourceRepository: MAY_2026_PINS.sourceRepository,
    sourceCommit: MAY_2026_PINS.sourceCommit,
    uploadLog: UPLOAD_LOG,
    uploadLogSha256: hash(logText),
    uploadedObjects: allNew.length,
    uploadedBytes: newBytes,
    allCreatedNew: true,
  },
};
const receiptText = pretty(receipt);
const receiptSha = hash(receiptText);
outputs.set(COMBINED_RECEIPT, receiptText);

// ---- runtime, private index, local preview, seal manifest
const sealManifest = baseJson("src/data/ib-economics-runtime-manifest.json");
const newSeal = {
  ...sealManifest,
  storageReceiptSha256: receiptSha,
  storageManifestSha256: combinedManifestSha,
  storageObjectCount: objectCount,
  storageByteSize: byteSize,
  banks: {},
  baseline: { sourceCommit: sealManifest.sourceCommit, storageReceiptSha256: sealManifest.storageReceiptSha256, storageManifestSha256: sealManifest.storageManifestSha256, storageObjectCount: sealManifest.storageObjectCount, storageByteSize: sealManifest.storageByteSize, banks: sealManifest.banks },
  extension2026May: {
    sourceRepository: MAY_2026_PINS.sourceRepository, sourceBranch: MAY_2026_PINS.sourceBranch, sourceCommit: MAY_2026_PINS.sourceCommit,
    finalClassificationsSha256: finalSha, segmentationManifestSha256: segmentationSha, rightsAttestationSha256: attestationSha,
    uploadedObjects: allNew.length, uploadedBytes: newBytes,
  },
};
const receiptBanks = {};
for (const [bank, level, , questionCount, paperCount] of banks) {
  const baseRuntime = baseJson(`src/data/production/${bank}.json`);
  const basePrivate = baseJson(`src/data/private-index/${bank}.json`);
  const baseLocal = baseJson(`src/data/local-preview/${bank}.json`);
  const baseSeal = sealManifest.banks[bank];
  if (hash(baseBlob(`src/data/production/${bank}.json`)) !== baseSeal.runtimeFileSha256) throw new Error(`${bank}: base runtime blob differs from its seal`);
  const { site, siteSha } = extension[bank];
  const questions = [...baseRuntime.questions, ...site.questions];
  const papers = [...baseRuntime.papers, ...site.papers];
  const baseCount = baseRuntime.questions.length;
  const runtimeArtifact = {
    ...baseRuntime.runtimeArtifact,
    storageReceiptSha256: receiptSha,
    assetManifestSha256: combinedManifestSha,
    storageObjectCount: objectCount,
    storageByteSize: byteSize,
    contentSha256: hash(JSON.stringify(questions)),
    extension2026May: {
      sourceRepository: MAY_2026_PINS.sourceRepository, sourceBranch: MAY_2026_PINS.sourceBranch, sourceCommit: MAY_2026_PINS.sourceCommit,
      finalClassificationsSha256: finalSha, segmentationManifestSha256: segmentationSha, siteDataSha256: siteSha,
      releaseTaxonomySha256: MAY_2026_PINS.releaseTaxonomySha256, rightsAttestationSha256: attestationSha,
      baselineRuntimeFileSha256: baseSeal.runtimeFileSha256, baselineContentSha256: baseRuntime.runtimeArtifact.contentSha256,
      baselineQuestionCount: baseCount, baselinePaperCount: baseRuntime.papers.length,
      questionCount, paperCount, assetCount: newAssetsByBank[bank].length, assetByteSize: newAssetsByBank[bank].reduce((s, a) => s + a.byteSize, 0),
    },
  };
  const runtime = { ...baseRuntime, papers, questions, years: [...new Set([...baseRuntime.years, 2026])], runtimeArtifact };
  const runtimeText = compact(runtime);
  const privateText = compact({ ...basePrivate, runtimeArtifact, questions: [...basePrivate.questions, ...site.questions.map(publicQuestion)] });
  const localText = compact({ ...baseLocal, papers: [...baseLocal.papers, ...site.papers], questions: [...baseLocal.questions, ...site.questions], years: [...new Set([...baseLocal.years, 2026])] });
  outputs.set(`src/data/production/${bank}.json`, runtimeText);
  outputs.set(`src/data/private-index/${bank}.json`, privateText);
  outputs.set(`src/data/local-preview/${bank}.json`, localText);
  newSeal.banks[bank] = {
    ...baseSeal, questionCount: questions.length, paperCount: papers.length,
    runtimeFileSha256: hash(runtimeText), privateIndexSha256: hash(privateText), assetManifestSha256: hash(outputs.get(`docs/ib-economics-asset-manifests/${bank}-upload-manifest.json`)),
    contentSha256: runtimeArtifact.contentSha256, assetCount: mergedManifests[bank].assets.length,
  };
  receiptBanks[bank] = {
    level, questionCount, paperCount, assetCount: newAssetsByBank[bank].length, assetByteSize: runtimeArtifact.extension2026May.assetByteSize,
    questionIds: site.questions.map((q) => q.id), paperIds: site.papers.map((p) => p.id), marks: Object.fromEntries(site.questions.map((q) => [q.id, q.marks])),
    siteDataSha256: siteSha, runtimeContentSha256: runtimeArtifact.contentSha256,
  };
}
outputs.set("src/data/ib-economics-runtime-manifest.json", compact(newSeal));

// ---- plan (now executed), addition receipt
outputs.set("docs/ib-economics-2026-may-r2-upload-plan.json", pretty({
  schemaVersion: "ib-economics-2026-may-r2-upload-plan-v1",
  executed: true,
  note: "Executed create-only by the owner session; every key was absent before the put and every object was read back by SHA-256 and size. The committed log is the evidence.",
  executionLog: UPLOAD_LOG,
  executionLogSha256: hash(logText),
  provider: "r2",
  bucket: MAY_2026_PINS.bucket,
  createOnly: true,
  sourceRepository: MAY_2026_PINS.sourceRepository,
  sourceBranch: MAY_2026_PINS.sourceBranch,
  sourceCommit: MAY_2026_PINS.sourceCommit,
  sourceRootNote: "sourcePath is relative to the source worktree root; the WebPs are git-ignored there and rebuilt byte-identically by scripts/may_2026_lane.py check.",
  existingObjectsUntouched: `The ${baseObjectCount} verified 2021-2025 objects are not part of this plan.`,
  totals: { objects: allNew.length, bytes: newBytes, byBank: Object.fromEntries(banks.map(([bank]) => [bank, { objects: newAssetsByBank[bank].length, bytes: newAssetsByBank[bank].reduce((s, a) => s + a.byteSize, 0) }])) },
  objects: banks.flatMap(([bank]) => newAssetsByBank[bank].map((asset) => ({ bank, ...asset, contentType: "image/webp" }))),
}));
outputs.set("docs/ib-economics-2026-may-addition.json", pretty({
  schemaVersion: "ib-economics-2026-may-addition-v2",
  title: "IB Economics HL/SL May 2026 official papers",
  status: "folded_into_production_runtime",
  source: {
    repository: MAY_2026_PINS.sourceRepository, branch: MAY_2026_PINS.sourceBranch, commit: MAY_2026_PINS.sourceCommit, host: acquisition.source_host, papers: acquisition.pair_count,
    finalClassificationsSha256: finalSha, segmentationManifestSha256: segmentationSha, releaseTaxonomySha256: MAY_2026_PINS.releaseTaxonomySha256,
  },
  counts: {
    questionsAdded: Object.fromEntries(banks.map(([bank, , , q]) => [bank, q])),
    papersAdded: Object.fromEntries(banks.map(([bank, , , , p]) => [bank, p])),
    totalsAfter: Object.fromEntries(banks.map(([bank]) => [bank, { questions: newSeal.banks[bank].questionCount, papers: newSeal.banks[bank].paperCount }])),
    uniqueQuestions: 26, uniquePapers: 10, sharedHlSlQuestions: 6,
  },
  baseline: { commit: MAY_2026_PINS.baseCommit, banks: sealManifest.banks, note: "Sealed rows, papers and asset entries are a byte-identical prefix; scripts/verify-ib-economics-2026-may-addition.mjs proves it." },
  rights: { attestation: ATTESTATION, attestationSha256: attestationSha, status: "user_attested_non_blocking_for_named_corpus", independentLegalVerification: false },
  watermarkScan: { files: sourceScan.files, clean: sourceScan.clean, bibliographicCreditsOnly: sourceScan.bibliographic_credits_only, blocked: sourceScan.blocked.length, scannerSha256: sourceScan.scanner.sha256 },
  cropQa: { questionCropsViewed: cropQa.question_crops_viewed, markschemeCropsViewed: cropQa.markscheme_crops_viewed, verdict: cropQa.verdict, defects: cropQa.defects.length },
  tagging: {
    drex: { ...adjudication.drex, role: "triage only; flags were re-read against the question and mark scheme before any label changed" },
    drexV2OnDisagreements: adjudication.drex_v2_on_disagreements,
    blindPass: { primaryAgree: adjudication.stats.primary_agree, of: adjudication.stats.questions, meanDetailSetJaccard: adjudication.stats.set_jaccard_mean },
    inputsSha256: adjudication.inputs_sha256,
  },
  storage: { bucket: MAY_2026_PINS.bucket, receipt: COMBINED_RECEIPT, receiptSha256: receiptSha, manifestSha256: combinedManifestSha, objects: objectCount, bytes: byteSize, uploaded: { objects: allNew.length, bytes: newBytes, log: UPLOAD_LOG, logSha256: hash(logText) } },
  banks: receiptBanks,
}));

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
console.log(JSON.stringify({ sourceRoot, files: [...outputs.keys()], objectCount, byteSize, combinedManifestSha, receiptSha }, null, 2));
