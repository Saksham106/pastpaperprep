#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  buildReleaseManifest,
  manifestSha256,
  RELEASE_BANKS,
  runtimeSha256,
  sha256,
} from './igcse-release.mjs';

export const ORIGINAL_CANDIDATE_RUNTIME_SHA256 = Object.fromEntries(
  Object.entries(RELEASE_BANKS).map(([bank, config]) => [bank, config.originalCandidateRuntimeSha256]),
);

export function assertOriginalCandidateRuntime(bank, runtime) {
  const expected = ORIGINAL_CANDIDATE_RUNTIME_SHA256[bank];
  const actual = runtime.runtimeArtifact?.originalCandidateRuntimeSha256;
  if (!expected || actual !== expected) throw new Error(`${bank} is not sealed to the exact original release candidate runtime`);
  const actualRuntimeSha = runtimeSha256(runtime);
  if (runtime.runtimeArtifact?.runtimeSha256 !== actualRuntimeSha) throw new Error(`${bank} production runtime self-seal mismatch`);
}

export async function generateRelease(bank, repo = resolve(import.meta.dirname, '..')) {
  const config = RELEASE_BANKS[bank];
  if (!config) throw new Error(`Usage: generate-igcse-release.mjs <${Object.keys(RELEASE_BANKS).join('|')}>`);
  const runtimePath = resolve(repo, 'src/data/production', `${bank}.json`);
  const sourceRoot = process.env[config.sourceRootEnv];
  const runtime = JSON.parse(await readFile(runtimePath, 'utf8'));
  assertOriginalCandidateRuntime(bank, runtime);
  if (!sourceRoot) throw new Error(`${config.sourceRootEnv} is required`);
  const manifest = await buildReleaseManifest({ bank, runtimePath, sourceRoot });
  const out = resolve(repo, 'data/storage', `${bank}.manifest.json`);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifest, out };
}

const UNRESOLVED_TAXONOMY_STATUS = 'unresolved_taxonomy_gap';

/**
 * Each entry authorizes the exact pre-finalization candidate states for one bank and the
 * exact number of unresolved taxonomy rows that must survive finalization. An unresolved
 * row is preserved fail-closed (never silently promoted to 'classified'), and any other
 * count or unknown state fails the finalization.
 */
const AUTHORIZED_PRODUCTION_CANDIDATE_STATES = {
  'igcse-biology-0610': { publicationStatus: 'authorized_production_candidate', classificationReviewStatuses: ['candidate_not_approved'], unresolvedCount: 0 },
  'igcse-economics-0455': { publicationStatus: 'authorized_production_candidate', classificationReviewStatuses: ['source_paired_review_completed_pending_release'], unresolvedCount: 0 },
  'igcse-coordinated-sciences-0654': { publicationStatus: 'authorized_production_candidate', classificationReviewStatuses: ['candidate_not_approved', UNRESOLVED_TAXONOMY_STATUS], unresolvedCount: 4 },
};

export function finalizeQuestionStates(runtime, bank) {
  const expected = AUTHORIZED_PRODUCTION_CANDIDATE_STATES[bank];
  if (!expected) throw new Error(`No authorized production candidate state mapping for ${bank}`);
  if (!Array.isArray(runtime?.questions) || runtime.questions.length === 0) {
    throw new Error(`${bank} must contain a non-empty question array before production finalization`);
  }
  for (const question of runtime.questions) {
    if (question.publicationStatus !== expected.publicationStatus || !expected.classificationReviewStatuses.includes(question.classificationReviewStatus)) throw new Error(`${bank} contains an unknown or unauthorized candidate question state`);
  }
  const unresolved = runtime.questions.filter((question) => question.classificationReviewStatus === UNRESOLVED_TAXONOMY_STATUS);
  if (unresolved.length !== expected.unresolvedCount) {
    throw new Error(`${bank} unresolved taxonomy row count ${unresolved.length} does not match the authorized ${expected.unresolvedCount}`);
  }
  for (const question of runtime.questions) {
    question.publicationStatus = 'production';
    question.classificationReviewStatus = question.classificationReviewStatus === UNRESOLVED_TAXONOMY_STATUS
      ? UNRESOLVED_TAXONOMY_STATUS
      : 'classified';
  }
}

export async function finalizeRelease(bank, repo = resolve(import.meta.dirname, '..')) {
  if (!RELEASE_BANKS[bank]) throw new Error(`Unknown release bank: ${bank}`);
  const runtimePath = resolve(repo, 'src/data/production', `${bank}.json`);
  const manifestPath = resolve(repo, 'data/storage', `${bank}.manifest.json`);
  const receiptPath = resolve(repo, 'data/storage', `${bank}.receipt.json`);
  const [runtimeText, manifestText, receiptText] = await Promise.all([
    readFile(runtimePath, 'utf8'), readFile(manifestPath, 'utf8'), readFile(receiptPath, 'utf8'),
  ]);
  const runtime = JSON.parse(runtimeText);
  const manifest = JSON.parse(manifestText);
  const receipt = JSON.parse(receiptText);
  assertOriginalCandidateRuntime(bank, runtime);
  if (manifest.bank !== bank || receipt.bank !== bank || receipt.storageState !== 'verified_readback') {
    throw new Error(`${bank} does not have a verified storage receipt`);
  }
  const expectedKeys = manifest.assets.map((asset) => asset.objectKey);
  if (receipt.completed?.length !== expectedKeys.length || expectedKeys.some((key) => !receipt.completed.includes(key))) {
    throw new Error(`${bank} storage receipt is incomplete`);
  }
  const expectedManifestSha = manifestSha256(manifest);
  if (receipt.assetManifestSha256 !== expectedManifestSha) throw new Error(`${bank} storage manifest seal mismatch`);

  finalizeQuestionStates(runtime, bank);
  runtime.releaseStatus = 'production';
  runtime.publicationStatus = 'production';
  runtime.assetVerification = 'verified_readback';
  runtime.runtimeArtifact.assetVerification = 'verified_readback';
  runtime.runtimeArtifact.publicationStatus = 'production';
  runtime.runtimeArtifact.assetManifestSha256 = expectedManifestSha;
  runtime.runtimeArtifact.storageReceiptSha256 = sha256(receiptText);
  runtime.runtimeArtifact.runtimeSha256 = null;
  runtime.runtimeArtifact.runtimeSha256 = runtimeSha256(runtime);
  await writeFile(runtimePath, `${JSON.stringify(runtime)}\n`);
  return {
    bank,
    runtimePath,
    runtimeSha256: runtime.runtimeArtifact.runtimeSha256,
    assetManifestSha256: expectedManifestSha,
    storageReceiptSha256: runtime.runtimeArtifact.storageReceiptSha256,
  };
}

async function runCli() {
  const finalize = process.argv[2] === '--finalize';
  const bank = finalize ? process.argv[3] : process.argv[2];
  if (finalize) {
    const result = await finalizeRelease(bank);
    console.log(`${bank}: finalized production runtime ${result.runtimeSha256}`);
    return;
  }
  const result = await generateRelease(bank);
  console.log(`${result.manifest.bank}: ${result.manifest.assets.length} referenced WebP objects; storageState=${result.manifest.storageState}; wrote ${result.out}`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
