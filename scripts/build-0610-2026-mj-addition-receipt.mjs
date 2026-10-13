#!/usr/bin/env node
// Writes the 0610 May/June 2026 addition receipt and the dry-run R2 upload plan. Reads only local files:
// no storage client is created and no credentials are read, and the committed manifest/receipt are not touched.
// Usage: PASTPAPERPREP_IGCSE_BIOLOGY_SOURCE_ROOT=<source worktree> node scripts/build-0610-2026-mj-addition-receipt.mjs [--check]
import { createHash } from 'node:crypto';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { BASELINE_4913, LANE_2026_MJ } from './generate-igcse-biology-0610-extension-candidate.mjs';
import { assertExactBiologyCohortSeals, buildReleaseManifest, manifestSha256, RELEASE_BANKS } from './igcse-release.mjs';

const BANK = 'igcse-biology-0610';
const repo = resolve(import.meta.dirname, '..');
const sourceRoot = process.env[RELEASE_BANKS[BANK].sourceRootEnv];
if (!sourceRoot) throw new Error(`${RELEASE_BANKS[BANK].sourceRootEnv} is required`);
const hash = (algorithm, bytes) => createHash(algorithm).update(bytes).digest('hex');
const runtimePath = resolve(repo, 'src/data/production', `${BANK}.json`);
const runtimeText = await readFile(runtimePath, 'utf8');
const runtime = JSON.parse(runtimeText);
const committedManifestText = await readFile(resolve(repo, 'data/storage', `${BANK}.manifest.json`), 'utf8');
const committedReceiptText = await readFile(resolve(repo, 'data/storage', `${BANK}.receipt.json`), 'utf8');
const committedManifest = JSON.parse(committedManifestText);
const committedReceipt = JSON.parse(committedReceiptText);
// The committed manifest/receipt stay the historical verified pair of the 4,913-row release.
if (manifestSha256(committedManifest) !== BASELINE_4913.assetManifestSha256 || hash('sha256', committedReceiptText) !== BASELINE_4913.storageReceiptSha256
  || committedReceipt.assetManifestSha256 !== BASELINE_4913.assetManifestSha256 || committedReceipt.storageState !== 'verified_readback' || committedReceipt.failed.length !== 0
  || JSON.stringify([...committedReceipt.completed].sort()) !== JSON.stringify(committedManifest.assets.map((asset) => asset.objectKey).sort())
  || committedManifest.assets.length !== BASELINE_4913.assetCount) {
  throw new Error('committed manifest/receipt pair is not the verified 4,913-row baseline release');
}
assertExactBiologyCohortSeals(runtime);

const manifest = await buildReleaseManifest({ bank: BANK, runtimePath, sourceRoot });
if (manifest.objectPrefix !== committedManifest.objectPrefix) throw new Error('object prefix changed');
const verified = new Map(committedManifest.assets.map((asset) => [asset.objectKey, asset]));
for (const asset of manifest.assets) {
  const old = verified.get(asset.objectKey);
  if (old && (old.sha256 !== asset.sha256 || old.size !== asset.size)) throw new Error(`verified object would change: ${asset.objectKey}`);
}
if (committedManifest.assets.some((asset) => !manifest.assets.some((next) => next.objectKey === asset.objectKey))) throw new Error('a verified object is no longer referenced');
const canonicalSource = await realpath(sourceRoot);
const added = runtime.questions.slice(BASELINE_4913.questionCount);
const hashesByReference = new Map();
for (const q of added) for (const kind of ['questionImages', 'markschemeImages']) q[kind].forEach((reference) => hashesByReference.set(reference, q.id));
// Every new object must carry the SHA-256 the pinned May/June assembly recorded for its crop.
const assemblyBytes = await readFile(resolve(canonicalSource, LANE_2026_MJ.assembly));
if (hash('sha256', assemblyBytes) !== LANE_2026_MJ.assemblySha256) throw new Error('May/June 2026 assembly hash mismatch');
const assemblySha = new Map();
for (const row of JSON.parse(assemblyBytes).questions) {
  for (const image of row.source.images) assemblySha.set(`questions/${row.paper_id}/${image.path.split('/').at(-1)}`, image.sha256);
  for (const image of row.source.mark_scheme_images) assemblySha.set(`markschemes/${row.paper_id}/${image.path.split('/').at(-1)}`, image.sha256);
}
const objects = [];
for (const asset of manifest.assets.filter((item) => !verified.has(item.objectKey))) {
  const bytes = await readFile(asset.sourcePath);
  const reference = asset.objectKey.slice(manifest.objectPrefix.length);
  const [kind, paper] = reference.split('/');
  const questionId = hashesByReference.get(reference);
  const sourceRelative = relative(canonicalSource, asset.sourcePath);
  if (!paper.startsWith('0610-2026-s-') || !sourceRelative.startsWith(`${LANE_2026_MJ.segmentationLane}/assets/${paper}/${kind === 'questions' ? 'question' : 'markscheme'}/`) || !questionId) throw new Error(`unexpected new object ${asset.objectKey}`);
  if (hash('sha256', bytes) !== asset.sha256 || assemblySha.get(reference) !== asset.sha256 || bytes.length !== asset.size || bytes.subarray(0, 4).toString('latin1') !== 'RIFF' || bytes.subarray(8, 12).toString('latin1') !== 'WEBP') throw new Error(`source bytes mismatch ${asset.objectKey}`);
  objects.push({ key: asset.objectKey, questionId, kind: kind === 'questions' ? 'question' : 'markscheme', sourcePath: sourceRelative, sha256: asset.sha256, md5: hash('md5', bytes), bytes: bytes.length, contentType: asset.contentType });
}
const questionObjects = objects.filter((o) => o.kind === 'question').length;
const addition = runtime.runtimeArtifact.extension2026MayJune;
if (objects.length !== LANE_2026_MJ.assets || questionObjects !== addition.questionAssetCount || objects.length - questionObjects !== addition.markschemeAssetCount
  || manifest.assets.length !== BASELINE_4913.assetCount + LANE_2026_MJ.assets || hashesByReference.size !== LANE_2026_MJ.assets || assemblySha.size !== LANE_2026_MJ.assets) throw new Error('new object counts are not exact');

const plan = {
  schemaVersion: 1,
  addition: '0610-2026-may-june',
  mode: 'dry-run-plan-only',
  status: 'NOT UPLOADED',
  provider: 'cloudflare-r2',
  bucket: 'pastpaperprep-assets',
  storageClass: 'premium private release objects (2026 is not a 0610 free year; free year is 2021). No Supabase objects.',
  method: `buildReleaseManifest() from scripts/igcse-release.mjs over the May/June 2026 candidate runtime, minus the ${BASELINE_4913.assetCount.toLocaleString('en-US')} objects already verified by data/storage/${BANK}.receipt.json. No client was created and no credentials were read.`,
  objectPrefix: manifest.objectPrefix,
  source: { repository: 'igcse-biology-0610-topic-practice', branch: LANE_2026_MJ.sourceBranch, commit: LANE_2026_MJ.sourceCommitAtBuild, sourceRootEnv: RELEASE_BANKS[BANK].sourceRootEnv, lane: LANE_2026_MJ.segmentationLane },
  runtimeOriginalCandidateSha256: runtime.runtimeArtifact.originalCandidateRuntimeSha256,
  runtimeContentSha256: runtime.runtimeArtifact.contentSha256,
  fullReleaseManifest: { assetCount: manifest.assets.length, alreadyVerified: committedManifest.assets.length, new: objects.length, manifestSha256IfWritten: manifestSha256(manifest) },
  objectCount: objects.length,
  questionObjects,
  markschemeObjects: objects.length - questionObjects,
  totalBytes: objects.reduce((sum, o) => sum + o.bytes, 0),
  operatorNotes: [
    'Owner approval is required before any upload.',
    `npm run r2:sync does not handle ${BANK} (its SOURCES list has no 0610 entry); 0610 release objects go through scripts/igcse-release.mjs, which resolves sources from ${RELEASE_BANKS[BANK].sourceRootEnv}.`,
    `The May/June 2026 crops live only under ${LANE_2026_MJ.segmentationLane}/ of the source worktree on ${LANE_2026_MJ.sourceBranch}; the main source checkout does not have them until that branch lands. Point ${RELEASE_BANKS[BANK].sourceRootEnv} at a checkout that has all four lanes (data/segmentation/full-ms-repair, data/segmentation/full-extension, ${LANE_2026_MJ.segmentationLane} and the batch94 mark-scheme repair); the source worktree has them.`,
    `Upload: R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY plus ${RELEASE_BANKS[BANK].sourceRootEnv}, then node scripts/igcse-release.mjs --upload ${BANK}. It rewrites data/storage/${BANK}.manifest.json (${manifest.assets.length.toLocaleString('en-US')} objects), skips the ${BASELINE_4913.assetCount.toLocaleString('en-US')} keys already in the receipt, uploads these ${objects.length} create-only (IfNoneMatch), then GET-verifies all ${manifest.assets.length.toLocaleString('en-US')} and rewrites the receipt.`,
    `Then node scripts/generate-igcse-release.mjs --finalize ${BANK}, rerun the gates, and commit the manifest, receipt and finalized runtime together. Merge only after that: until finalized, the release gate keeps the whole 0610 bank closed (it requires verified_readback).`,
  ],
  objects,
};

const receipt = {
  schemaVersion: 1,
  addition: '0610-2026-may-june',
  status: 'authorized_production_candidate; storage upload and --finalize pending (operator-gated)',
  method: 'pure insertion: the finalized, secondaries-resealed 4,913-row runtime is kept byte-identical and in order; 298 May/June 2026 rows are appended. Proof: node scripts/verify-0610-2026-mj-addition.mjs',
  baseline: { ...BASELINE_4913, manifestFileSha256: hash('sha256', committedManifestText) },
  merged: {
    questionCount: runtime.questions.length, paperCount: runtime.paperCount, years: runtime.years,
    fileSha256: hash('sha256', runtimeText), runtimeSha256: runtime.runtimeArtifact.runtimeSha256,
    originalCandidateRuntimeSha256: runtime.runtimeArtifact.originalCandidateRuntimeSha256, sourceCandidateSha256: runtime.runtimeArtifact.sourceCandidateSha256,
    contentSha256: runtime.runtimeArtifact.contentSha256,
    baselinePrefixContentSha256: hash('sha256', JSON.stringify(runtime.questions.slice(0, BASELINE_4913.questionCount))),
  },
  lane2026MayJune: {
    ...addition,
    papers: [...new Set(added.map((q) => q.id.replace(/-q\d+$/, '')))].map((paper) => {
      const rows = added.filter((q) => q.id.startsWith(`${paper}-`));
      return { paper, questions: rows.length, marks: rows.reduce((sum, q) => sum + q.marks, 0) };
    }),
    primaryTopics: Object.fromEntries([...new Set(added.map((q) => q.primaryTopic))].sort().map((topic) => [topic, added.filter((q) => q.primaryTopic === topic).length])),
  },
  rows: added.map((q) => ({
    id: q.id, marks: q.marks, primaryTopic: q.primaryTopic, primaryTopicId: q.primaryTopicId, labelKey: q.classificationProvenance.labelKey,
    secondaryTopicIds: q.secondaryTopicIds, answer: q.answer,
    questionImages: q.questionImages.map((reference) => ({ reference, sha256: manifest.assets.find((asset) => asset.objectKey === manifest.objectPrefix + reference).sha256 })),
    markschemeImages: q.markschemeImages.map((reference) => ({ reference, sha256: manifest.assets.find((asset) => asset.objectKey === manifest.objectPrefix + reference).sha256 })),
  })),
};

const outputs = [
  [resolve(repo, 'docs/igcse-biology-0610-2026-mj-r2-upload-plan.json'), `${JSON.stringify(plan, null, 2)}\n`],
  [resolve(repo, 'docs/igcse-biology-0610-2026-mj-addition.json'), `${JSON.stringify(receipt, null, 2)}\n`],
];
for (const [file, text] of outputs) {
  if (process.argv.includes('--check')) {
    if (await readFile(file, 'utf8') !== text) throw new Error(`${file} is stale`);
  } else await writeFile(file, text);
}
console.log(JSON.stringify({ fullManifest: manifest.assets.length, newObjects: objects.length, questionObjects, markschemeObjects: objects.length - questionObjects, totalBytes: plan.totalBytes, rows: added.length }));
