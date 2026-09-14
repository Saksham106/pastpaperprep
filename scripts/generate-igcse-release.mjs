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

function finalizeQuestionStates(runtime) {
  for (const question of runtime.questions ?? []) {
    if (question.publicationStatus === 'local_preview_candidate') question.publicationStatus = 'production';
    if (question.classificationReviewStatus === 'candidate_not_approved') question.classificationReviewStatus = 'classified';
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

  finalizeQuestionStates(runtime);
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
