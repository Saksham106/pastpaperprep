/**
 * Publishes only the free past-paper PDFs a change adds, without re-putting live objects, then
 * re-verifies every approved PDF from free.pastpaperprep.com. Uploading publishes the files: owner approval required (AGENTS.md).
 * Needs `wrangler login`; no keys.
 *
 *   npx tsx scripts/publish-added-free-papers.mts plan   <base-ref> <source-bindings.json> <work-dir>
 *   npx tsx scripts/publish-added-free-papers.mts upload <base-ref> <source-bindings.json> <work-dir>
 *   npx tsx scripts/publish-added-free-papers.mts verify <work-dir>
 *
 * `publish-free-papers.mts upload` re-puts every approved PDF its work list hasn't logged, which
 * overwrites live objects, and its `list` needs source bindings for all of them. This tool touches
 * only PDFs that the committed manifests approve and `<base-ref>`'s manifests don't. For each one it
 * hash-checks a private staged copy of the bound source, checks the key is absent with
 * `wrangler r2 object get` (an existing object with the same bytes is left alone; different bytes
 * abort the run), puts it with the publisher's headers, and reads it back with wrangler (SHA-256
 * and size). It refuses to run if an existing object's download name would change, because that
 * needs a re-put and a cache purge.
 *
 * Guarantee (SINGLE_WRITER_GUARANTEE): check-absent → put → read-back, serialized by one local writer.
 * `upload` takes an exclusive lock (scripts/lib/single-writer-lock.mjs) before reading anything, so a
 * second run fails at once. That detects pre-existing different bytes before writing and corrupt bytes
 * after writing. It is not an atomic create: wrangler has no conditional put, so a concurrent foreign
 * writer between the check and the put cannot be ruled out. `verify` is the publisher's readback: every approved PDF from
 * the public origin (bytes, type, filename), and it writes src/data/paper-archive-readback.json only
 * if all match and the manifests didn't change. WRANGLER_BIN picks the wrangler binary; JOBS (default
 * 2) the number of parallel uploads. Every event is logged to <work-dir>/log/*.jsonl; any failure
 * exits nonzero.
 */
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { canonicalRoot, privateStaging, readConfined, safeSegments, workerCount } from './lib/safe-files';
import { SINGLE_WRITER_GUARANTEE, acquireSingleWriterLock } from './lib/single-writer-lock.mjs';
import { FREE_PAPER_ORIGIN, approvedPapers, objectDownloadNames, paperMappingDigest, paperObjectKey, paperObjectUrl, paperObjectsDigest, type PublicReadback } from '../src/lib/whole-paper-public';
import type { WholePaperManifest } from '../src/lib/whole-paper-types';

const BUCKET = 'pastpaperprep-free';
const LOCK_NAME = 'publish-added-free-papers';
const DIR = 'src/data/paper-archives';
const MAX_PDF_BYTES = 100 * 1024 * 1024;
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,150}\.pdf$/;
const CACHE_CONTROL = 'public, max-age=604800';
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const wrangler = () => (process.env.WRANGLER_BIN ? [process.env.WRANGLER_BIN] : ['npx', '-y', 'wrangler@4']);

type Objects = Map<string, { bytes: number; name: string }>;
type Approved = { objects: Objects; objectsSha256: string; mappingSha256: string };
function approvedFrom(manifests: WholePaperManifest[]): Approved {
  const papers = approvedPapers(manifests);
  const names = objectDownloadNames(papers);
  return {
    objects: new Map([...papers.sizes].map(([sha, bytes]) => [sha, { bytes, name: names.get(sha)! }])),
    objectsSha256: paperObjectsDigest(papers.sizes), mappingSha256: paperMappingDigest(papers.refs),
  };
}
const current = () => approvedFrom(readdirSync(DIR).filter(f => f.endsWith('.json')).sort()
  .map(f => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as WholePaperManifest));
function atRef(ref: string): Approved {
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,100}$/.test(ref)) throw new Error(`Unsafe git ref ${ref}`);
  const files = execFileSync('git', ['ls-tree', '--name-only', `${ref}:${DIR}`], { encoding: 'utf8' }).split('\n').filter(f => f.endsWith('.json')).sort();
  return approvedFrom(files.map(f => JSON.parse(execFileSync('git', ['show', `${ref}:${DIR}/${f}`], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })) as WholePaperManifest));
}
const seal = (a: Approved) => `${a.objectsSha256}:${a.mappingSha256}:${[...a.objects].map(([sha, o]) => `${sha}=${o.name}`).sort().join(',')}`;

type Row = { sha256: string; bytes: number; name: string; root: string; relativePath: string };
/** The PDFs approved now but not at `base`; refuses renamed existing objects and unbound sources. */
function added(base: string, bindingsPath: string): { rows: Row[]; now: Approved } {
  const before = atRef(base), now = current();
  const renamed = [...now.objects].filter(([sha, o]) => before.objects.has(sha) && before.objects.get(sha)!.name !== o.name);
  if (renamed.length) throw new Error(`Existing objects would change filename (needs re-put and purge): ${renamed.map(([sha]) => sha).join(', ')}`);
  const bindings = JSON.parse(readFileSync(bindingsPath, 'utf8')) as { roots: { id: string; path: string }[]; documents: { rootId: string; relativePath: string; sha256: string }[] };
  const roots = new Map(bindings.roots.map(r => [r.id, r.path]));
  const rows: Row[] = [];
  for (const [sha, o] of [...now.objects].filter(([sha]) => !before.objects.has(sha)).sort(([a], [b]) => a.localeCompare(b))) {
    const doc = bindings.documents.find(d => d.sha256 === sha && roots.has(d.rootId));
    if (!doc) throw new Error(`No source binding for ${sha}`);
    if (!SAFE_NAME.test(o.name)) throw new Error(`Unsafe download name ${o.name}`);
    safeSegments(doc.relativePath);
    rows.push({ sha256: sha, bytes: o.bytes, name: o.name, root: canonicalRoot(roots.get(doc.rootId)!), relativePath: doc.relativePath });
  }
  return { rows, now };
}
function readSource(r: Row): Buffer {
  const bytes = readConfined(r.root, r.relativePath, MAX_PDF_BYTES);
  if (bytes.length !== r.bytes || !bytes.subarray(0, 5).equals(Buffer.from('%PDF-')) || sha256(bytes) !== r.sha256) throw new Error(`Source for ${r.sha256} doesn't match its approved bytes`);
  return bytes;
}
const run = (args: string[]) => new Promise<{ code: number; out: Buffer; err: string }>(ok => {
  const [cmd, ...rest] = [...wrangler(), ...args];
  const child = spawn(cmd, rest, { stdio: ['ignore', 'pipe', 'pipe'] });
  const out: Buffer[] = [], err: Buffer[] = [];
  child.stdout.on('data', c => out.push(c));
  child.stderr.on('data', c => err.push(c));
  child.on('error', e => ok({ code: 1, out: Buffer.alloc(0), err: String(e) }));
  child.on('close', code => ok({ code: code ?? 1, out: Buffer.concat(out), err: Buffer.concat(err).toString() + Buffer.concat(out).toString() }));
});
async function pool<T>(items: T[], jobs: number, work: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: jobs }, async () => { while (next < items.length) await work(items[next++]); }));
}
function workDir(path: string) {
  mkdirSync(join(path, 'log'), { recursive: true });
  const root = canonicalRoot(resolve(path));
  if (lstatSync(join(root, 'log')).isSymbolicLink()) throw new Error(`Refusing symlinked log directory in ${root}`);
  return root;
}
/** Local writes (plan, logs, receipt) never follow a symlink. */
function plainTarget(file: string) {
  if (lstatSync(file, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error(`Refusing to write through a symlink: ${file}`);
  return file;
}
const log = (file: string, event: Record<string, unknown>) => appendFileSync(plainTarget(file), JSON.stringify({ at: new Date().toISOString(), ...event }) + '\n');

/** Remote object bytes, or null when the key does not exist. Throws on any other wrangler failure. */
async function remoteGet(key: string, dest: string): Promise<Buffer | null> {
  rmSync(dest, { force: true });
  const { code, err } = await run(['r2', 'object', 'get', `${BUCKET}/${key}`, '--remote', '--file', dest]);
  try {
    if (code === 0 && existsSync(dest)) return readFileSync(dest);
    if (/The specified key does not exist/.test(err)) return null;
    throw new Error(`wrangler get ${key} failed: ${err.replace(/\s+/g, ' ').slice(-300)}`);
  } finally { rmSync(dest, { force: true }); }
}
async function withRetry<T>(what: string, logFile: string, task: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try { return await task(); } catch (error) {
      if (attempt >= 5) throw error;
      const wait = 5_000 * 2 ** (attempt - 1);
      log(logFile, { event: 'retry', what, attempt, waitMs: wait, error: String(error instanceof Error ? error.message : error) });
      await new Promise(ok => setTimeout(ok, wait));
    }
  }
}

function plan(base: string, bindingsPath: string, workPath: string) {
  const work = workDir(workPath);
  const { rows, now } = added(base, bindingsPath);
  for (const r of rows) readSource(r);
  writeFileSync(plainTarget(join(work, 'plan.json')), JSON.stringify({ base, approvedObjects: now.objects.size, added: rows.map(({ sha256, bytes, name, relativePath }) => ({ sha256, bytes, name, relativePath, key: paperObjectKey(sha256) })) }, null, 1) + '\n');
  console.log(`${rows.length} PDFs to add (${(rows.reduce((s, r) => s + r.bytes, 0) / 1e6).toFixed(1)} MB) of ${now.objects.size} approved; every source hash-checked`);
}

async function upload(base: string, bindingsPath: string, workPath: string) {
  // One writer at a time, taken before anything is read or any storage call is made.
  const lock = acquireSingleWriterLock(LOCK_NAME);
  const work = workDir(workPath), logFile = join(work, 'log/upload.jsonl');
  const { rows, now } = added(base, bindingsPath);
  log(logFile, { event: 'start', base, planned: rows.length, writerLock: lock.path, guarantee: SINGLE_WRITER_GUARANTEE });
  const staging = privateStaging('ppp-added-papers-');
  let aborted = false; const failed: string[] = [];
  try {
    await pool(rows, workerCount(process.env.JOBS, 2), async r => {
      if (aborted) return;
      const key = paperObjectKey(r.sha256);
      try {
        const staged = staging.write(readSource(r));
        const existing = await withRetry(`get ${key}`, logFile, () => remoteGet(key, staging.path()));
        if (existing) {
          if (existing.length !== r.bytes || sha256(existing) !== r.sha256) { aborted = true; log(logFile, { event: 'abort-different-bytes', key, bytes: existing.length, sha256: sha256(existing) }); return; }
          log(logFile, { event: 'present-identical', key, bytes: r.bytes, name: r.name });
          return;
        }
        log(logFile, { event: 'absent', key });
        await withRetry(`put ${key}`, logFile, async () => {
          const { code, err } = await run(['r2', 'object', 'put', `${BUCKET}/${key}`, '--file', staged, '--remote',
            '--content-type', 'application/pdf', '--cache-control', CACHE_CONTROL, '--content-disposition', `attachment; filename="${r.name}"`]);
          if (code !== 0) throw new Error(`wrangler put failed: ${err.replace(/\s+/g, ' ').slice(-300)}`);
        });
        rmSync(staged, { force: true });
        log(logFile, { event: 'put', key, bytes: r.bytes, name: r.name, contentType: 'application/pdf', cacheControl: CACHE_CONTROL });
        const back = await withRetry(`readback ${key}`, logFile, () => remoteGet(key, staging.path()));
        const ok = back !== null && back.length === r.bytes && sha256(back) === r.sha256;
        log(logFile, { event: ok ? 'readback-ok' : 'readback-mismatch', key, bytes: back?.length ?? null, sha256: back ? sha256(back) : null });
        if (!ok) failed.push(r.sha256);
      } catch (error) {
        failed.push(r.sha256);
        log(logFile, { event: 'failed', key, error: String(error instanceof Error ? error.message : error) });
      }
    });
  } finally { staging.dispose(); }
  if (seal(current()) !== seal(now)) throw new Error('Manifests changed during upload');
  if (aborted) throw new Error('An existing object has different bytes; upload aborted (see log/upload.jsonl)');
  console.log(`upload ${failed.length ? 'incomplete' : 'done'}: ${rows.length - failed.length} of ${rows.length} added PDFs present and read back; 0 pre-existing conflicts detected`);
  console.log(`guarantee: ${SINGLE_WRITER_GUARANTEE}`);
  if (failed.length) process.exitCode = 1;
}

function headerValue(headers: string, name: string): string | undefined {
  const block = headers.trim().split(/\r?\n\r?\n/).pop() ?? '';
  return block.split(/\r?\n/).find(line => line.toLowerCase().startsWith(`${name}:`))?.slice(name.length + 1).trim();
}
const curl = (args: string[]) => new Promise<{ code: number; out: Buffer }>(ok => {
  const child = spawn('curl', args, { stdio: ['ignore', 'pipe', 'ignore'] });
  const chunks: Buffer[] = [];
  child.stdout.on('data', c => chunks.push(c));
  child.on('error', () => ok({ code: 1, out: Buffer.alloc(0) }));
  child.on('close', code => ok({ code: code ?? 1, out: Buffer.concat(chunks) }));
});

async function verify(workPath: string) {
  const work = workDir(workPath), logFile = join(work, 'log/verify.jsonl');
  const now = current();
  const staging = privateStaging('ppp-added-verify-');
  const failed: string[] = [];
  try {
    await pool([...now.objects], 8, async ([sha, o]) => {
      const headersFile = staging.path();
      // DoH: some resolvers still cache the pre-Cloudflare DNS for free.pastpaperprep.com.
      const { code, out } = await curl(['-sfL', '--retry', '2', '--doh-url', 'https://1.1.1.1/dns-query', '-D', headersFile, paperObjectUrl(sha)]);
      const headers = existsSync(headersFile) ? readFileSync(headersFile, 'utf8') : '';
      rmSync(headersFile, { force: true });
      const ok = code === 0 && out.length === o.bytes && out.subarray(0, 5).equals(Buffer.from('%PDF-')) && sha256(out) === sha
        && headerValue(headers, 'content-type') === 'application/pdf'
        && headerValue(headers, 'content-disposition') === `attachment; filename="${o.name}"`;
      if (!ok) { failed.push(sha); log(logFile, { event: 'mismatch', sha256: sha, code, bytes: out.length }); }
    });
  } finally { staging.dispose(); }
  log(logFile, { event: 'summary', checked: now.objects.size, failed: failed.length });
  if (failed.length) { console.log(`verify failed: ${failed.length} of ${now.objects.size} mismatched; receipt not written`); process.exitCode = 1; return; }
  if (seal(current()) !== seal(now)) { console.log('verify failed: manifests changed during verification; receipt not written'); process.exitCode = 1; return; }
  const receipt: PublicReadback = {
    version: 3, status: 'verified_public_readback', origin: FREE_PAPER_ORIGIN, prefix: 'papers/v1/', verifiedAt: new Date().toISOString(),
    objectCount: now.objects.size, objectsSha256: now.objectsSha256, mappingSha256: now.mappingSha256,
  };
  writeFileSync(plainTarget('src/data/paper-archive-readback.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(`verified ${now.objects.size} PDFs from ${FREE_PAPER_ORIGIN}; wrote src/data/paper-archive-readback.json`);
}

const [phase, a, b, c] = process.argv.slice(2);
try {
  if (phase === 'plan' && a && b && c) plan(a, b, c);
  else if (phase === 'upload' && a && b && c) await upload(a, b, c);
  else if (phase === 'verify' && a) await verify(a);
  else { console.error('usage: publish-added-free-papers.mts plan|upload <base-ref> <source-bindings.json> <work-dir> | verify <work-dir>'); process.exitCode = 2; }
} catch (error) { console.error(String(error instanceof Error ? error.message : error)); process.exitCode = 1; }
