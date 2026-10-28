#!/usr/bin/env node
// Uploads the crop repairs v2 (docs/ib-crop-repairs-v2.md): IB Chemistry rotated mark schemes, IB shared stimuli v2,
// IB question boundaries v2 and 0606 mark-scheme continuations, from the four data/storage/*.manifest.json files.
// Uses the logged-in wrangler and the linked Supabase CLI; no API keys are handled.
//
// Stores: the private R2 bucket for every object; the public free bucket (images/<key>, public, max-age=604800) for
// free-year objects; Supabase question-assets for the 0606 objects (parity with the earlier 0606 repairs).
// Create-only: check-absent → put → full read-back by SHA-256 and size. An existing object with different bytes
// stops the run; an identical one is only read back. Keys are content-addressed in new namespaces, so nothing live is
// replaced. Not an atomic create (wrangler has no conditional put), so one writer at a time (single-writer lock).
//
// usage: WRANGLER_BIN=... node scripts/upload-reviewed-crop-repairs-v2.mjs [--dry-run | --verify]
//   --verify reads every planned object fresh from every store and writes nothing.
import { createHash } from "node:crypto";
import { execFile, execFileSync } from "node:child_process";
import { appendFileSync, existsSync, lstatSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SINGLE_WRITER_GUARANTEE, acquireSingleWriterLock } from "./lib/single-writer-lock.mjs";

export const MANIFESTS = ["ib-chemistry-rotated-ms-repairs", "ib-shared-stimulus-repairs-v2", "ib-question-boundary-repairs-v2", "0606-ms-continuation-repairs"]
  .map((name) => `data/storage/${name}.manifest.json`);
export const LOG = "docs/crop-repairs-v2-upload-log.jsonl";
export const RECEIPT = "data/storage/crop-repairs-v2.receipt.json";
const PRIVATE_BUCKET = "pastpaperprep-assets";
const PUBLIC_BUCKET = "pastpaperprep-free";
const SUPABASE_BUCKET = "question-assets";
const SUPABASE_PROJECT = "wrigscheuwsooyvayclz";
export const PRIVATE_CACHE = "private, max-age=31536000, immutable";
export const PUBLIC_CACHE = "public, max-age=604800";
const KEY = /^(ib-(chemistry|physics)-(hl|sl)|igcse-additional)\/repairs\/[a-z0-9-]+-v[12]-[a-f0-9]{16}\/[a-f0-9]{64}\.webp$/;

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Every (store, key) to write, from the manifests only. */
export function buildPlan(manifests) {
  const items = [];
  const seen = new Set();
  for (const m of manifests) {
    if (m.schema !== "reviewed-crop-repairs-upload-v1" || !/^repairs\/[a-z0-9-]+-v[12]-[a-f0-9]{16}$/.test(m.namespace)) throw new Error(`Unexpected manifest ${m.namespace}`);
    for (const o of m.objects) {
      if (!KEY.test(o.objectKey) || o.path !== `${m.namespace}/${o.sha256}.webp` || !o.objectKey.endsWith(`/${o.path}`) || o.contentType !== "image/webp") throw new Error(`Invalid key ${o.objectKey}`);
      if (seen.has(o.objectKey)) throw new Error(`Duplicate key ${o.objectKey}`);
      seen.add(o.objectKey);
      const stores = ["r2-private", ...(o.freeYear ? ["r2-public-free"] : []), ...(o.objectKey.startsWith("igcse-additional/") ? ["supabase"] : [])];
      items.push({ ...o, stores });
    }
  }
  return items;
}

export const storeKey = (store, item) => (store === "r2-public-free" ? `images/${item.objectKey}` : item.objectKey);

function run(cmd, args) {
  return new Promise((done) => execFile(cmd, args, { maxBuffer: 1 << 26 }, (error, stdout, stderr) => done({ error, out: `${stdout}${stderr}` })));
}
async function retry(label, fn) {
  for (let attempt = 1; ; attempt++) {
    const result = await fn();
    if (result.ok) return result.value;
    if (attempt === 6) throw new Error(`${label} failed repeatedly: ${result.out.slice(-300)}`);
    await sleep(1000 * 2 ** attempt);
  }
}

function cliTransport({ wrangler, supabaseWorkdir, scratchDir }) {
  let counter = 0;
  const scratch = () => join(scratchDir, `${process.pid}-${counter++}.bin`);
  const bucketOf = (store) => (store === "r2-private" ? PRIVATE_BUCKET : PUBLIC_BUCKET);
  const readFile = (label, args, missing) => retry(label, async () => {
    const file = scratch();
    const { error, out } = await run(args[0], [...args.slice(1), file]);
    if (!error && existsSync(file)) { const bytes = readFileSync(file); rmSync(file, { force: true }); return { ok: true, value: bytes }; }
    rmSync(file, { force: true });
    if (missing.test(out)) return { ok: true, value: null };
    return { ok: false, out };
  });
  return {
    get(store, key) {
      if (store === "supabase") {
        return readFile(`get supabase ${key}`, ["supabase", "--workdir", supabaseWorkdir, "--experimental", "storage", "cp", `ss:///${SUPABASE_BUCKET}/${key}`], /Object not found|NoSuchKey|not_found/i);
      }
      return readFile(`get ${bucketOf(store)}/${key}`, [wrangler, "r2", "object", "get", `${bucketOf(store)}/${key}`, "--remote", "--file"], /specified key does not exist|NoSuchKey/i);
    },
    put(store, key, item) {
      if (store === "supabase") {
        return retry(`put supabase ${key}`, async () => {
          const { error, out } = await run("supabase", ["--workdir", supabaseWorkdir, "--experimental", "storage", "cp", item.local,
            `ss:///${SUPABASE_BUCKET}/${key}`, "--linked", "--content-type", "image/webp", "--cache-control", PRIVATE_CACHE]);
          return { ok: !error, out };
        });
      }
      return retry(`put ${bucketOf(store)}/${key}`, async () => {
        const { error, out } = await run(wrangler, ["r2", "object", "put", `${bucketOf(store)}/${key}`, "--remote", "--file", item.local,
          "--content-type", "image/webp", "--cache-control", store === "r2-private" ? PRIVATE_CACHE : PUBLIC_CACHE]);
        return { ok: !error, out };
      });
    },
    // Origin read through the public host; a unique query string misses the edge cache.
    getPublic(key) {
      return retry(`public ${key}`, async () => {
        const response = await fetch(`https://free.pastpaperprep.com/${key}?verify=${process.pid}-${counter++}`, { cache: "no-store" });
        if (response.status === 404) return { ok: true, value: null };
        if (!response.ok) return { ok: false, out: `HTTP ${response.status}` };
        return { ok: true, value: Buffer.from(await response.arrayBuffer()) };
      });
    },
  };
}

async function main(argv) {
  const dry = argv.includes("--dry-run");
  const verify = argv.includes("--verify");
  if (dry && verify) throw new Error("--dry-run and --verify are exclusive");
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const MAIN = dirname(execFileSync("git", ["-C", ROOT, "rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" }).trim());
  const PACKAGE = resolve(process.env.IB_CROP_REPAIRS_V2_PACKAGE ?? join(MAIN, "..", "research", "ib-crop-repairs-v2"));
  const SUPABASE_WORKDIR = process.env.SUPABASE_WORKDIR ?? MAIN;
  const items = buildPlan(MANIFESTS.map((file) => JSON.parse(readFileSync(join(ROOT, file), "utf8"))));
  for (const item of items) {
    const path = join(PACKAGE, "objects", item.objectKey);
    if (lstatSync(path).isSymbolicLink()) throw new Error(`Refusing symlink ${path}`);
    const bytes = readFileSync(path);
    if (bytes.length !== item.bytes || sha256(bytes) !== item.sha256) throw new Error(`Local file does not match the manifest: ${path}`);
    item.local = path;
  }
  const writes = items.flatMap((item) => item.stores.map((store) => ({ store, item })));
  const perStore = Object.fromEntries(["r2-private", "r2-public-free", "supabase"].map((s) => [s, writes.filter((w) => w.store === s).length]));
  console.log(`${items.length} objects; writes per store ${JSON.stringify(perStore)}`);
  console.log(`Guarantee: ${SINGLE_WRITER_GUARANTEE}`);
  if (dry) return;
  const lock = acquireSingleWriterLock("crop-repairs-v2");
  const WRANGLER = process.env.WRANGLER_BIN;
  if (!WRANGLER) throw new Error("WRANGLER_BIN is required");
  if (perStore.supabase) {
    const ref = readFileSync(join(SUPABASE_WORKDIR, "supabase/.temp/project-ref"), "utf8").trim();
    if (ref !== SUPABASE_PROJECT) throw new Error("Supabase CLI is not linked to the production project");
  }
  const scratchDir = mkdtempSync(join(tmpdir(), "ppp-crop-v2-"));
  const transport = cliTransport({ wrangler: WRANGLER, supabaseWorkdir: SUPABASE_WORKDIR, scratchDir });
  const logPath = join(ROOT, LOG);
  const records = [];
  let cursor = 0, failure;
  const check = (bytes, item, where) => {
    if (!bytes) throw new Error(`Missing after write: ${where}`);
    if (bytes.length !== item.bytes || sha256(bytes) !== item.sha256) throw new Error(`Bytes differ at ${where}`);
  };
  async function worker() {
    while (!failure && cursor < writes.length) {
      const { store, item } = writes[cursor++];
      const key = storeKey(store, item);
      try {
        const before = store === "r2-public-free" ? await transport.getPublic(key) : await transport.get(store, key);
        if (before) check(before, item, `${store}:${key} (pre-existing)`);
        else if (!verify) await transport.put(store, key, item);
        else throw new Error(`Missing ${store}:${key}`);
        const after = store === "r2-public-free" ? await transport.getPublic(key) : await transport.get(store, key);
        check(after, item, `${store}:${key}`);
        const row = { store, key, sha256: item.sha256, bytes: item.bytes, existedBefore: Boolean(before), status: "verified" };
        records.push(row);
        if (!verify) appendFileSync(logPath, `${JSON.stringify({ ...row, at: new Date().toISOString() })}\n`);
        if (records.length % 100 === 0) console.log(JSON.stringify({ verified: records.length, total: writes.length }));
      } catch (e) { failure = new Error(`${store}:${key}: ${e.message}`); }
    }
  }
  try { await Promise.all(Array.from({ length: 3 }, worker)); }
  finally { rmSync(scratchDir, { recursive: true, force: true }); lock?.release?.(); }
  if (failure) throw failure;
  if (records.length !== writes.length) throw new Error("Incomplete read-back");
  const manifestSha256 = Object.fromEntries(MANIFESTS.map((file) => [file, sha256(readFileSync(join(ROOT, file)))]));
  writeFileSync(join(ROOT, RECEIPT), `${JSON.stringify({ schema: "crop-repairs-v2-readback-v1", state: "verified_readback", verification: "full_get_sha256_size",
    manifestSha256, objectCount: items.length, perStore, verifiedWrites: records.length, records: records.sort((a, b) => `${a.store}:${a.key}`.localeCompare(`${b.store}:${b.key}`)) }, null, 1)}\n`);
  console.log(JSON.stringify({ state: "verified_readback", writes: records.length, perStore }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
