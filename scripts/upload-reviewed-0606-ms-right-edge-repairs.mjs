#!/usr/bin/env node
// Uploads the reviewed 0606 mark-scheme edge repairs (data/storage/0606-ms-right-edge-repairs.manifest.json)
// with the logged-in wrangler and the linked Supabase CLI; no API keys are handled. Adapted from
// research/ppp-tools/wrangler-upload-2026.mjs.
//
// Stores: the private R2 bucket (premium delivery), Supabase question-assets (free-year preview signing,
// and parity with the earlier maths repairs), and for free-year questions the public free bucket that
// serves free.pastpaperprep.com (runbook docs/free-public-assets.md: public, max-age=604800).
// Before any upload it reads back every superseded live R2 object and checks it against the overlay.
//
// Guarantee (SINGLE_WRITER_GUARANTEE): check-absent → put → full read-back by SHA-256 and size, serialized
// by one local writer (an exclusive lock, scripts/lib/single-writer-lock.mjs, taken before any storage
// call). That detects pre-existing different bytes before writing and corrupt bytes after writing. It is
// not an atomic create: wrangler r2 object put has no conditional create (and no conditional create is
// relied on for the Supabase CLI copy), so a concurrent foreign writer between the check and the put
// cannot be ruled out. Wrangler always runs with --remote; concurrency 2 with exponential backoff.
//
// Resume: a log row is skipped only if its store and key are in the plan and its SHA-256 and size equal
// the planned object (superseded objects: the overlay records only SHA-256, so the hash must match exactly
// and the size must be positive). Resumed rows are historical evidence, not a fresh read; --verify reads
// every planned object fresh from every store, ignores the log and writes nothing.
//
// usage: WRANGLER_BIN=... node scripts/upload-reviewed-0606-ms-right-edge-repairs.mjs [--dry-run | --verify]
import { createHash } from "node:crypto";
import { execFile, execFileSync } from "node:child_process";
import { appendFileSync, existsSync, lstatSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SINGLE_WRITER_GUARANTEE, acquireSingleWriterLock } from "./lib/single-writer-lock.mjs";

export const LOCK_NAME = "0606-ms-right-edge-repairs";
export const MANIFEST = "data/storage/0606-ms-right-edge-repairs.manifest.json";
export const OVERLAY = "src/data/reviewed-0606-ms-right-edge-repairs.json";
export const LOG = "docs/0606-ms-right-edge-upload-log.jsonl";
export const STORES = /** @type {const} */ (["r2-private", "supabase", "r2-public-free"]);
export const SUPERSEDED_STORE = "r2-private-superseded";
const PRIVATE_BUCKET = "pastpaperprep-assets";
const PUBLIC_BUCKET = "pastpaperprep-free";
const SUPABASE_BUCKET = "question-assets";
const SUPABASE_PROJECT = "wrigscheuwsooyvayclz";
export const PRIVATE_CACHE = "private, max-age=31536000, immutable";
export const PUBLIC_CACHE = "public, max-age=604800";
const CONCURRENCY = 2;

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Store key for a planned object. */
export const storeKey = (store, item) => (store === "r2-public-free" ? `images/${item.objectKey}` : item.objectKey);

/**
 * The plan, from the manifest and overlay only (no storage, no source files): the new objects and the
 * superseded live objects, each keyed by store.
 */
export function buildPlan(manifest, overlay) {
  if (!/^repairs\/0606-ms-right-edge-v1-[a-f0-9]{16}$/.test(manifest.namespace) || manifest.namespace !== overlay.namespace) throw new Error("Unexpected namespace");
  if (manifest.objects.length !== manifest.objectCount || new Set(manifest.objects.map((o) => o.objectKey)).size !== manifest.objectCount) throw new Error("Unexpected object cohort");
  const items = manifest.objects.map((o) => {
    if (o.objectKey !== `igcse-additional/${o.path}` || o.path !== `${manifest.namespace}/${o.sha256}.webp`) throw new Error(`Invalid key ${o.objectKey}`);
    if (!/^[a-f0-9]{64}$/.test(o.sha256) || !Number.isInteger(o.bytes) || o.bytes <= 0) throw new Error(`Invalid object ${o.objectKey}`);
    return o;
  });
  // Superseded live objects: every replaced active path, read back from the R2 store that serves it.
  const superseded = [];
  const seen = new Map();
  for (const [questionId, entry] of Object.entries(overlay.entries)) {
    entry.newPaths.forEach((path, index) => {
      if (path === entry.oldPaths[index]) return;
      const key = `igcse-additional/${entry.oldPaths[index]}`;
      const hash = entry.oldSha256[index];
      if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error(`Invalid superseded hash for ${key}`);
      if (seen.has(key) && seen.get(key) !== hash) throw new Error(`Superseded key with two hashes: ${key}`);
      seen.set(key, hash);
      superseded.push({ questionId, key, sha256: hash });
    });
  }
  /** store → key → expected { sha256, bytes } (bytes null: only SHA-256 is planned). */
  const expected = new Map([[SUPERSEDED_STORE, new Map(superseded.map((s) => [s.key, { sha256: s.sha256, bytes: null }]))]]);
  for (const store of STORES) {
    const list = store === "r2-public-free" ? items.filter((i) => i.freeYear) : items;
    expected.set(store, new Map(list.map((i) => [storeKey(store, i), { sha256: i.sha256, bytes: i.bytes }])));
  }
  return {
    items,
    superseded,
    expected,
    stores: STORES.map((store) => [store, store === "r2-public-free" ? items.filter((i) => i.freeYear) : items]),
  };
}

/**
 * Log rows that may be skipped on resume, validated against the plan. Throws on any row whose store or
 * key is not planned, whose SHA-256 or size differs from the planned object, or that is duplicated.
 * @returns {Set<string>} "store:key"
 */
export function resumeRows(plan, logText) {
  const done = new Set();
  for (const line of logText.split("\n").filter(Boolean)) {
    const row = JSON.parse(line);
    const status = row.store === SUPERSEDED_STORE ? "matched" : "verified";
    if (row.status !== status) throw new Error(`Unexpected log row status ${row.status} for ${row.store}:${row.key}`);
    const want = plan.expected.get(row.store)?.get(row.key);
    if (!want) throw new Error(`Log row outside the plan: ${row.store}:${row.key}`);
    const sizeOk = want.bytes === null ? Number.isInteger(row.bytes) && row.bytes > 0 : row.bytes === want.bytes;
    if (row.sha256 !== want.sha256 || !sizeOk) throw new Error(`Log row disagrees with the plan: ${row.store}:${row.key}`);
    if (row.store === "r2-public-free" && row.publicUrlVerified !== true) throw new Error(`Log row lacks the public URL check: ${row.key}`);
    const id = `${row.store}:${row.key}`;
    if (done.has(id)) throw new Error(`Duplicate log row: ${id}`);
    done.add(id);
  }
  return done;
}

async function pool(list, worker) {
  let cursor = 0;
  let failure;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (!failure && cursor < list.length) {
      const item = list[cursor++];
      try { await worker(item); } catch (error) { failure = error; }
    }
  }));
  if (failure) throw failure;
}

const matches = (bytes, want) => Boolean(bytes) && sha256(bytes) === want.sha256 && (want.bytes === null ? bytes.length > 0 : bytes.length === want.bytes);

/**
 * Runs the upload (mode "upload") or a fresh read-only verification of every store (mode "verify").
 * The transport is the only path to storage:
 *   get(store, key) → Buffer | null, put(store, key, item) → void, getPublic(key) → Buffer | null.
 * The writer lock is taken before the first storage call; `lock` defaults to the shared single-writer lock.
 * @param {{ plan: ReturnType<typeof buildPlan>, transport: object, mode: "upload" | "verify", logText?: string,
 *   appendLog?: (row: object) => void, lock?: () => unknown, print?: (line: string) => void }} options
 */
export async function runUploader({ plan, transport, mode, logText = "", appendLog = () => {}, lock = () => acquireSingleWriterLock(LOCK_NAME), print = console.log }) {
  if (mode !== "upload" && mode !== "verify") throw new Error(`Unknown mode ${mode}`);
  // Validate resume rows before taking the lock or touching storage (verify ignores the log).
  const done = mode === "upload" ? resumeRows(plan, logText) : new Set();
  lock();
  const summary = { mode, guarantee: SINGLE_WRITER_GUARANTEE, superseded: { freshlyMatched: 0, resumedFromLog: 0 }, stores: {} };

  // 1. Superseded live objects are exactly what the overlay replaces (read-only).
  const supersededWant = plan.expected.get(SUPERSEDED_STORE);
  await pool(plan.superseded, async (s) => {
    if (done.has(`${SUPERSEDED_STORE}:${s.key}`)) { summary.superseded.resumedFromLog++; return; }
    const bytes = await transport.get("r2-private", s.key);
    if (!matches(bytes, supersededWant.get(s.key))) throw new Error(`STOP: live ${s.key} is not the reviewed superseded object`);
    if (mode === "upload") appendLog({ store: SUPERSEDED_STORE, key: s.key, questionId: s.questionId, sha256: s.sha256, bytes: bytes.length, status: "matched", writerLock: true });
    summary.superseded.freshlyMatched++;
  });
  print(`superseded live objects: ${summary.superseded.freshlyMatched} matched by a fresh read` +
    (summary.superseded.resumedFromLog ? `, ${summary.superseded.resumedFromLog} from the log (historical, not re-read)` : ""));

  // 2. New objects: check absent, put, full read-back (upload); or a fresh read only (verify).
  for (const [store, list] of plan.stores) {
    const counts = { freshlyVerified: 0, uploaded: 0, alreadyPresent: 0, resumedFromLog: 0 };
    await pool(list, async (item) => {
      const key = storeKey(store, item);
      if (done.has(`${store}:${key}`)) { counts.resumedFromLog++; return; }
      const before = await transport.get(store, key);
      if (mode === "verify") {
        if (!matches(before, item)) throw new Error(`Verify mismatch ${store}:${key}`);
      } else {
        if (before) {
          if (!matches(before, item)) throw new Error(`STOP: ${store}:${key} exists with different content; not writing.`);
          counts.alreadyPresent++;
        } else {
          await transport.put(store, key, item);
          counts.uploaded++;
        }
        const after = await transport.get(store, key);
        if (!matches(after, item)) throw new Error(`Readback mismatch ${store}:${key}`);
      }
      const row = { store, key, sha256: item.sha256, bytes: item.bytes, status: "verified", existedBefore: Boolean(before), writerLock: true };
      if (store === "r2-public-free") {
        const served = await transport.getPublic(key);
        if (!matches(served, item)) throw new Error(`Public URL mismatch ${key}`);
        row.publicUrlVerified = true;
      }
      if (mode === "upload") appendLog(row);
      counts.freshlyVerified++;
    });
    summary.stores[store] = counts;
    print(`${store}: ${counts.freshlyVerified} verified by a fresh read` +
      (mode === "upload" ? ` (${counts.uploaded} uploaded, ${counts.alreadyPresent} already present)` : "") +
      (counts.resumedFromLog ? `; ${counts.resumedFromLog} from the log (historical, not re-read; run --verify for a fresh check)` : ""));
  }
  return summary;
}

const run = (bin, args, cwd) => new Promise((done) => {
  execFile(bin, args, { cwd, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => done({ error, out: `${stdout}\n${stderr}` }));
});

async function retry(label, fn) {
  for (let attempt = 1; ; attempt++) {
    const result = await fn();
    if (result.ok) return result.value;
    if (attempt === 6) throw new Error(`${label} failed repeatedly: ${result.out.slice(-300)}`);
    await sleep(1000 * 2 ** attempt);
  }
}

/** The real transport: logged-in wrangler (--remote), the linked Supabase CLI and the public URL. */
export function cliTransport({ wrangler, supabaseWorkdir, scratchDir }) {
  let fileCounter = 0;
  const scratch = () => join(scratchDir, `${process.pid}-${fileCounter++}.bin`);
  const bucketOf = (store) => (store === "r2-private" ? PRIVATE_BUCKET : PUBLIC_BUCKET);
  const readFile = async (label, args, cwd, missing) => retry(label, async () => {
    const file = scratch();
    const { error, out } = await run(args[0], [...args.slice(1), file], cwd);
    if (!error && existsSync(file)) { const bytes = readFileSync(file); rmSync(file, { force: true }); return { ok: true, value: bytes }; }
    rmSync(file, { force: true });
    if (missing.test(out)) return { ok: true, value: null };
    return { ok: false, out };
  });
  return {
    get(store, key) {
      if (store === "supabase") {
        return readFile(`get supabase ${key}`, ["supabase", "--workdir", supabaseWorkdir, "--experimental", "storage", "cp", `ss:///${SUPABASE_BUCKET}/${key}`],
          undefined, /Object not found|NoSuchKey|not_found/i);
      }
      return readFile(`get ${bucketOf(store)}/${key}`, [wrangler, "r2", "object", "get", `${bucketOf(store)}/${key}`, "--remote", "--file"],
        undefined, /specified key does not exist|NoSuchKey/i);
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
    getPublic(key) {
      return retry(`public ${key}`, async () => {
        const response = await fetch(`https://free.pastpaperprep.com/${key}`, { cache: "no-store" });
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
  // One writer at a time, taken before anything else touches storage (dry runs never do).
  const lock = dry ? null : acquireSingleWriterLock(LOCK_NAME);
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const MAIN = dirname(execFileSync("git", ["-C", ROOT, "rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" }).trim());
  const SOURCE = process.env.PASTPAPERPREP_0606_SOURCE_ROOT
    ? resolve(process.env.PASTPAPERPREP_0606_SOURCE_ROOT)
    : join(MAIN, "..", "igcse-additional-mathematics-0606-topic-practice");
  const SUPABASE_WORKDIR = process.env.SUPABASE_WORKDIR ?? MAIN; // the linked checkout
  const WRANGLER = process.env.WRANGLER_BIN;
  const logPath = join(ROOT, LOG);

  const plan = buildPlan(JSON.parse(readFileSync(join(ROOT, MANIFEST), "utf8")), JSON.parse(readFileSync(join(ROOT, OVERLAY), "utf8")));
  // --verify ignores the log entirely; uploads resume only from rows that match the plan.
  const logText = !verify && existsSync(logPath) ? readFileSync(logPath, "utf8") : "";
  const done = resumeRows(plan, logText);
  if (!verify) {
    // Uploads need the reviewed local files; --verify compares storage with the manifest only.
    for (const item of plan.items) {
      const path = join(SOURCE, item.sourcePath);
      if (lstatSync(path).isSymbolicLink()) throw new Error(`Refusing symlink ${path}`);
      const bytes = readFileSync(path);
      if (bytes.length !== item.bytes || sha256(bytes) !== item.sha256) throw new Error(`Local file does not match the manifest: ${path}`);
      item.local = path;
    }
  }
  console.log(`${plan.items.length} objects (${plan.items.filter((i) => i.freeYear).length} free-year), ${plan.superseded.length} superseded live objects; ` +
    (verify ? "the log is ignored; every store is read fresh." : `${done.size} log rows match the plan (historical evidence, not re-read).`));
  console.log(`Guarantee: ${SINGLE_WRITER_GUARANTEE}`);
  if (dry) return;
  if (!WRANGLER) throw new Error("WRANGLER_BIN is required");
  const projectRef = readFileSync(join(SUPABASE_WORKDIR, "supabase/.temp/project-ref"), "utf8").trim();
  if (projectRef !== SUPABASE_PROJECT) throw new Error("Supabase CLI is not linked to the production project");

  const scratchDir = mkdtempSync(join(tmpdir(), "ppp-0606-edge-"));
  try {
    const summary = await runUploader({
      plan, mode: verify ? "verify" : "upload", logText,
      transport: cliTransport({ wrangler: WRANGLER, supabaseWorkdir: SUPABASE_WORKDIR, scratchDir }),
      appendLog: (row) => appendFileSync(logPath, `${JSON.stringify({ ...row, at: new Date().toISOString() })}\n`),
      lock: () => lock,
    });
    console.log(JSON.stringify(summary));
  } finally { rmSync(scratchDir, { recursive: true, force: true }); }
  console.log(verify ? "VERIFIED: every planned object was read fresh from every store; nothing was written." : `DONE; log ${logPath}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
