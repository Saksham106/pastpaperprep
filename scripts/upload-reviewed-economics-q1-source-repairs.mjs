// Uploads the reviewed 0455 Paper 2 Q1 source-material crops to the private R2 bucket with the
// logged-in wrangler CLI (no API keys). Rules (same as research/ppp-tools/wrangler-upload-2026.mjs):
// each key is checked absent first; an existing object with different bytes stops the run (never
// overwrite, never delete); put with --remote, image/webp and "private, max-age=31536000, immutable";
// every object is read back and compared by SHA-256 and size. Concurrency 2 with backoff.
// Resumable: verified keys in the log are re-read, not re-put.
//
// usage: WRANGLER_BIN=<wrangler> PASTPAPERPREP_IGCSE_ECONOMICS_SOURCE_ROOT=<source checkout> \
//        node scripts/upload-reviewed-economics-q1-source-repairs.mjs [--dry-run]
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readApprovedCandidate } from './reviewed-crop-source-path.mjs';

const BUCKET = 'pastpaperprep-assets';
const MANIFEST = 'data/storage/economics-q1-source-repairs.manifest.json';
const RECEIPT = 'data/storage/economics-q1-source-repairs.receipt.json';
const LOG = 'docs/economics-q1-source-repairs-r2-upload-log.jsonl';
const CONCURRENCY = 2;
const DRY = process.argv.includes('--dry-run');
const WRANGLER = process.env.WRANGLER_BIN;
const SOURCE_ROOT = process.env.PASTPAPERPREP_IGCSE_ECONOMICS_SOURCE_ROOT
  ?? '/Users/sakshamgoel/Documents/ProjectsInternships/igcse-economics-0455-topic-practice';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const run = (args) => new Promise((resolve) => {
  execFile(WRANGLER, args, { maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => resolve({ error, out: `${stdout}\n${stderr}` }));
});

const manifestBytes = readFileSync(MANIFEST);
const manifest = JSON.parse(manifestBytes);
const KEY = new RegExp(`^${manifest.objectPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}repairs/economics-q1-source-v1-[a-f0-9]{16}/([a-f0-9]{64})\\.webp$`);
if (manifest.schema !== 'economics-q1-source-repairs-v1' || manifest.bucket !== BUCKET ||
    manifest.objectPrefix !== 'igcse-economics-0455/releases/combined-2019-2025-e82f835aa7d/' ||
    manifest.objects.length !== manifest.objectCount || new Set(manifest.objects.map((o) => o.objectKey)).size !== manifest.objectCount) {
  throw new Error('Unexpected storage manifest');
}
const candidateRoot = join(SOURCE_ROOT, 'data/segmentation/p2-q1-source-repair/candidates');
const items = manifest.objects.map((o) => {
  const match = KEY.exec(o.objectKey);
  if (!match || match[1] !== o.sha256 || o.objectKey !== manifest.objectPrefix + o.relativePath || !o.relativePath.startsWith(`${manifest.namespace}/`)) {
    throw new Error(`Unsafe immutable key: ${o.objectKey}`);
  }
  const bytes = readApprovedCandidate(join(SOURCE_ROOT, o.sourcePath), candidateRoot);
  if (sha256(bytes) !== o.sha256 || bytes.length !== o.bytes) throw new Error(`Local candidate differs from the manifest: ${o.sourcePath}`);
  return { ...o, bytesBuffer: bytes };
});
const done = new Map();
if (existsSync(LOG)) for (const line of readFileSync(LOG, 'utf8').split('\n').filter(Boolean)) {
  const row = JSON.parse(line);
  if (row.status === 'verified') done.set(row.key, row);
}
console.log(`${items.length} planned objects; ${done.size} verified in log; local candidates match the manifest.`);
if (DRY) process.exit(0);
if (!WRANGLER) throw new Error('WRANGLER_BIN is required');

const dir = mkdtempSync(join(tmpdir(), 'ppp-0455-q1-'));
async function fetchRemote(key) {
  const file = join(dir, `${createHash('md5').update(key).digest('hex')}.bin`);
  rmSync(file, { force: true });
  for (let attempt = 1; attempt <= 5; attempt++) {
    const { error, out } = await run(['r2', 'object', 'get', `${BUCKET}/${key}`, '--remote', '--file', file]);
    if (!error && existsSync(file)) { const bytes = readFileSync(file); rmSync(file, { force: true }); return bytes; }
    if (/does not exist|not found|404|NoSuchKey/i.test(out)) return null;
    await sleep(1000 * attempt * attempt);
  }
  throw new Error(`get failed repeatedly: ${key}`);
}
async function put(item) {
  const file = join(dir, `${item.sha256}.webp`);
  writeFileSync(file, item.bytesBuffer);
  try {
    for (let attempt = 1; attempt <= 5; attempt++) {
      const { error, out } = await run(['r2', 'object', 'put', `${BUCKET}/${item.objectKey}`, '--remote', '--file', file,
        '--content-type', 'image/webp', '--cache-control', 'private, max-age=31536000, immutable']);
      if (!error) return;
      if (attempt === 5) throw new Error(`put failed: ${item.objectKey}: ${out.slice(-300)}`);
      await sleep(1000 * attempt * attempt);
    }
  } finally { rmSync(file, { force: true }); }
}

const records = [];
let cursor = 0;
let failure;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (!failure && cursor < items.length) {
    const item = items[cursor++];
    try {
      // Read-only: the superseded live object must hold exactly the bytes judged defective.
      const superseded = await fetchRemote(item.supersedes.objectKey);
      if (!superseded || sha256(superseded) !== item.supersedes.sha256) throw new Error(`Superseded live object differs: ${item.supersedes.objectKey}`);
      const prior = done.get(item.objectKey);
      let existedBefore = prior?.existedBefore ?? false;
      if (!prior) {
        const before = await fetchRemote(item.objectKey);
        if (before) {
          if (sha256(before) !== item.sha256 || before.length !== item.bytes) throw new Error(`STOP: ${item.objectKey} already exists with different content; not overwriting.`);
          existedBefore = true;
        } else {
          await put(item);
        }
      }
      // Always re-read: a log line is not fresh proof of the stored bytes.
      const after = await fetchRemote(item.objectKey);
      if (!after || after.length !== item.bytes || sha256(after) !== item.sha256) throw new Error(`Readback mismatch: ${item.objectKey}`);
      const row = { key: item.objectKey, questionId: item.questionId, sha256: item.sha256, bytes: item.bytes, status: 'verified', existedBefore, supersededKeyUnchanged: true, at: new Date().toISOString() };
      if (!prior) appendFileSync(LOG, `${JSON.stringify(row)}\n`);
      records.push({ objectKey: item.objectKey, sha256: item.sha256, bytes: item.bytes, contentType: 'image/webp', cacheControl: 'private, max-age=31536000, immutable', existedBefore, verifiedAt: prior?.at ?? row.at,
        supersedes: { objectKey: item.supersedes.objectKey, sha256: item.supersedes.sha256, verifiedUnchanged: true } });
    } catch (error) { failure = error; }
  }
}));
rmSync(dir, { recursive: true, force: true });
if (failure) throw failure;
if (records.length !== items.length) throw new Error('Incomplete readback');
records.sort((a, b) => a.objectKey.localeCompare(b.objectKey));
writeFileSync(RECEIPT, `${JSON.stringify({
  schema: 'economics-q1-source-repairs-readback-v1', state: 'verified_readback', bucket: BUCKET,
  method: 'wrangler r2 object get/put --remote (logged-in CLI): key checked absent, put image/webp + private, max-age=31536000, immutable, full GET readback SHA-256 + size',
  manifestSha256: sha256(manifestBytes), objectCount: records.length, uploaded: records.filter((r) => !r.existedBefore).length,
  overwritten: 0, logSha256: sha256(readFileSync(LOG)), records,
}, null, 1)}\n`);
console.log(JSON.stringify({ state: 'verified_readback', objects: records.length, uploaded: records.filter((r) => !r.existedBefore).length }));
