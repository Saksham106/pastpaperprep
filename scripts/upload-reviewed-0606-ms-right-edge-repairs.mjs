#!/usr/bin/env node
// Uploads the reviewed 0606 mark-scheme edge repairs (data/storage/0606-ms-right-edge-repairs.manifest.json)
// with the logged-in wrangler and the linked Supabase CLI; no API keys are handled. Adapted from
// research/ppp-tools/wrangler-upload-2026.mjs and keeps its rules:
//   - an object key must be absent first; an existing object must already match the planned SHA-256
//     and size, otherwise the run stops. Nothing is ever overwritten or deleted;
//   - wrangler always runs with --remote;
//   - every object is read back after upload and compared by SHA-256 and size;
//   - concurrency 2 with exponential backoff; resumable from the append-only log.
// Stores: the private R2 bucket (premium delivery), Supabase question-assets (free-year preview signing,
// and parity with the earlier maths repairs), and for free-year questions the public free bucket that
// serves free.pastpaperprep.com (runbook docs/free-public-assets.md: public, max-age=604800).
// Before any upload it reads back every superseded live object and checks it against the overlay.
//
// usage: WRANGLER_BIN=... node scripts/upload-reviewed-0606-ms-right-edge-repairs.mjs [--dry-run]
import { createHash } from "node:crypto";
import { execFile, execFileSync } from "node:child_process";
import { appendFileSync, existsSync, lstatSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAIN = dirname(execFileSync("git", ["-C", ROOT, "rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" }).trim());
const SOURCE = process.env.PASTPAPERPREP_0606_SOURCE_ROOT
  ? resolve(process.env.PASTPAPERPREP_0606_SOURCE_ROOT)
  : join(MAIN, "..", "igcse-additional-mathematics-0606-topic-practice");
const SUPABASE_WORKDIR = process.env.SUPABASE_WORKDIR ?? MAIN; // the linked checkout
const WRANGLER = process.env.WRANGLER_BIN;
const PRIVATE_BUCKET = "pastpaperprep-assets";
const PUBLIC_BUCKET = "pastpaperprep-free";
const SUPABASE_BUCKET = "question-assets";
const SUPABASE_PROJECT = "wrigscheuwsooyvayclz";
const PRIVATE_CACHE = "private, max-age=31536000, immutable";
const PUBLIC_CACHE = "public, max-age=604800";
const LOG = join(ROOT, "docs/0606-ms-right-edge-upload-log.jsonl");
const CONCURRENCY = 2;
const DRY = process.argv.includes("--dry-run");

const manifest = JSON.parse(readFileSync(join(ROOT, "data/storage/0606-ms-right-edge-repairs.manifest.json"), "utf8"));
const overlay = JSON.parse(readFileSync(join(ROOT, "src/data/reviewed-0606-ms-right-edge-repairs.json"), "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (bin, args, cwd) => new Promise((done) => {
  execFile(bin, args, { cwd, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => done({ error, out: `${stdout}\n${stderr}` }));
});

if (!/^repairs\/0606-ms-right-edge-v1-[a-f0-9]{16}$/.test(manifest.namespace) || manifest.namespace !== overlay.namespace) throw new Error("Unexpected namespace");
if (manifest.objects.length !== manifest.objectCount || new Set(manifest.objects.map((o) => o.objectKey)).size !== manifest.objectCount) throw new Error("Unexpected object cohort");
const projectRef = readFileSync(join(SUPABASE_WORKDIR, "supabase/.temp/project-ref"), "utf8").trim();
if (projectRef !== SUPABASE_PROJECT) throw new Error("Supabase CLI is not linked to the production project");

const items = manifest.objects.map((o) => {
  if (o.objectKey !== `igcse-additional/${o.path}` || o.path !== `${manifest.namespace}/${o.sha256}.webp`) throw new Error(`Invalid key ${o.objectKey}`);
  const path = join(SOURCE, o.sourcePath);
  if (lstatSync(path).isSymbolicLink()) throw new Error(`Refusing symlink ${path}`);
  const bytes = readFileSync(path);
  if (bytes.length !== o.bytes || sha256(bytes) !== o.sha256) throw new Error(`Local file does not match the manifest: ${path}`);
  return { ...o, local: path };
});
// Superseded live objects: every replaced active path, read back from the store that serves it.
const superseded = [];
for (const [questionId, entry] of Object.entries(overlay.entries)) {
  entry.newPaths.forEach((path, index) => {
    if (path === entry.oldPaths[index]) return;
    superseded.push({ questionId, key: `igcse-additional/${entry.oldPaths[index]}`, sha256: entry.oldSha256[index] });
  });
}

const done = new Set();
if (existsSync(LOG)) for (const line of readFileSync(LOG, "utf8").split("\n").filter(Boolean)) {
  const row = JSON.parse(line);
  if (row.status === "verified" || row.status === "matched") done.add(`${row.store}:${row.key}`);
}
const stores = [
  ["r2-private", items],
  ["supabase", items],
  ["r2-public-free", items.filter((i) => i.freeYear)],
];
console.log(`${items.length} objects (${items.filter((i) => i.freeYear).length} free-year), ${superseded.length} superseded live objects; ${done.size} log rows already verified; local files match.`);
if (DRY) process.exit(0);
if (!WRANGLER) throw new Error("WRANGLER_BIN is required");

const dir = mkdtempSync(join(tmpdir(), "ppp-0606-edge-"));
let fileCounter = 0;
const scratch = () => join(dir, `${process.pid}-${fileCounter++}.bin`);

async function retry(label, fn) {
  for (let attempt = 1; ; attempt++) {
    const result = await fn();
    if (result.ok) return result.value;
    if (attempt === 6) throw new Error(`${label} failed repeatedly: ${result.out.slice(-300)}`);
    await sleep(1000 * 2 ** attempt);
  }
}

async function getR2(bucket, key) {
  return retry(`get ${bucket}/${key}`, async () => {
    const file = scratch();
    const { error, out } = await run(WRANGLER, ["r2", "object", "get", `${bucket}/${key}`, "--remote", "--file", file]);
    if (!error && existsSync(file)) { const bytes = readFileSync(file); rmSync(file, { force: true }); return { ok: true, value: bytes }; }
    rmSync(file, { force: true });
    if (/specified key does not exist|NoSuchKey/i.test(out)) return { ok: true, value: null };
    return { ok: false, out };
  });
}
async function putR2(bucket, key, path, cacheControl) {
  return retry(`put ${bucket}/${key}`, async () => {
    const { error, out } = await run(WRANGLER, ["r2", "object", "put", `${bucket}/${key}`, "--remote", "--file", path,
      "--content-type", "image/webp", "--cache-control", cacheControl]);
    return { ok: !error, out };
  });
}
async function getSupabase(key) {
  return retry(`get supabase ${key}`, async () => {
    const file = scratch();
    const { error, out } = await run("supabase", ["--workdir", SUPABASE_WORKDIR, "--experimental", "storage", "cp",
      `ss:///${SUPABASE_BUCKET}/${key}`, file, "--linked"]);
    if (!error && existsSync(file)) { const bytes = readFileSync(file); rmSync(file, { force: true }); return { ok: true, value: bytes }; }
    rmSync(file, { force: true });
    if (/Object not found|NoSuchKey|not_found/i.test(out)) return { ok: true, value: null };
    return { ok: false, out };
  });
}
async function putSupabase(key, path) {
  return retry(`put supabase ${key}`, async () => {
    const { error, out } = await run("supabase", ["--workdir", SUPABASE_WORKDIR, "--experimental", "storage", "cp", path,
      `ss:///${SUPABASE_BUCKET}/${key}`, "--linked", "--content-type", "image/webp", "--cache-control", PRIVATE_CACHE]);
    return { ok: !error, out };
  });
}
async function getPublic(key) {
  return retry(`public ${key}`, async () => {
    const response = await fetch(`https://free.pastpaperprep.com/${key}`, { cache: "no-store" });
    if (response.status === 404) return { ok: true, value: null };
    if (!response.ok) return { ok: false, out: `HTTP ${response.status}` };
    return { ok: true, value: Buffer.from(await response.arrayBuffer()) };
  });
}

async function pool(list, worker) {
  let cursor = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < list.length) await worker(list[cursor++]);
  }));
}
const log = (row) => appendFileSync(LOG, `${JSON.stringify({ ...row, at: new Date().toISOString() })}\n`);

// 1. Superseded live objects are exactly what the overlay replaces (read-only).
await pool(superseded.filter((s) => !done.has(`r2-private-superseded:${s.key}`)), async (s) => {
  const bytes = await getR2(PRIVATE_BUCKET, s.key);
  if (!bytes || sha256(bytes) !== s.sha256) throw new Error(`STOP: live ${s.key} is not the reviewed superseded object`);
  log({ store: "r2-private-superseded", key: s.key, questionId: s.questionId, sha256: s.sha256, bytes: bytes.length, status: "matched" });
});
console.log(`superseded live objects matched: ${superseded.length}`);

// 2. New objects, create-only, then full readback.
for (const [store, list] of stores) {
  let uploaded = 0, existed = 0;
  await pool(list.filter((i) => !done.has(`${store}:${store === "r2-public-free" ? `images/${i.objectKey}` : i.objectKey}`)), async (item) => {
    const key = store === "r2-public-free" ? `images/${item.objectKey}` : item.objectKey;
    const read = store === "supabase" ? () => getSupabase(key) : () => getR2(store === "r2-private" ? PRIVATE_BUCKET : PUBLIC_BUCKET, key);
    const before = await read();
    if (before) {
      if (before.length !== item.bytes || sha256(before) !== item.sha256) throw new Error(`STOP: ${store}:${key} exists with different content; not overwriting.`);
      existed++;
    } else {
      if (store === "supabase") await putSupabase(key, item.local);
      else await putR2(store === "r2-private" ? PRIVATE_BUCKET : PUBLIC_BUCKET, key, item.local, store === "r2-private" ? PRIVATE_CACHE : PUBLIC_CACHE);
      uploaded++;
    }
    const after = await read();
    if (!after || after.length !== item.bytes || sha256(after) !== item.sha256) throw new Error(`Readback mismatch ${store}:${key}`);
    const row = { store, key, sha256: item.sha256, bytes: item.bytes, status: "verified", existedBefore: Boolean(before) };
    if (store === "r2-public-free") {
      const served = await getPublic(key);
      if (!served || served.length !== item.bytes || sha256(served) !== item.sha256) throw new Error(`Public URL mismatch ${key}`);
      row.publicUrlVerified = true;
    }
    log(row);
  });
  console.log(`${store}: ${list.length} verified (${uploaded} uploaded, ${existed} already present)`);
}
rmSync(dir, { recursive: true, force: true });
console.log(`DONE; log ${LOG}`);
