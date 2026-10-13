/**
 * Publishes the free past-paper PDFs to the public `pastpaperprep-free` bucket and proves they are there.
 * Uploading publishes the files: owner approval required (AGENTS.md). Needs `wrangler login`; no keys.
 *
 *   npx tsx scripts/publish-free-papers.mts list <source-bindings.json> <work-dir>
 *   npx tsx scripts/publish-free-papers.mts upload <work-dir>    # ~3 parallel; resumable, retries throttled files
 *   npx tsx scripts/publish-free-papers.mts verify <work-dir>    # downloads every object from free.pastpaperprep.com
 *
 * Every phase re-reads the committed manifests and refuses rows that don't match them exactly. `upload`
 * publishes a staged copy whose bytes were hash-checked, so a source changed after `list` can't go out
 * under an approved key. `verify` writes src/data/paper-archive-readback.json only when every approved
 * PDF matched byte for byte with its filename, and the manifests didn't change during the run.
 * Any failure exits nonzero.
 */
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync, appendFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { FREE_PAPER_ORIGIN, approvedPapers, objectDownloadNames, paperMappingDigest, paperObjectKey, paperObjectUrl, paperObjectsDigest, type PublicReadback } from '../src/lib/whole-paper-public';
import type { WholePaperManifest } from '../src/lib/whole-paper-types';

type Row = { sha256: string; bytes: number; file: string; name: string };
const BUCKET = 'pastpaperprep-free';
const JOBS = Number(process.env.JOBS ?? 3);
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,150}\.pdf$/;

type Approved = { objects: Map<string, { bytes: number; name: string }>; objectsSha256: string; mappingSha256: string };
function approved(): Approved {
  const dir = 'src/data/paper-archives';
  const manifests = readdirSync(dir).filter(f => f.endsWith('.json')).sort()
    .map(file => JSON.parse(readFileSync(join(dir, file), 'utf8')) as WholePaperManifest);
  const papers = approvedPapers(manifests);
  const names = objectDownloadNames(papers);
  return {
    objects: new Map([...papers.sizes].map(([sha, bytes]) => [sha, { bytes, name: names.get(sha)! }])),
    objectsSha256: paperObjectsDigest(papers.sizes), mappingSha256: paperMappingDigest(papers.refs),
  };
}
const seal = (a: Approved) => `${a.objectsSha256}:${a.mappingSha256}:${[...a.objects].map(([sha, o]) => `${sha}=${o.name}`).sort().join(',')}`;
const sha256File = (file: string) => new Promise<string>((ok, fail) => {
  const hash = createHash('sha256');
  createReadStream(file).on('data', chunk => hash.update(chunk)).on('end', () => ok(hash.digest('hex'))).on('error', fail);
});
const run = (cmd: string, args: string[]) => new Promise<{ code: number; out: Buffer }>(ok => {
  const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const chunks: Buffer[] = [];
  child.stdout.on('data', c => chunks.push(c));
  child.stderr.resume();
  child.on('error', () => ok({ code: 1, out: Buffer.alloc(0) }));
  child.on('close', code => ok({ code: code ?? 1, out: Buffer.concat(chunks) }));
});
async function pool<T>(items: T[], jobs: number, work: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: jobs }, async () => { while (next < items.length) await work(items[next++]); }));
}
const logged = (path: string) => new Set(existsSync(path) ? readFileSync(path, 'utf8').split('\n').filter(Boolean) : []);
const uploadKey = (r: Row) => `${r.sha256}\t${r.name}`;

/** The work list, checked against the current manifests: exactly the approved set, same sizes and names. */
function readRows(work: string, current: Approved): Row[] {
  const rows = readFileSync(join(work, 'list.tsv'), 'utf8').trim().split('\n').map(line => {
    const [sha256, bytes, file, name, extra] = line.split('\t');
    return { sha256, bytes: Number(bytes), file, name, extra };
  });
  const seen = new Set<string>();
  for (const r of rows) {
    const want = current.objects.get(r.sha256);
    if (r.extra !== undefined || !want || want.bytes !== r.bytes || want.name !== r.name || seen.has(r.sha256) || !isAbsolute(r.file)) {
      throw new Error(`list.tsv row for ${r.sha256} doesn't match the committed manifests; run list again`);
    }
    seen.add(r.sha256);
  }
  if (seen.size !== current.objects.size) throw new Error(`list.tsv covers ${seen.size} of ${current.objects.size} approved PDFs; run list again`);
  return rows.map(({ sha256, bytes, file, name }) => ({ sha256, bytes, file, name }));
}

async function list(bindingsPath: string, work: string) {
  const bindings = JSON.parse(readFileSync(bindingsPath, 'utf8')) as { roots: { id: string; path: string }[]; documents: { rootId: string; relativePath: string; sha256: string }[] };
  const roots = new Map(bindings.roots.map(r => [r.id, realpathSync(r.path)]));
  const files = new Map<string, string>();
  for (const d of bindings.documents) {
    const root = roots.get(d.rootId);
    if (!root || isAbsolute(d.relativePath)) continue;
    const file = resolve(root, d.relativePath);
    const inside = existsSync(file) ? relative(root, realpathSync(file)) : '';
    if (inside && !inside.startsWith(`..${sep}`) && inside !== '..' && !isAbsolute(inside)) files.set(d.sha256, file);
  }
  const rows: Row[] = [];
  for (const [sha256, { bytes, name }] of approved().objects) {
    const file = files.get(sha256);
    if (!file || statSync(file).size !== bytes || await sha256File(file) !== sha256) throw new Error(`No exact local source inside a binding root for ${sha256}`);
    if (!SAFE_NAME.test(name)) throw new Error(`Unsafe download name ${name}`);
    rows.push({ sha256, bytes, file, name });
  }
  mkdirSync(join(work, 'log'), { recursive: true });
  writeFileSync(join(work, 'list.tsv'), rows.map(r => [r.sha256, r.bytes, r.file, r.name].join('\t')).join('\n') + '\n');
  console.log(`${rows.length} PDFs, ${(rows.reduce((s, r) => s + r.bytes, 0) / 1e9).toFixed(2)} GB, every local source hash-checked`);
}

/** Copies the source to staging, then checks the staged bytes: the file uploaded is the file checked. */
function stage(r: Row, work: string): string {
  const bytes = readFileSync(r.file);
  if (bytes.length !== r.bytes || !bytes.subarray(0, 5).equals(Buffer.from('%PDF-')) || createHash('sha256').update(bytes).digest('hex') !== r.sha256) {
    throw new Error(`Source for ${r.sha256} changed since it was approved`);
  }
  const staged = join(work, 'staging', `${r.sha256}.pdf`);
  writeFileSync(`${staged}.tmp`, bytes);
  renameSync(`${staged}.tmp`, staged);
  return staged;
}

async function upload(work: string) {
  const current = approved();
  const done = join(work, 'log/uploaded.txt');
  mkdirSync(join(work, 'staging'), { recursive: true });
  const rejected = new Set<string>();
  for (let round = 1; round <= 8; round++) {
    const uploaded = logged(done);
    const todo = readRows(work, current).filter(r => !uploaded.has(uploadKey(r)) && !rejected.has(r.sha256));
    if (!todo.length) break;
    console.log(`round ${round}: ${todo.length} to upload`);
    await pool(todo, JOBS, async r => {
      let staged: string;
      try { staged = stage(r, work); } catch (error) { console.error(String(error)); rejected.add(r.sha256); return; }
      const { code } = await run('npx', ['-y', 'wrangler@4', 'r2', 'object', 'put', `${BUCKET}/${paperObjectKey(r.sha256)}`, '--file', staged, '--remote',
        '--content-type', 'application/pdf', '--cache-control', 'public, max-age=604800', '--content-disposition', `attachment; filename="${r.name}"`]);
      rmSync(staged, { force: true });
      if (code === 0) appendFileSync(done, `${uploadKey(r)}\n`);
    });
    await new Promise(ok => setTimeout(ok, 15_000 * round));
  }
  if (seal(approved()) !== seal(current)) throw new Error('Manifests changed during upload; run list and upload again');
  const uploaded = logged(done);
  const left = readRows(work, current).filter(r => !uploaded.has(uploadKey(r)));
  console.log(`upload ${left.length ? 'incomplete' : 'done'}: ${current.objects.size - left.length} of ${current.objects.size}; ${rejected.size} changed sources refused`);
  if (left.length) process.exitCode = 1;
}

function headerValue(headers: string, name: string): string | undefined {
  // curl may print redirect hops; the last block is the final response.
  const block = headers.trim().split(/\r?\n\r?\n/).pop() ?? '';
  return block.split(/\r?\n/).find(line => line.toLowerCase().startsWith(`${name}:`))?.slice(name.length + 1).trim();
}

async function verify(work: string) {
  const current = approved();
  const rows = readRows(work, current);
  const dir = join(work, 'verify'); mkdirSync(dir, { recursive: true });
  const failed: string[] = [];
  await pool(rows, 8, async r => {
    const headersFile = join(dir, `${r.sha256}.headers`);
    // DoH: some resolvers (this Mac's router) still cache the pre-Cloudflare DNS for free.pastpaperprep.com.
    const { code, out } = await run('curl', ['-sfL', '--retry', '2', '--doh-url', 'https://1.1.1.1/dns-query', '-D', headersFile, paperObjectUrl(r.sha256)]);
    const headers = existsSync(headersFile) ? readFileSync(headersFile, 'utf8') : '';
    rmSync(headersFile, { force: true });
    const ok = code === 0 && out.length === r.bytes && out.subarray(0, 5).equals(Buffer.from('%PDF-'))
      && createHash('sha256').update(out).digest('hex') === r.sha256
      && headerValue(headers, 'content-type') === 'application/pdf'
      && headerValue(headers, 'content-disposition') === `attachment; filename="${r.name}"`;
    if (!ok) failed.push(r.sha256);
  });
  writeFileSync(join(work, 'log/verify-failed.txt'), failed.join('\n'));
  if (failed.length) { console.log(`verify failed: ${failed.length} of ${rows.length} mismatched; receipt not written`); process.exitCode = 1; return; }
  const after = approved();
  if (seal(after) !== seal(current)) { console.log('verify failed: manifests changed during verification; receipt not written'); process.exitCode = 1; return; }
  const receipt: PublicReadback = {
    version: 3, status: 'verified_public_readback', origin: FREE_PAPER_ORIGIN, prefix: 'papers/v1/', verifiedAt: new Date().toISOString(),
    objectCount: current.objects.size, objectsSha256: current.objectsSha256, mappingSha256: current.mappingSha256,
  };
  writeFileSync('src/data/paper-archive-readback.json', JSON.stringify(receipt, null, 2) + '\n');
  console.log(`verified ${current.objects.size} PDFs from ${FREE_PAPER_ORIGIN}; wrote src/data/paper-archive-readback.json`);
}

const [phase, a, b] = process.argv.slice(2);
try {
  if (phase === 'list' && a && b) await list(a, b);
  else if (phase === 'upload' && a) await upload(a);
  else if (phase === 'verify' && a) await verify(a);
  else { console.error('usage: publish-free-papers.mts list <bindings> <work> | upload <work> | verify <work>'); process.exitCode = 2; }
} catch (error) { console.error(String(error instanceof Error ? error.message : error)); process.exitCode = 1; }
