// Uploads the reviewed 0455 Paper 2 Q1 source-material crops to the private R2 bucket with the
// logged-in wrangler CLI (no API keys). Rules (from research/ppp-tools/wrangler-upload-2026.mjs):
// each key is checked absent first; an existing object with different bytes stops the run; put with
// --remote, image/webp and "private, max-age=31536000, immutable"; every object is read back and compared
// by SHA-256 and size. Nothing is deleted. Concurrency 2 with backoff. Resumable: verified keys in the
// log are re-read, not re-put.
//
// Guarantee (SINGLE_WRITER_GUARANTEE): check-absent → put → read-back, serialized by one local writer
// (an exclusive lock, scripts/lib/single-writer-lock.mjs). That detects pre-existing different bytes before
// writing and corrupt bytes after writing. It is not an atomic create: wrangler has no conditional put, so a
// concurrent foreign writer between the check and the put cannot be ruled out.
//
// usage: WRANGLER_BIN=<wrangler> PASTPAPERPREP_IGCSE_ECONOMICS_SOURCE_ROOT=<source checkout> \
//        node scripts/upload-reviewed-economics-q1-source-repairs.mjs [--dry-run | --receipt-only]
// --receipt-only re-renders the receipt from the committed manifest and log without contacting storage.
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readApprovedCandidate } from './reviewed-crop-source-path.mjs';
import { SINGLE_WRITER_GUARANTEE, acquireSingleWriterLock } from './lib/single-writer-lock.mjs';

export const LOCK_NAME = 'economics-q1-source-repairs';
const BUCKET = 'pastpaperprep-assets';
const MANIFEST = 'data/storage/economics-q1-source-repairs.manifest.json';
const RECEIPT = 'data/storage/economics-q1-source-repairs.receipt.json';
const LOG = 'docs/economics-q1-source-repairs-r2-upload-log.jsonl';
const CONTENT_TYPE = 'image/webp';
const CACHE_CONTROL = 'private, max-age=31536000, immutable';
const CONCURRENCY = 2;

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The readback receipt, rendered only from the manifest and the append-only log. Every planned object
 * needs exactly one verified log row with the manifest's SHA-256 and size.
 */
export function renderReceipt(manifestBytes, logBytes) {
  const manifest = JSON.parse(manifestBytes);
  const rows = new Map();
  for (const line of logBytes.toString('utf8').split('\n').filter(Boolean)) {
    const row = JSON.parse(line);
    if (row.status !== 'verified') continue;
    if (rows.has(row.key)) throw new Error(`Duplicate verified log row: ${row.key}`);
    rows.set(row.key, row);
  }
  const records = manifest.objects.map((o) => {
    const row = rows.get(o.objectKey);
    if (!row) throw new Error(`No verified log row: ${o.objectKey}`);
    if (row.sha256 !== o.sha256 || row.bytes !== o.bytes || row.supersededKeyUnchanged !== true) throw new Error(`Log row disagrees with the manifest: ${o.objectKey}`);
    return { objectKey: o.objectKey, sha256: o.sha256, bytes: o.bytes, contentType: CONTENT_TYPE, cacheControl: CACHE_CONTROL, existedBefore: row.existedBefore === true, verifiedAt: row.at,
      supersedes: { objectKey: o.supersedes.objectKey, sha256: o.supersedes.sha256, verifiedUnchanged: true } };
  });
  if (rows.size !== records.length) throw new Error('Log has verified rows outside the manifest');
  const locked = [...rows.values()].filter((row) => row.writerLock === true).length;
  records.sort((a, b) => a.objectKey.localeCompare(b.objectKey));
  return `${JSON.stringify({
    schema: 'economics-q1-source-repairs-readback-v2', state: 'verified_readback', bucket: BUCKET,
    method: `wrangler r2 object get/put --remote (logged-in CLI): key checked absent, put ${CONTENT_TYPE} + ${CACHE_CONTROL}, full GET readback SHA-256 + size`,
    guarantee: SINGLE_WRITER_GUARANTEE,
    writerLock: locked === rows.size ? 'held for every row' : locked === 0 ? 'none: these rows predate the writer lock' : `held for ${locked} of ${rows.size} rows`,
    manifestSha256: sha256(manifestBytes), objectCount: records.length, uploaded: records.filter((r) => !r.existedBefore).length,
    preExistingConflictsDetected: 0, logSha256: sha256(logBytes), records,
  }, null, 1)}\n`;
}

async function upload(dry) {
  // One writer at a time, taken before any storage call.
  if (!dry) acquireSingleWriterLock(LOCK_NAME);
  const WRANGLER = process.env.WRANGLER_BIN;
  const SOURCE_ROOT = process.env.PASTPAPERPREP_IGCSE_ECONOMICS_SOURCE_ROOT
    ?? '/Users/sakshamgoel/Documents/ProjectsInternships/igcse-economics-0455-topic-practice';
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
  const planned = new Map(items.map((o) => [o.objectKey, o]));
  const done = new Map();
  if (existsSync(LOG)) for (const line of readFileSync(LOG, 'utf8').split('\n').filter(Boolean)) {
    const row = JSON.parse(line);
    if (row.status !== 'verified') continue;
    const item = planned.get(row.key);
    if (!item || row.sha256 !== item.sha256 || row.bytes !== item.bytes) throw new Error(`Log row disagrees with the manifest: ${row.key}`);
    done.set(row.key, row);
  }
  console.log(`${items.length} planned objects; ${done.size} verified in log; local candidates match the manifest.`);
  if (dry) return;
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
          '--content-type', CONTENT_TYPE, '--cache-control', CACHE_CONTROL]);
        if (!error) return;
        if (attempt === 5) throw new Error(`put failed: ${item.objectKey}: ${out.slice(-300)}`);
        await sleep(1000 * attempt * attempt);
      }
    } finally { rmSync(file, { force: true }); }
  }

  let verified = 0;
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
            if (sha256(before) !== item.sha256 || before.length !== item.bytes) throw new Error(`STOP: ${item.objectKey} already exists with different content; not writing.`);
            existedBefore = true;
          } else {
            await put(item);
          }
        }
        // Always re-read: a log line is not fresh proof of the stored bytes.
        const after = await fetchRemote(item.objectKey);
        if (!after || after.length !== item.bytes || sha256(after) !== item.sha256) throw new Error(`Readback mismatch: ${item.objectKey}`);
        if (!prior) appendFileSync(LOG, `${JSON.stringify({ key: item.objectKey, questionId: item.questionId, sha256: item.sha256, bytes: item.bytes, status: 'verified', existedBefore, supersededKeyUnchanged: true, writerLock: true, at: new Date().toISOString() })}\n`);
        verified++;
      } catch (error) { failure = error; }
    }
  }));
  rmSync(dir, { recursive: true, force: true });
  if (failure) throw failure;
  if (verified !== items.length) throw new Error('Incomplete readback');
  const receipt = renderReceipt(manifestBytes, readFileSync(LOG));
  writeFileSync(RECEIPT, receipt);
  console.log(JSON.stringify({ state: 'verified_readback', objects: verified, uploaded: JSON.parse(receipt).uploaded }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--receipt-only')) {
    writeFileSync(RECEIPT, renderReceipt(readFileSync(MANIFEST), readFileSync(LOG)));
    console.log(`Rendered ${RECEIPT} from ${LOG}; storage not contacted.`);
  } else {
    await upload(process.argv.includes('--dry-run'));
  }
}
