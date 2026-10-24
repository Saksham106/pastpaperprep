// Uploads the reviewed 0455-2022-s-21 mark-scheme row crops (data/storage/economics-ms-row-repairs.manifest.json) to the
// private R2 bucket with the logged-in wrangler CLI (no API keys), following scripts/upload-reviewed-economics-q1-source-repairs.mjs:
// each key is checked absent first and an existing object with different bytes stops the run; put with --remote,
// image/webp and "private, max-age=31536000, immutable"; every object is read back in full and compared by SHA-256
// and size, then the receipt is written. Keys are content-addressed in a new namespace; nothing is replaced or deleted.
// Uploading needs owner approval.
//
// Guarantee (SINGLE_WRITER_GUARANTEE): check-absent → put → read-back, serialized by one local writer
// (scripts/lib/single-writer-lock.mjs). Not an atomic create: wrangler has no conditional put.
//
// usage: WRANGLER_BIN=<wrangler> node scripts/upload-reviewed-economics-ms-row-repairs.mjs <research package dir> [--dry-run]
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readApprovedCandidate } from './reviewed-crop-source-path.mjs';
import { SINGLE_WRITER_GUARANTEE, acquireSingleWriterLock } from './lib/single-writer-lock.mjs';

const BUCKET = 'pastpaperprep-assets';
const PREFIX = 'igcse-economics-0455/releases/combined-2019-2025-e82f835aa7d/';
const MANIFEST = 'data/storage/economics-ms-row-repairs.manifest.json';
const RECEIPT = 'data/storage/economics-ms-row-repairs.receipt.json';
const CONTENT_TYPE = 'image/webp';
const CACHE_CONTROL = 'private, max-age=31536000, immutable';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const research = process.argv[2];
const dry = process.argv.includes('--dry-run');
if (!research || research.startsWith('--')) throw new Error('pass the economics-ms-row-repair package directory');
const manifestBytes = readFileSync(MANIFEST);
const manifest = JSON.parse(manifestBytes);
const overlay = JSON.parse(readFileSync('src/data/reviewed-economics-ms-row-repairs.json', 'utf8'));
if (manifest.schema !== 'economics-ms-row-repairs-upload-v1' || manifest.namespace !== overlay.namespace || !/^repairs\/economics-ms-rows-v1-[a-f0-9]{16}$/.test(manifest.namespace)) {
  throw new Error('Manifest disagrees with the reviewed projection');
}
// Every new path of the projection is exactly one manifest object.
const wanted = [...new Set(Object.values(overlay.entries).flatMap((e) => e.newPaths.filter((p) => p.startsWith(`${manifest.namespace}/`)).map((p) => PREFIX + p)))].sort();
if (manifest.objectCount !== wanted.length || JSON.stringify(manifest.objects.map((o) => o.objectKey)) !== JSON.stringify(wanted)) throw new Error('Reviewed object set disagreement');
const imageRoot = join(research, 'build-a', 'images');
const items = manifest.objects.map((o) => {
  if (o.objectKey !== `${PREFIX}${manifest.namespace}/${o.sha256}.webp`) throw new Error(`Unsafe immutable key: ${o.objectKey}`);
  const bytes = readApprovedCandidate(join(imageRoot, `${o.sha256}.webp`), imageRoot);
  if (sha256(bytes) !== o.sha256 || bytes.length !== o.bytes) throw new Error(`Local candidate differs from the manifest: ${o.sha256}`);
  return { ...o, data: bytes };
});
console.log(`${items.length} planned objects; local candidates match the manifest.`);

if (!dry) {
  // One writer at a time, taken before any storage call.
  acquireSingleWriterLock('economics-ms-row-repairs');
  const WRANGLER = process.env.WRANGLER_BIN;
  if (!WRANGLER) throw new Error('WRANGLER_BIN is required');
  const run = (args) => new Promise((resolve) => {
    execFile(WRANGLER, args, { maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => resolve({ error, out: `${stdout}\n${stderr}` }));
  });
  const dir = mkdtempSync(join(tmpdir(), 'ppp-0455-ms-rows-'));
  const fetchRemote = async (key) => {
    const file = join(dir, `${createHash('md5').update(key).digest('hex')}.bin`);
    rmSync(file, { force: true });
    for (let attempt = 1; attempt <= 5; attempt++) {
      const { error, out } = await run(['r2', 'object', 'get', `${BUCKET}/${key}`, '--remote', '--file', file]);
      if (!error && existsSync(file)) { const bytes = readFileSync(file); rmSync(file, { force: true }); return bytes; }
      if (/does not exist|not found|404|NoSuchKey/i.test(out)) return null;
      await sleep(1000 * attempt * attempt);
    }
    throw new Error(`get failed repeatedly: ${key}`);
  };
  const records = [];
  try {
    // Serial: four small objects.
    for (const item of items) {
      const before = await fetchRemote(item.objectKey);
      if (before && (sha256(before) !== item.sha256 || before.length !== item.bytes)) throw new Error(`STOP: ${item.objectKey} already exists with different content; not writing.`);
      if (!before) {
        const file = join(dir, `${item.sha256}.webp`);
        writeFileSync(file, item.data);
        const { error, out } = await run(['r2', 'object', 'put', `${BUCKET}/${item.objectKey}`, '--remote', '--file', file, '--content-type', CONTENT_TYPE, '--cache-control', CACHE_CONTROL]);
        rmSync(file, { force: true });
        if (error) throw new Error(`put failed: ${item.objectKey}: ${out.slice(-300)}`);
      }
      // Always re-read in full.
      const after = await fetchRemote(item.objectKey);
      if (!after || after.length !== item.bytes || sha256(after) !== item.sha256) throw new Error(`Readback mismatch: ${item.objectKey}`);
      records.push({ objectKey: item.objectKey, sha256: item.sha256, bytes: item.bytes, existedBefore: Boolean(before), verifiedAt: new Date().toISOString() });
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
  writeFileSync(RECEIPT, `${JSON.stringify({
    schema: 'economics-ms-row-repairs-readback-v1', state: 'verified_readback', bucket: BUCKET,
    method: `wrangler r2 object get/put --remote (logged-in CLI): key checked absent, put ${CONTENT_TYPE} + ${CACHE_CONTROL}, full GET readback SHA-256 + size`,
    guarantee: SINGLE_WRITER_GUARANTEE, writerLock: 'held for every row',
    manifestSha256: sha256(manifestBytes), objectCount: records.length, uploaded: records.filter((r) => !r.existedBefore).length,
    records: records.sort((a, b) => a.objectKey.localeCompare(b.objectKey)),
  }, null, 1)}\n`);
  console.log(JSON.stringify({ state: 'verified_readback', objects: records.length }));
}
