#!/usr/bin/env tsx
/**
 * Copies a bank's free-year files from the private R2 bucket into the public free bucket with the repo's
 * one-off Worker (scripts/free-copy-worker/worker.mjs: allowlist-only, atomically create-only, self-tested),
 * then verifies every file from free.pastpaperprep.com against the private object's SHA-256.
 *
 * The free list comes from the app's own listFreePublicAssets(bank, manifest), for ANY catalog bank, including
 * held (pendingStorage) banks that scripts/publish-free-assets.mts skips. Run from anywhere; the script uses the repo root.
 *
 * Every deploy, copy and delete needs explicit owner approval, asked in the session that runs it (AGENTS.md).
 *
 *   npx tsx scripts/free-copy/free-copy.mts list   --bank <slug> [--bank <slug>...] [--out <dir>]   # offline, writes free-list.json
 *   npx tsx scripts/free-copy/free-copy.mts deploy --bank <slug> [--bank ...] [--out <dir>]          # deploy Worker, wait for 403
 *   npx tsx scripts/free-copy/free-copy.mts copy   --bank <slug> [--bank ...] [--out <dir>]          # wait 403, selftest, copy
 *   npx tsx scripts/free-copy/free-copy.mts verify --bank <slug> [--bank ...] [--out <dir>]          # public fetch + hash for every path
 *   npx tsx scripts/free-copy/free-copy.mts delete --bank <slug> [--bank ...] [--out <dir>]          # delete Worker, confirm it is gone
 *
 * Pass the same --bank list (or the same --out) to every step: it selects the state folder.
 *
 * `--out` (default ~/.cache/ppp-upload-work/free-copy/<bank>[+<bank>...]) holds the free list, the Worker secret
 * (free-copy-worker.json, mode 0600, never printed), copy-log.jsonl, verify-log.jsonl and receipt.json. It must be
 * outside the repo. The manifest must exist for the same env as this command; if not, the error prints the exact
 * `scripts/generate-asset-manifest.mts --bank <slug>` command. Held banks need HELD_BANK_ENV (see lib.mjs).
 */
import { appendFileSync, copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { assetManifestFileName, loadBankAssetManifest } from "@/lib/asset-manifest";
import type { BankSlug } from "@/lib/banks";
import { getCatalogBank } from "@/lib/catalog";
import { listFreePublicAssets } from "@/lib/free-public-assets";
import { runWrangler } from "../lib/wrangler-cli.mjs";
import { REPO_ROOT, argValue, argValues, assertOutsideRepo, ensurePrivateDir, readWorkerConfig, waitForWorkerAuth, waitForWorkerGone, writePrivateJson } from "../lib/worker-tools.mjs";
import { COPY_BATCH, FREE_BUCKET, PRIVATE_BUCKET, PUBLIC_BASE, WORKER_NAME, copyablePaths, defaultOutDir, isDone, listDigest, missingManifestMessage, postWorker, sha256, summariseAssets, verifyPublicPath } from "./lib.mjs";

type ListFile = { banks: Record<string, number>; paths: string[]; skippedSupabase: number };
type CopyRow = { path: string; status: string; sha256?: string; bytes?: number; at?: string };

const [command, ...rest] = process.argv.slice(2);
const banks = argValues(rest, "bank");
const outFlag = argValue(rest, "out");
// Every step reads and writes the same state folder, so each one needs the same --bank list (or an explicit --out);
// never fall back to a shared default that would hide the deployed Worker's config from later steps.
if (command && !banks.length && !outFlag) {
  console.error(`${command} needs the same --bank <slug> (repeatable) used for deploy, or --out <dir>`);
  process.exit(2);
}
const out = path.resolve(outFlag ?? defaultOutDir(banks));
const files = {
  list: path.join(out, "free-list.json"),
  worker: path.join(out, "free-copy-worker.json"),
  copyLog: path.join(out, "copy-log.jsonl"),
  verifyLog: path.join(out, "verify-log.jsonl"),
  receipt: path.join(out, "receipt.json"),
};
const jsonLines = <T,>(file: string): T[] => (existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line) as T) : []);

function prepareOut() {
  assertOutsideRepo(out);
  ensurePrivateDir(out);
}

/** The free R2 file list for each requested bank, from the app's own rules and the generated asset manifest. */
async function buildList(): Promise<ListFile & { summaries: unknown[] }> {
  if (!banks.length) throw new Error("--bank <slug> required (repeatable)");
  process.chdir(REPO_ROOT); // loadBankAssetManifest reads generated/asset-manifest from the cwd
  const all = new Set<string>();
  const perBank: Record<string, number> = {};
  const summaries: unknown[] = [];
  let skippedSupabase = 0;
  for (const bank of banks) {
    const entry = getCatalogBank(bank);
    if (!entry) throw new Error(`Unknown bank slug: ${bank}`);
    const fileName = assetManifestFileName(bank as BankSlug);
    if (!existsSync(path.join(REPO_ROOT, "generated/asset-manifest", fileName))) {
      throw new Error(missingManifestMessage({ bank, held: "pendingStorage" in entry && Boolean(entry.pendingStorage), fileName }));
    }
    const assets = listFreePublicAssets(bank as BankSlug, await loadBankAssetManifest(bank as BankSlug));
    const { paths, skippedSupabase: skipped } = copyablePaths(bank, assets);
    paths.forEach((p) => all.add(p));
    perBank[bank] = paths.length;
    skippedSupabase += skipped;
    summaries.push(summariseAssets(bank, assets));
  }
  return { banks: perBank, paths: [...all].sort(), skippedSupabase, summaries };
}

async function list() {
  prepareOut();
  const { summaries, ...file } = await buildList();
  writeFileSync(files.list, JSON.stringify(file));
  for (const summary of summaries) console.log(JSON.stringify(summary));
  console.log(JSON.stringify({ paths: file.paths.length, skippedSupabase: file.skippedSupabase, list: files.list }));
}

const readList = (): ListFile => {
  if (!existsSync(files.list)) throw new Error(`No free-list.json in ${out}; run deploy first`);
  return JSON.parse(readFileSync(files.list, "utf8")) as ListFile;
};

/** The list on disk must be the one bundled into the deployed Worker; a drifted list fails closed. */
function readDeployed() {
  const worker = readWorkerConfig(files.worker) as { url: string; token: string; listSha256: string };
  const list = readList();
  if (worker.listSha256 !== listDigest(list.paths)) throw new Error("free-list.json changed since deploy; delete the Worker and deploy again");
  return { worker, list };
}

async function deploy() {
  prepareOut();
  const { summaries, ...list } = await buildList();
  for (const summary of summaries) console.log(JSON.stringify(summary));
  writeFileSync(files.list, JSON.stringify(list));
  const dir = mkdtempSync(path.join(tmpdir(), "ppp-free-copy-"));
  chmodSync(dir, 0o700);
  try {
    copyFileSync(path.join(REPO_ROOT, "scripts/free-copy-worker/worker.mjs"), path.join(dir, "worker.mjs"));
    writeFileSync(path.join(dir, "allowlist.json"), JSON.stringify({ paths: list.paths }));
    writeFileSync(path.join(dir, "wrangler.jsonc"), JSON.stringify({
      name: WORKER_NAME, main: "worker.mjs", compatibility_date: "2026-11-01", workers_dev: true,
      r2_buckets: [{ binding: "PRIVATE", bucket_name: PRIVATE_BUCKET }, { binding: "FREE", bucket_name: FREE_BUCKET }],
    }, null, 2));
    const output = await runWrangler(["deploy"], { cwd: dir });
    const url = output.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/)?.[0];
    if (!url) throw new Error("no workers.dev URL in deploy output");
    const token = randomBytes(32).toString("hex");
    await runWrangler(["secret", "put", "COPY_TOKEN", "--name", WORKER_NAME], { cwd: dir, input: token });
    writePrivateJson(files.worker, { url, token, banks, listSha256: listDigest(list.paths) });
    console.log(JSON.stringify({ deployed: WORKER_NAME, url, allowed: list.paths.length }));
    await waitForWorkerAuth(url, "/selftest");
    console.log(JSON.stringify({ live: true }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function copy() {
  prepareOut();
  const { worker, list } = readDeployed();
  await waitForWorkerAuth(worker.url, "/selftest"); // a fresh workers.dev URL can answer 404 for a while
  let test: { ok?: unknown } | null = null;
  for (let i = 0; i < 10 && !test; i += 1) {
    test = await postWorker(worker, "/selftest").catch(() => null);
    if (!test) await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  if (test?.ok !== true) throw new Error(`self-test failed: ${JSON.stringify(test)}`);
  const done = new Set(jsonLines<CopyRow>(files.copyLog).filter(isDone).map((row) => row.path));
  const pending = list.paths.filter((p) => !done.has(p));
  console.log(JSON.stringify({ selftest: true, total: list.paths.length, alreadyDone: done.size, pending: pending.length }));
  const batches: string[][] = [];
  for (let i = 0; i < pending.length; i += COPY_BATCH) batches.push(pending.slice(i, i + COPY_BATCH));
  let index = 0;
  let failure: Error | null = null;
  const counts: Record<string, number> = {};
  const lane = async () => {
    while (!failure && index < batches.length) {
      const { results } = await postWorker(worker, "/copy", { paths: batches[index++] }) as { results: CopyRow[] };
      for (const row of results) {
        counts[row.status] = (counts[row.status] ?? 0) + 1;
        appendFileSync(files.copyLog, `${JSON.stringify({ ...row, at: new Date().toISOString() })}\n`);
        if (!isDone(row)) failure = new Error(`${row.path}: ${row.status}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, lane));
  console.log(JSON.stringify({ counts }));
  if (failure) throw failure;
}

async function verify() {
  prepareOut();
  const list = readList();
  const privateRows = new Map(jsonLines<CopyRow>(files.copyLog).filter((row) => row.sha256).map((row) => [row.path, row]));
  const missing = list.paths.filter((p) => !privateRows.has(p));
  if (missing.length) throw new Error(`${missing.length} paths have no copy result; run copy first`);
  rmSync(files.verifyLog, { force: true });
  let index = 0;
  const bad: string[] = [];
  const lane = async () => {
    while (index < list.paths.length) {
      const p = list.paths[index++];
      const row = privateRows.get(p)!;
      const result = await verifyPublicPath(p, { sha256: row.sha256!, bytes: row.bytes! });
      appendFileSync(files.verifyLog, `${JSON.stringify(result)}\n`);
      if (!result.ok) bad.push(p);
    }
  };
  await Promise.all(Array.from({ length: 12 }, lane));
  const summary = {
    verified: list.paths.length - bad.length, total: list.paths.length, failed: bad.length, perBank: list.banks,
    copyLogSha256: sha256(readFileSync(files.copyLog)), verifyLogSha256: sha256(readFileSync(files.verifyLog)),
  };
  writeFileSync(files.receipt, `${JSON.stringify({ ...summary, method: "repo scripts/free-copy-worker (allowlist, If-None-Match create-only, self-tested) + public fetch re-hash", publicBase: PUBLIC_BASE, at: new Date().toISOString() }, null, 2)}\n`);
  console.log(JSON.stringify(summary));
  if (bad.length) process.exitCode = 1;
}

async function remove() {
  prepareOut();
  if (!existsSync(files.worker)) throw new Error(`No free-copy-worker.json in ${out}: without the saved URL deletion cannot be confirmed; pass the --bank/--out used for deploy, or delete in the Cloudflare dashboard`);
  const { url } = readWorkerConfig(files.worker);
  const output = await runWrangler(["delete", "--name", WORKER_NAME, "--force"], { cwd: tmpdir() });
  console.log(JSON.stringify({ deleteRequested: WORKER_NAME, output: output.trim().split("\n").slice(-1)[0] }));
  const gone = await waitForWorkerGone(url, "/selftest"); // throws, keeping the config, if the Worker still answers
  rmSync(files.worker, { force: true });
  console.log(JSON.stringify({ deleted: WORKER_NAME, confirmed: true, ...gone }));
}

const commands: Record<string, () => Promise<void>> = { list, deploy, copy, verify, delete: remove };
if (!commands[command]) {
  console.error("usage: list | deploy | copy | verify | delete");
  process.exit(2);
}
await commands[command]();
