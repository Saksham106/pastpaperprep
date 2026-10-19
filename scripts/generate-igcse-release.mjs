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
  'igcse-computer-science-0478': { publicationStatus: 'authorized_production_candidate', classificationReviewStatuses: ['candidate_not_approved'], unresolvedCount: 0 },
  'igcse-physics-0625': { publicationStatus: 'authorized_production_candidate', classificationReviewStatuses: ['candidate_not_approved', UNRESOLVED_TAXONOMY_STATUS], unresolvedCount: 336 },
};

const CHEMISTRY_EXTENSION_UNRESOLVED_COUNT = 28;
/** 2021-2025: finalized in the 3,441-row release and preserved since. */
const BIOLOGY_PRESERVED_BASE = {
  count: 3441,
  idsSha256: 'ac7402d11f008ca2e76d44eaa67aba85a79039d07f88214b1bbe020f2377543f',
};
/** 2019/2020/Feb-March 2026: authorized for, and finalized in, the 4,913-row release; preserved since. */
const BIOLOGY_FINALIZED_EXTENSION = {
  count: 1472,
  idsSha256: '310bf7a7f3f0d36b82acacc709e511eda0d52864c57420cc0027c924384f74dc',
};
/** May/June 2026: the only authorized candidates. */
const BIOLOGY_AUTHORIZED_2026_MAY_JUNE = {
  count: 298,
  idsSha256: 'eb34baa109216fa30293c71262fa2fa05420908aeaf610f3d7215902b4048a99',
};
/** The whole non-2021-2025 extension once May/June 2026 is finalized (1,472 + 298). */
const BIOLOGY_EXTENSION_THROUGH_2026_MAY_JUNE = {
  count: 1770,
  idsSha256: 'f257b8f0e664914344fca4f1f5dbcc405ec3c0bfcea7c4ac03a789540286bb41',
};
const ECONOMICS_BASE = {
  count: 1219,
  idsSha256: '73bd9bb1a8fc4e3d865e144ff27024adcccce8117a4bcd9bcc063127411c71a3',
};
const ECONOMICS_EXTENSION = {
  count: 504,
  idsSha256: 'cc6c5e1ed8df1a638fd8b34b99c5c6b995f9448d6bef864dce3203f421c310d0',
};
/** The 2026 lane: 139 practice rows (0455-2026-s-11-q26 is an official removal and never served). */
const ECONOMICS_2026 = {
  count: 139,
  idsSha256: '93ba2b6eb04395ec68970e707d6901f419ae2adc43381ca061c5c0b8142ccbaf',
};

function questionIdSetSha256(questions) {
  if (questions.some((question) => typeof question.id !== 'string' || !question.id)) return null;
  return sha256(questions.map((question) => question.id).sort().join('\n'));
}

function assertExactBiologyMixedState(runtime, bank) {
  if (bank !== 'igcse-biology-0610') return;
  const finalized = (question) => question.publicationStatus === 'production' && question.classificationReviewStatus === 'classified';
  const base = runtime.questions.filter((question) => question.year >= 2021 && question.year <= 2025);
  const extension = runtime.questions.filter((question) => !(question.year >= 2021 && question.year <= 2025));
  const candidates = runtime.questions.filter((question) => question.publicationStatus === 'authorized_production_candidate'
    && question.classificationReviewStatus === 'candidate_not_approved');
  const preservedExtension = extension.filter((question) => !candidates.includes(question));
  if (base.length !== BIOLOGY_PRESERVED_BASE.count || !base.every(finalized)
    || questionIdSetSha256(base) !== BIOLOGY_PRESERVED_BASE.idsSha256) {
    throw new Error(`${bank} preserved Biology base does not match the exact authorized question ID set`);
  }
  if (preservedExtension.length !== BIOLOGY_FINALIZED_EXTENSION.count || !preservedExtension.every(finalized)
    || questionIdSetSha256(preservedExtension) !== BIOLOGY_FINALIZED_EXTENSION.idsSha256) {
    throw new Error(`${bank} preserved Biology extension does not match the exact finalized question ID set`);
  }
  if (candidates.length !== BIOLOGY_AUTHORIZED_2026_MAY_JUNE.count
    || questionIdSetSha256(candidates) !== BIOLOGY_AUTHORIZED_2026_MAY_JUNE.idsSha256) {
    throw new Error(`${bank} Biology extension candidates do not match the exact authorized May/June 2026 question ID set`);
  }
  if (extension.length !== BIOLOGY_EXTENSION_THROUGH_2026_MAY_JUNE.count
    || questionIdSetSha256(extension) !== BIOLOGY_EXTENSION_THROUGH_2026_MAY_JUNE.idsSha256
    || base.length + extension.length !== runtime.questions.length) {
    throw new Error(`${bank} Biology extension does not match the exact authorized question ID set`);
  }
}

function assertExactEconomicsMixedState(runtime, bank) {
  if (bank !== 'igcse-economics-0455') return;
  // 2019-2025 was finalized in the 2019-2025 release; only the 2026 lane is still a candidate.
  const base = runtime.questions.filter((question) => question.year >= 2021 && question.year <= 2025);
  const extension = runtime.questions.filter((question) => question.year === 2019 || question.year === 2020);
  const lane2026 = runtime.questions.filter((question) => question.year === 2026);
  if (base.length !== ECONOMICS_BASE.count || questionIdSetSha256(base) !== ECONOMICS_BASE.idsSha256) {
    throw new Error(`${bank} preserved Economics base does not match the exact authorized question ID set`);
  }
  if (extension.length !== ECONOMICS_EXTENSION.count || questionIdSetSha256(extension) !== ECONOMICS_EXTENSION.idsSha256) {
    throw new Error(`${bank} Economics extension does not match the exact authorized question ID set`);
  }
  if (lane2026.length !== ECONOMICS_2026.count || questionIdSetSha256(lane2026) !== ECONOMICS_2026.idsSha256) {
    throw new Error(`${bank} Economics 2026 lane does not match the exact authorized question ID set`);
  }
  if (base.length + extension.length + lane2026.length !== runtime.questions.length) {
    throw new Error(`${bank} contains Economics rows outside the authorized cohorts`);
  }
  for (const question of [...base, ...extension]) {
    if (question.publicationStatus !== 'production' || question.classificationReviewStatus !== 'classified') {
      throw new Error(`${bank} preserved Economics base has been rewritten`);
    }
  }
  for (const question of lane2026) {
    if (question.publicationStatus !== 'authorized_production_candidate'
      || question.classificationReviewStatus !== 'source_paired_review_completed_pending_release') {
      throw new Error(`${bank} Economics 2026 lane contains an unknown or unauthorized candidate state`);
    }
  }
}

function finalizeChemistryQuestionStates(runtime, bank) {
  if (bank !== 'igcse-chemistry-0620') return false;
  if (!Array.isArray(runtime?.questions) || runtime.questions.length === 0) {
    throw new Error(`${bank} must contain a non-empty question array before production finalization`);
  }
  for (const question of runtime.questions) {
    if (question.publicationStatus !== 'production' || !['classified', UNRESOLVED_TAXONOMY_STATUS].includes(question.classificationReviewStatus)) {
      throw new Error(`${bank} contains an unknown or unauthorized candidate question state`);
    }
  }
  if (runtime.runtimeArtifact?.validatedExtensionUnlabeledGapCount !== CHEMISTRY_EXTENSION_UNRESOLVED_COUNT) {
    throw new Error(`${bank} unresolved extension label count does not match the authorized ${CHEMISTRY_EXTENSION_UNRESOLVED_COUNT}`);
  }
  return true;
}

export function finalizeQuestionStates(runtime, bank) {
  if (finalizeChemistryQuestionStates(runtime, bank)) return;
  const expected = AUTHORIZED_PRODUCTION_CANDIDATE_STATES[bank];
  if (!expected) throw new Error(`No authorized production candidate state mapping for ${bank}`);
  if (!Array.isArray(runtime?.questions) || runtime.questions.length === 0) {
    throw new Error(`${bank} must contain a non-empty question array before production finalization`);
  }
  assertExactBiologyMixedState(runtime, bank);
  assertExactEconomicsMixedState(runtime, bank);
  for (const question of runtime.questions) {
    const isAuthorizedCandidate = question.publicationStatus === expected.publicationStatus
      && expected.classificationReviewStatuses.includes(question.classificationReviewStatus);
    const isPreservedBiologyBase = bank === 'igcse-biology-0610'
      && question.publicationStatus === 'production'
      && question.classificationReviewStatus === 'classified';
    const isPreservedEconomicsBase = bank === 'igcse-economics-0455'
      && question.publicationStatus === 'production'
      && question.classificationReviewStatus === 'classified';
    if (!isAuthorizedCandidate && !isPreservedBiologyBase && !isPreservedEconomicsBase) {
      throw new Error(`${bank} contains an unknown or unauthorized candidate question state`);
    }
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
  runtime.runtimeArtifact.storageState = 'verified_readback';
  runtime.runtimeArtifact.publicationStatus = 'production';
  runtime.runtimeArtifact.assetManifestSha256 = expectedManifestSha;
  runtime.runtimeArtifact.storageReceiptSha256 = sha256(receiptText);
  runtime.runtimeArtifact.finalizedContentSha256 = sha256(JSON.stringify(runtime.questions));
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
