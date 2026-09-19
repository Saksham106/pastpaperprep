#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export const RELEASE_BANKS = {
  'igcse-biology-0610': {
    prefix: 'igcse-biology-0610/releases/full3441-v2-ms-repair-49ebf7ad184c',
    sourceRootEnv: 'PASTPAPERPREP_IGCSE_BIOLOGY_SOURCE_ROOT',
    originalCandidateRuntimeSha256: 'd6ffc51bf6f31dce48c518e7404fd3599d26798243d509d889c12a0110c88ca3',
  },
  'igcse-economics-0455': {
    prefix: 'igcse-economics-0455/releases/repaired-v6-9fae73bcd2a9',
    sourceRootEnv: 'PASTPAPERPREP_IGCSE_ECONOMICS_SOURCE_ROOT',
    originalCandidateRuntimeSha256: '69bfa6b0519e30c0975ef7b549e338c3e2e2c0e2da458090aa9f6464195f89e5',
  },
  'igcse-chemistry-0620': {
    prefix: 'igcse-chemistry-0620/releases/candidate-v2-6eeb3fccddb4',
    sourceRootEnv: 'PASTPAPERPREP_IGCSE_CHEMISTRY_SOURCE_ROOT',
    originalCandidateRuntimeSha256: '81c706903aa94c6865336cf40027c26b33e0ba514082f4d8da2c576b9bb2cf87',
  },
  'igcse-physics-0625': {
    prefix: 'igcse-physics-0625/releases/repaired-v2-d95657a79bfc',
    sourceRootEnv: 'PASTPAPERPREP_IGCSE_PHYSICS_SOURCE_ROOT',
    originalCandidateRuntimeSha256: 'd95657a79bfcf5d80b9c7e9660c1d7795ea2026435610bb3e96ba2203e3d8cf7',
  },
  'igcse-coordinated-sciences-0654': {
    prefix: 'igcse-coordinated-sciences-0654/releases/full4721-v1-6b161eb9e580',
    sourceRootEnv: 'PASTPAPERPREP_IGCSE_COORDINATED_SOURCE_ROOT',
    originalCandidateRuntimeSha256: '8b0f2a37110a7a56a647cfbf17ecd156eaca1c507fdc3e82711d4c356cacd82a',
  },
};

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function validateObjectKey(key) {
  if (typeof key !== 'string' || !key || key.includes('\\') || key.startsWith('/') || !key.endsWith('.webp')) {
    throw new Error(`Unsafe storage object key: ${String(key)}`);
  }
  const parts = key.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) throw new Error(`Unsafe storage object key: ${key}`);
  return key;
}

export function verifySha256(bytes, expected, label = 'source') {
  const actual = sha256(bytes);
  if (expected && actual !== expected) throw new Error(`${label} SHA256 mismatch: expected ${expected}, got ${actual}`);
  return actual;
}

export function runtimeSha256(runtime) {
  const copy = JSON.parse(JSON.stringify(runtime));
  if (copy.runtimeArtifact) copy.runtimeArtifact.runtimeSha256 = null;
  return sha256(JSON.stringify(copy));
}

export function manifestSha256(manifest) {
  return sha256(JSON.stringify(manifest));
}

function references(question) {
  const values = [];
  for (const field of ['questionImages', 'markschemeImages']) {
    if (!Array.isArray(question?.[field])) throw new Error(`Runtime is missing ${field}`);
    values.push(...question[field]);
  }
  if (question?.officialMarkscheme !== undefined) {
    if (!question.officialMarkscheme || !Array.isArray(question.officialMarkscheme.images)) throw new Error('Runtime has malformed officialMarkscheme');
    values.push(...question.officialMarkscheme.images);
  }
  return values;
}

export function createRuntimeReferenceManifest(bank, runtime, files) {
  const config = RELEASE_BANKS[bank];
  if (!config) throw new Error(`Unknown release bank: ${bank}`);
  const assets = new Map();
  for (const question of runtime.questions ?? []) {
    for (const reference of references(question)) {
      validateObjectKey(`${bank}/${reference}`);
      if (!files.has(reference)) throw new Error(`Missing referenced asset: ${reference}`);
      const metadata = files.get(reference);
      assets.set(reference, {
        objectKey: `${config.prefix}/${reference}`,
        sourcePath: metadata.sourcePath,
        sha256: metadata.sha256,
        size: metadata.size,
        contentType: 'image/webp',
      });
    }
  }
  return {
    schemaVersion: 'igcse-private-assets-v1',
    bank,
    objectPrefix: `${config.prefix}/`,
    storageState: 'pending_upload',
    originalCandidateRuntimeSha256: runtime.runtimeArtifact?.originalCandidateRuntimeSha256 ?? null,
    contentSha256: runtime.runtimeArtifact?.contentSha256 ?? null,
    assets: [...assets.values()].sort((a, b) => a.objectKey.localeCompare(b.objectKey)),
  };
}

function sourceRelativePath(bank, reference, coordinatedLane) {
  const parts = reference.split('/');
  if (parts.length !== 3) throw new Error(`Unsupported referenced asset layout: ${reference}`);
  const [kind, paper, file] = parts;
  if (bank === 'igcse-biology-0610' && reference === 'markschemes/0610-2025-w-23/q2-row1-1.webp') {
    return 'data/classification/full-coverage-batch-repairs/batch94-ms/assets/0610-2025-w-23/markscheme/q2-row1-1.v2.webp';
  }
  if (bank === 'igcse-economics-0455' && reference === 'markschemes/0455-2025-s-22/q5-3-29.webp') {
    return 'data/classification/packet-028-source-repair-candidate/assets/0455-2025-s-22/markscheme/q5-3-29.webp';
  }
  if (bank === 'igcse-coordinated-sciences-0654') {
    if (!coordinatedLane) throw new Error(`Missing authoritative Co-ordinated Sciences source lane: ${paper}`);
    return `data/segmentation/repair-ms-closure-v1/build-a/${coordinatedLane}/assets/${paper}/${kind === 'questions' ? 'question' : 'markscheme'}/${file}`;
  }
  if (kind === 'questions') {
    if (bank === 'igcse-chemistry-0620') return `full-extension/assets/${paper}/question/${file}`;
    if (bank === 'igcse-physics-0625') {
      const year = Number(paper.split('-')[1]);
      const lane = year >= 2021 && year <= 2025 ? 'data/segmentation-repaired' : 'data/segmentation/full-extension-repaired';
      return `${lane}/assets/${paper}/question/${file}`;
    }
    if (bank === 'igcse-economics-0455') return `data/segmentation/full-repaired/assets/${paper}/question/${file}`;
    if (bank === 'igcse-biology-0610') return `data/segmentation/full-ms-repair/assets/${paper}/question/${file}`;
    return `data/segmentation/full/assets/${paper}/question/${file}`;
  }
  if (kind === 'markschemes') {
    if (bank === 'igcse-chemistry-0620') return `full-extension/assets/${paper}/markscheme/${file}`;
    if (bank === 'igcse-physics-0625') {
      const year = Number(paper.split('-')[1]);
      const lane = year >= 2021 && year <= 2025 ? 'data/segmentation-repaired' : 'data/segmentation/full-extension-repaired';
      return `${lane}/assets/${paper}/markscheme/${file}`;
    }
    if (bank === 'igcse-economics-0455') return `data/segmentation/full-repaired/assets/${paper}/markscheme/${file}`;
    if (bank === 'igcse-biology-0610') return `data/segmentation/full-ms-repair/assets/${paper}/markscheme/${file}`;
    return `data/segmentation/full/assets/${paper}/markscheme/${file}`;
  }
  throw new Error(`Unsupported referenced asset layout: ${reference}`);
}

function paperFromReference(reference) {
  const parts = reference.split('/');
  if (parts.length !== 3) throw new Error(`Unsupported referenced asset layout: ${reference}`);
  return parts[1];
}

export async function buildReleaseManifest({ bank, runtimePath, sourceRoot }) {
  const config = RELEASE_BANKS[bank];
  if (!config) throw new Error(`Unknown release bank: ${bank}`);
  const runtime = JSON.parse(await readFile(runtimePath, 'utf8'));
  if (runtime.runtimeArtifact?.originalCandidateRuntimeSha256 !== config.originalCandidateRuntimeSha256) {
    throw new Error(`${bank} original candidate runtime seal mismatch`);
  }
  const actualRuntimeSha = runtimeSha256(runtime);
  if (runtime.runtimeArtifact?.runtimeSha256 !== actualRuntimeSha) {
    throw new Error(`${bank} production runtime SHA256 mismatch: expected ${runtime.runtimeArtifact?.runtimeSha256}, got ${actualRuntimeSha}`);
  }

  const canonicalRoot = await realpath(sourceRoot);
  let coordinatedLanes = null;
  if (bank === 'igcse-coordinated-sciences-0654') {
    coordinatedLanes = new Map();
    for (const lane of ['base', 'extension-2020']) {
      const laneManifest = JSON.parse(await readFile(resolve(canonicalRoot, `data/segmentation/repair-ms-closure-v1/build-a/${lane}/full-manifest.json`), 'utf8'));
      for (const paperId of Object.keys(laneManifest.papers ?? {})) coordinatedLanes.set(paperId, lane);
    }
  }
  const files = new Map();
  for (const question of runtime.questions ?? []) {
    for (const reference of references(question)) {
      validateObjectKey(`${bank}/${reference}`);
      if (files.has(reference)) continue;
      const relativeSource = sourceRelativePath(bank, reference, coordinatedLanes?.get(paperFromReference(reference)));
      const candidates = bank === 'igcse-chemistry-0620'
        ? [relativeSource, relativeSource.replace('full-extension/', 'full/')]
        : [relativeSource];
      let candidate;
      let resolved;
      for (const relative of candidates) {
        const possible = resolve(canonicalRoot, relative);
        if (!possible.startsWith(`${canonicalRoot}${sep}`)) throw new Error(`Asset escapes source root: ${reference}`);
        try {
          resolved = await realpath(possible);
          candidate = possible;
          break;
        } catch {}
      }
      if (!candidate || !resolved) throw new Error(`Missing referenced asset: ${reference}`);
      if (resolved !== candidate) throw new Error(`Symlinked asset rejected: ${reference}`);
      const metadata = await stat(resolved);
      if (!metadata.isFile()) throw new Error(`Referenced asset is not a file: ${reference}`);
      const bytes = await readFile(resolved);
      files.set(reference, { sourcePath: resolved, size: metadata.size, sha256: verifySha256(bytes) });
    }
  }
  return createRuntimeReferenceManifest(bank, runtime, files);
}

async function remoteHash(client, bucket, asset) {
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: asset.objectKey }));
  const hash = createHash('sha256');
  let size = 0;
  for await (const chunk of response.Body) {
    hash.update(chunk);
    size += chunk.length;
  }
  if (size !== asset.size) throw new Error(`Remote size mismatch: ${asset.objectKey}`);
  const actual = hash.digest('hex');
  if (actual !== asset.sha256) throw new Error(`Remote SHA256 mismatch: ${asset.objectKey}`);
  return actual;
}

async function runConcurrent(items, concurrency, worker) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  });
  await Promise.all(workers);
}

export async function verifyRelease({ client, bucket, manifest, onProgress = () => {}, concurrency = 32 }) {
  const completed = new Set();
  let checkpoint = Promise.resolve();
  await runConcurrent(manifest.assets, concurrency, async (asset) => {
    await remoteHash(client, bucket, asset);
    completed.add(asset.objectKey);
    if (completed.size % 100 === 0 || completed.size === manifest.assets.length) {
      const snapshot = [...completed].sort();
      checkpoint = checkpoint.then(() => onProgress(snapshot));
      await checkpoint;
    }
  });
  await checkpoint;
  return {
    schemaVersion: 'igcse-upload-receipt-v1',
    bank: manifest.bank,
    storageState: 'verified_readback',
    assetManifestSha256: manifestSha256(manifest),
    completed: [...completed].sort(),
    failed: [],
  };
}

export async function uploadRelease({ client, bucket, manifest, receipt = {}, onReceipt = () => {}, concurrency = 32 }) {
  const completed = new Set(receipt.completed ?? []);
  const failed = [];
  let checkpoint = Promise.resolve();
  const persist = async (force = false) => {
    if (!force && completed.size % 100 !== 0) return;
    const snapshot = {
      schemaVersion: 'igcse-upload-receipt-v1',
      bank: manifest.bank,
      completed: [...completed].sort(),
      failed: [...failed],
    };
    checkpoint = checkpoint.then(() => onReceipt(snapshot));
    await checkpoint;
  };

  await runConcurrent(manifest.assets.filter((asset) => !completed.has(asset.objectKey)), concurrency, async (asset) => {
    try {
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: asset.objectKey,
        Body: await readFile(asset.sourcePath),
        ContentLength: asset.size,
        ContentType: asset.contentType,
        CacheControl: 'private, max-age=31536000, immutable',
        IfNoneMatch: '*',
      }));
      completed.add(asset.objectKey);
      await persist();
    } catch (error) {
      if (error?.$metadata?.httpStatusCode === 412 || error?.name === 'PreconditionFailed') {
        await remoteHash(client, bucket, asset);
        completed.add(asset.objectKey);
        await persist();
        return;
      }
      failed.push({ objectKey: asset.objectKey, error: String(error) });
      await persist(true);
      throw error;
    }
  });
  await persist(true);
  return verifyRelease({ client, bucket, manifest, concurrency, onProgress: async (verified) => {
    await onReceipt({ schemaVersion: 'igcse-upload-receipt-v1', bank: manifest.bank, completed: verified, failed: [] });
  } });
}

function makeR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) throw new Error('R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY are required');
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function runCli() {
  const mode = process.argv[2];
  const bank = process.argv[3];
  const config = RELEASE_BANKS[bank];
  if (!['--dry-run', '--upload', '--final-readback'].includes(mode) || !config) {
    throw new Error(`Usage: igcse-release.mjs --dry-run|--upload|--final-readback <${Object.keys(RELEASE_BANKS).join('|')}>`);
  }
  const repo = resolve(import.meta.dirname, '..');
  const runtimePath = resolve(repo, 'src/data/production', `${bank}.json`);
  const sourceRoot = process.env[config.sourceRootEnv];
  if (!sourceRoot) throw new Error(`${config.sourceRootEnv} is required`);
  const manifest = await buildReleaseManifest({ bank, runtimePath, sourceRoot });
  const storageDir = resolve(repo, 'data/storage');
  const manifestPath = resolve(storageDir, `${bank}.manifest.json`);
  const receiptPath = resolve(storageDir, `${bank}.receipt.json`);
  await mkdir(storageDir, { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  if (mode === '--dry-run') {
    console.log(`${bank}: ${manifest.assets.length} referenced WebP objects; manifest=${manifestPath}`);
    return;
  }
  const bucket = process.env.R2_BUCKET_NAME ?? 'pastpaperprep-assets';
  const client = makeR2Client();
  let receipt = {};
  try { receipt = JSON.parse(await readFile(receiptPath, 'utf8')); } catch {}
  const persist = (value) => writeFile(receiptPath, `${JSON.stringify(value, null, 2)}\n`);
  const result = mode === '--upload'
    ? await uploadRelease({ client, bucket, manifest, receipt, onReceipt: persist })
    : await verifyRelease({ client, bucket, manifest, onProgress: async (completed) => persist({ schemaVersion: 'igcse-upload-receipt-v1', bank, completed, failed: [] }) });
  await persist(result);
  console.log(`${bank}: ${result.storageState}; ${result.completed.length}/${manifest.assets.length} objects verified`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
