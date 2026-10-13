/**
 * Publishes the free past-paper PDFs to the public `pastpaperprep-free` bucket and proves they are there.
 * Uploading publishes the files: owner approval required (AGENTS.md). Needs `wrangler login`; no keys.
 *
 *   npx tsx scripts/publish-free-papers.mts list <source-bindings.json> <work-dir>
 *   npx tsx scripts/publish-free-papers.mts upload <work-dir>    # ~3 parallel; resumable, retries throttled files
 *   npx tsx scripts/publish-free-papers.mts verify <work-dir>    # downloads every object from free.pastpaperprep.com
 *
 * `verify` writes src/data/paper-archive-readback.json only when every approved PDF matched byte for byte.
 */
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { FREE_PAPER_ORIGIN, paperDownloadName, paperObjectKey, paperObjectUrl, paperObjectsDigest, type PublicReadback } from '../src/lib/whole-paper-public';
import type { WholePaperManifest } from '../src/lib/whole-paper-types';

type Row = { sha256: string; bytes: number; file: string; name: string };
const BUCKET = 'pastpaperprep-free';
const JOBS = Number(process.env.JOBS ?? 3);

function approved(): Map<string, { bytes: number; name: string }> {
  const out = new Map<string, { bytes: number; name: string }>();
  const dir = 'src/data/paper-archives';
  for (const file of readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
    const manifest = JSON.parse(readFileSync(join(dir, file), 'utf8')) as WholePaperManifest;
    for (const paper of manifest.papers) for (const kind of ['question', 'markscheme'] as const) {
      const doc = paper.documents[kind];
      const seen = out.get(doc.sha256);
      if (seen && seen.bytes !== doc.bytes) throw new Error(`${doc.sha256} has two sizes`);
      if (!seen) out.set(doc.sha256, { bytes: doc.bytes, name: paperDownloadName(paper.summary, kind) });
    }
  }
  return out;
}
const sha256File = (file: string) => new Promise<string>((ok, fail) => {
  const hash = createHash('sha256');
  createReadStream(file).on('data', chunk => hash.update(chunk)).on('end', () => ok(hash.digest('hex'))).on('error', fail);
});
const run = (cmd: string, args: string[]) => new Promise<{ code: number; out: Buffer }>(ok => {
  const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const chunks: Buffer[] = [];
  child.stdout.on('data', c => chunks.push(c));
  child.stderr.resume();
  child.on('close', code => ok({ code: code ?? 1, out: Buffer.concat(chunks) }));
});
async function pool<T>(items: T[], jobs: number, work: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: jobs }, async () => { while (next < items.length) await work(items[next++]); }));
}
const readRows = (work: string): Row[] => readFileSync(join(work, 'list.tsv'), 'utf8').trim().split('\n').map(line => {
  const [sha256, bytes, file, name] = line.split('\t');
  return { sha256, bytes: Number(bytes), file, name };
});
const logged = (path: string) => new Set(existsSync(path) ? readFileSync(path, 'utf8').split('\n').filter(Boolean) : []);

async function list(bindingsPath: string, work: string) {
  const bindings = JSON.parse(readFileSync(bindingsPath, 'utf8')) as { roots: { id: string; path: string }[]; documents: { rootId: string; relativePath: string; sha256: string }[] };
  const roots = new Map(bindings.roots.map(r => [r.id, r.path]));
  const files = new Map(bindings.documents.map(d => [d.sha256, resolve(roots.get(d.rootId)!, d.relativePath)]));
  const rows: Row[] = [];
  for (const [sha256, { bytes, name }] of approved()) {
    const file = files.get(sha256);
    if (!file || !existsSync(file) || statSync(file).size !== bytes || await sha256File(file) !== sha256) throw new Error(`No exact local source for ${sha256}`);
    if (/["\t\n\\]/.test(name)) throw new Error(`Unsafe download name ${name}`);
    rows.push({ sha256, bytes, file, name });
  }
  mkdirSync(join(work, 'log'), { recursive: true });
  writeFileSync(join(work, 'list.tsv'), rows.map(r => [r.sha256, r.bytes, r.file, r.name].join('\t')).join('\n') + '\n');
  console.log(`${rows.length} PDFs, ${(rows.reduce((s, r) => s + r.bytes, 0) / 1e9).toFixed(2)} GB, every local source hash-checked`);
}

async function upload(work: string) {
  const done = join(work, 'log/uploaded.txt');
  for (let round = 1; round <= 8; round++) {
    const uploaded = logged(done);
    const todo = readRows(work).filter(r => !uploaded.has(r.sha256));
    if (!todo.length) return console.log('upload done; failures: 0');
    console.log(`round ${round}: ${todo.length} to upload`);
    await pool(todo, JOBS, async r => {
      const { code } = await run('npx', ['-y', 'wrangler@4', 'r2', 'object', 'put', `${BUCKET}/${paperObjectKey(r.sha256)}`, '--file', r.file, '--remote',
        '--content-type', 'application/pdf', '--cache-control', 'public, max-age=604800', '--content-disposition', `attachment; filename="${r.name}"`]);
      if (code === 0) appendFileSync(done, `${r.sha256}\n`);
    });
    await new Promise(ok => setTimeout(ok, 15_000 * round));
  }
  const left = readRows(work).filter(r => !logged(done).has(r.sha256)).length;
  console.log(`upload stopped; failures: ${left}`);
  if (left) process.exitCode = 1;
}

async function verify(work: string) {
  const rows = readRows(work);
  const failed: string[] = [];
  await pool(rows, 8, async r => {
    // DoH: this Mac's router still caches the pre-Cloudflare DNS for free.pastpaperprep.com.
    const { code, out } = await run('curl', ['-sfL', '--doh-url', 'https://1.1.1.1/dns-query', paperObjectUrl(r.sha256)]);
    const ok = code === 0 && out.length === r.bytes && out.subarray(0, 5).equals(Buffer.from('%PDF-')) && createHash('sha256').update(out).digest('hex') === r.sha256;
    if (!ok) failed.push(r.sha256);
  });
  writeFileSync(join(work, 'log/verify-failed.txt'), failed.join('\n'));
  const objects = new Map([...approved()].map(([sha, { bytes }]) => [sha, bytes]));
  const listed = new Set(rows.map(r => r.sha256));
  if (failed.length || listed.size !== objects.size || [...objects.keys()].some(sha => !listed.has(sha))) {
    console.log(`verify failed: ${failed.length} mismatched, ${objects.size - listed.size} unlisted; receipt not written`);
    process.exitCode = 1; return;
  }
  const receipt: PublicReadback = { version: 2, status: 'verified_public_readback', origin: FREE_PAPER_ORIGIN, prefix: 'papers/v1/', verifiedAt: new Date().toISOString(), objectCount: objects.size, objectsSha256: paperObjectsDigest(objects) };
  writeFileSync('src/data/paper-archive-readback.json', JSON.stringify(receipt, null, 2) + '\n');
  console.log(`verified ${objects.size} PDFs from ${FREE_PAPER_ORIGIN}; wrote src/data/paper-archive-readback.json`);
}

const [phase, a, b] = process.argv.slice(2);
if (phase === 'list' && a && b) await list(a, b);
else if (phase === 'upload' && a) await upload(a);
else if (phase === 'verify' && a) await verify(a);
else { console.error('usage: publish-free-papers.mts list <bindings> <work> | upload <work> | verify <work>'); process.exitCode = 2; }
