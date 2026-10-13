#!/usr/bin/env tsx
/**
 * Publishes free-year images and explanations to the public `pastpaperprep-free` bucket
 * (`images/<private path>`, served from free.pastpaperprep.com) and proves they are there.
 * Uploading publishes the files: owner approval required (AGENTS.md). Needs `npx wrangler login`
 * and the linked Supabase CLI (run from the linked checkout, or set SUPABASE_WORKDIR); no keys.
 *
 *   npx tsx scripts/publish-free-assets.mts download <work-dir>   # private stores -> <work>/files, sealed
 *   npx tsx scripts/publish-free-assets.mts upload <work-dir>     # ~3 parallel; resumable, retries throttled files
 *   npx tsx scripts/publish-free-assets.mts verify <work-dir>     # every object from free.pastpaperprep.com
 *
 * Run with the production release flags set, after `npm run generate:asset-manifest`. The list is
 * computed here from the manifests and the free-year rules, never read from an editable file.
 * Files are read and placed without following symlinks below the canonical work folder, and
 * written through a fresh private staging folder (scripts/lib/safe-files.ts). Each download is
 * checked, placed and sealed (path, SHA-256, size) in <work>/sealed.tsv; a sealed file is re-checked
 * before it is reused. Upload re-reads every file and checks it against its seal before looking at
 * the resume log (keyed path+hash+size), so a changed, missing or resized file fails instead of
 * being skipped. Every phase counts what it actually completed against the free set and exits
 * nonzero unless it covered all of it.
 *
 * Supabase banks: a bulk `supabase --experimental storage cp -r ss:///question-assets/<bank>
 * <work>/supabase-all/ --linked -j 16` first avoids per-file rate limits; download copies from it.
 */
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { loadBankAssetManifest } from "@/lib/asset-manifest";
import { getAvailableBanks } from "@/lib/banks";
import { FREE_PUBLIC_ASSET_PREFIX, freePublicAssetUrl } from "@/lib/free-asset-index";
import { isSafeFreeAssetPath, listFreePublicAssets } from "@/lib/free-public-assets";
import { canonicalRoot, placeConfined, privateStaging, readConfined, workerCount } from "./lib/safe-files";

type Item = { source: "r2" | "supabase"; path: string };
type Seal = { sha256: string; bytes: number };
const PUBLIC_BUCKET = "pastpaperprep-free";
const PRIVATE_BUCKET = "pastpaperprep-assets";
const jobs = () => workerCount(process.env.JOBS, 3);
const MAX_ASSET_BYTES = 20 * 1024 * 1024;
const SUPABASE_WORKDIR = process.env.SUPABASE_WORKDIR ?? process.cwd();

async function freeSet(): Promise<Item[]> {
  const items = new Map<string, Item>();
  for (const bank of getAvailableBanks()) {
    const manifest = await loadBankAssetManifest(bank.slug);
    for (const asset of listFreePublicAssets(bank.slug, manifest)) {
      const seen = items.get(asset.path);
      if (seen && seen.source !== asset.source) throw new Error(`${asset.path} is listed from two stores`);
      items.set(asset.path, { source: asset.source, path: asset.path });
    }
  }
  if (!items.size) throw new Error("No free assets listed; are the release flags set?");
  return [...items.values()].sort((a, b) => a.path.localeCompare(b.path));
}

/** The canonical work folder with plain (non-symlink) `files`, `log`, seal and log files. */
function workDir(path: string): string {
  mkdirSync(path, { recursive: true });
  const work = canonicalRoot(resolve(path));
  for (const area of ["files", "log"]) {
    const stat = lstatSync(join(work, area), { throwIfNoEntry: false });
    if (stat && (stat.isSymbolicLink() || !stat.isDirectory())) throw new Error(`${area} in the work folder isn't a plain folder`);
    if (!stat) mkdirSync(join(work, area));
  }
  for (const name of ["sealed.tsv", "log/uploaded.txt", "log/download-failed.txt", "log/upload-failed.txt", "log/verify-failed.txt"]) {
    if (lstatSync(join(work, name), { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error(`${name} in the work folder is a symlink`);
  }
  return work;
}
function checkedPath(path: string): string {
  if (!isSafeFreeAssetPath(path)) throw new Error(`Unsafe asset path ${path}`);
  return path;
}
/** A sealed file still matching its seal, or null if it is missing, changed or unsafe. */
function sealedBytes(files: string, path: string, seal: Seal | undefined): Buffer | null {
  if (!seal) return null;
  try {
    const bytes = readConfined(files, checkedPath(path), MAX_ASSET_BYTES);
    return bytes.length === seal.bytes && sha256(bytes) === seal.sha256 ? bytes : null;
  } catch { return null; }
}
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const run = (cmd: string, args: string[], cwd?: string) => new Promise<{ code: number; out: Buffer }>((done) => {
  const child = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
  const chunks: Buffer[] = [];
  child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
  child.stderr.resume();
  child.on("error", () => done({ code: 1, out: Buffer.alloc(0) }));
  child.on("close", (code) => done({ code: code ?? 1, out: Buffer.concat(chunks) }));
});
async function pool<T>(items: T[], jobs: number, work: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: jobs }, async () => { while (next < items.length) await work(items[next++]); }));
}
function readSeals(work: string): Map<string, Seal> {
  const file = join(work, "sealed.tsv");
  const seals = new Map<string, Seal>();
  if (!existsSync(file)) return seals;
  for (const line of readFileSync(file, "utf8").split("\n").filter(Boolean)) {
    const [path, sha, bytes, extra] = line.split("\t");
    if (extra !== undefined || !isSafeFreeAssetPath(path) || !/^[a-f0-9]{64}$/.test(sha) || !Number.isSafeInteger(Number(bytes)) || Number(bytes) < 1) throw new Error(`Malformed seal line for ${path}`);
    seals.set(path, { sha256: sha, bytes: Number(bytes) }); // later lines win: a re-download re-seals
  }
  return seals;
}
const lines = (file: string) => new Set(existsSync(file) ? readFileSync(file, "utf8").split("\n").filter(Boolean) : []);
const contentType = (path: string) => path.endsWith(".json") ? "application/json" : "image/webp";
function validBytes(path: string, bytes: Buffer): boolean {
  if (!bytes.length) return false;
  if (path.endsWith(".webp")) return bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP";
  try { JSON.parse(bytes.toString("utf8")); return true; } catch { return false; }
}
/** Coverage is counted from what actually completed, never assumed from an empty failure list. */
function finish(phase: string, items: Item[], completed: ReadonlySet<string>, work: string) {
  const missing = items.filter(({ path }) => !completed.has(path)).map(({ path }) => path);
  writeFileSync(join(work, "log", `${phase}-failed.txt`), missing.join("\n"));
  console.log(`${phase} ${missing.length ? "incomplete" : "done"}: ${items.length - missing.length} of ${items.length}`);
  if (missing.length) process.exitCode = 1;
}

async function download(workPath: string) {
  const work = workDir(workPath);
  const files = join(work, "files");
  const items = await freeSet();
  const seals = readSeals(work);
  const bulkStat = lstatSync(join(work, "supabase-all"), { throwIfNoEntry: false });
  if (bulkStat && (bulkStat.isSymbolicLink() || !bulkStat.isDirectory())) throw new Error("supabase-all in the work folder isn't a plain folder");
  const bulk = bulkStat ? join(work, "supabase-all") : null;
  const staging = privateStaging("ppp-assets-");
  const completed = new Set<string>();
  try {
    await pool(items, workerCount(process.env.JOBS, 12), async ({ source, path }) => {
      checkedPath(path);
      if (sealedBytes(files, path, seals.get(path))) { completed.add(path); return; }
      let bytes: Buffer | null = null;
      if (source === "supabase" && bulk) { try { bytes = readConfined(bulk, path, MAX_ASSET_BYTES); } catch { bytes = null; } }
      if (!bytes) {
        const target = staging.path();
        const { code } = source === "supabase"
          ? await run("supabase", ["--experimental", "storage", "cp", `ss:///question-assets/${path}`, target, "--linked"], SUPABASE_WORKDIR)
          : await run("npx", ["-y", "wrangler@4", "r2", "object", "get", `${PRIVATE_BUCKET}/${path}`, "--file", target, "--remote"]);
        try { bytes = code === 0 ? readConfined(staging.dir, basename(target), MAX_ASSET_BYTES) : null; } catch { bytes = null; }
        rmSync(target, { force: true });
      }
      if (!bytes || !validBytes(path, bytes)) return;
      placeConfined(files, path, bytes, staging);
      appendFileSync(join(work, "sealed.tsv"), `${path}\t${sha256(bytes)}\t${bytes.length}\n`);
      completed.add(path);
    });
  } finally { staging.dispose(); }
  finish("download", items, completed, work);
}

async function upload(workPath: string) {
  const work = workDir(workPath);
  const files = join(work, "files");
  const items = await freeSet();
  const seals = readSeals(work);
  const log = join(work, "log", "uploaded.txt");
  const key = (path: string, seal: Seal) => `${path}\t${seal.sha256}\t${seal.bytes}`;
  const staging = privateStaging("ppp-assets-");
  const completed = new Set<string>();
  const refused = new Set<string>();
  try {
    for (let round = 1; round <= 8; round++) {
      const done = lines(log);
      const todo: { path: string; bytes: Buffer; seal: Seal }[] = [];
      for (const { path } of items) {
        if (completed.has(path) || refused.has(path)) continue;
        const seal = seals.get(path);
        // Validate the current file against its seal before trusting any resume receipt.
        const bytes = sealedBytes(files, path, seal);
        if (!seal || !bytes) { refused.add(path); continue; }
        // Older logs keyed path+hash; the file was just checked against hash and size, so they still count.
        if (done.has(key(path, seal)) || done.has(`${path}\t${seal.sha256}`)) { completed.add(path); continue; }
        todo.push({ path, bytes, seal });
      }
      if (!todo.length) break;
      console.log(`round ${round}: ${todo.length} to upload`);
      await pool(todo, jobs(), async ({ path, bytes, seal }) => {
        const staged = staging.write(bytes);
        const { code } = await run("npx", ["-y", "wrangler@4", "r2", "object", "put", `${PUBLIC_BUCKET}/${FREE_PUBLIC_ASSET_PREFIX}${path}`, "--file", staged, "--remote",
          "--content-type", contentType(path), "--cache-control", "public, max-age=604800"]);
        rmSync(staged, { force: true });
        if (code === 0) { appendFileSync(log, `${key(path, seal)}\n`); completed.add(path); }
      });
      await new Promise((wait) => setTimeout(wait, 15_000 * round));
    }
  } finally { staging.dispose(); }
  if (refused.size) console.error(`${refused.size} files are missing, changed or unsealed; run download again`);
  finish("upload", items, completed, work);
}

async function verify(workPath: string) {
  const work = workDir(workPath);
  const items = await freeSet();
  const seals = readSeals(work);
  const completed = new Set<string>();
  await pool(items, workerCount(process.env.JOBS, 16), async ({ path }) => {
    const seal = seals.get(path);
    if (!seal) return;
    // DoH: some resolvers (this Mac's router) still cache the pre-Cloudflare DNS for free.pastpaperprep.com.
    const { code, out } = await run("curl", ["-sfL", "--retry", "2", "--doh-url", "https://1.1.1.1/dns-query", freePublicAssetUrl(checkedPath(path))]);
    if (code === 0 && out.length === seal.bytes && sha256(out) === seal.sha256) completed.add(path);
  });
  finish("verify", items, completed, work);
}

const [phase, work] = process.argv.slice(2);
try {
  jobs(); // reject a bad JOBS before any phase runs
  if (!work) throw new Error("usage: publish-free-assets.mts download|upload|verify <work-dir>");
  if (phase === "download") await download(work);
  else if (phase === "upload") await upload(work);
  else if (phase === "verify") await verify(work);
  else throw new Error("usage: publish-free-assets.mts download|upload|verify <work-dir>");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
