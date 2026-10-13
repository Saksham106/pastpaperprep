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
 * Each download is written to a temporary file, renamed into place and sealed (path, source,
 * SHA-256, size) in <work>/sealed.tsv. Upload re-checks the staged bytes against the seal and logs
 * path+hash, so changed bytes are uploaded again rather than skipped. Every phase checks it covered
 * exactly the free set and exits nonzero on any failure.
 *
 * Supabase banks: a bulk `supabase --experimental storage cp -r ss:///question-assets/<bank>
 * <work>/supabase-all/ --linked -j 16` first avoids per-file rate limits; download copies from it.
 */
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { loadBankAssetManifest } from "@/lib/asset-manifest";
import { getAvailableBanks } from "@/lib/banks";
import { FREE_PUBLIC_ASSET_PREFIX, freePublicAssetUrl } from "@/lib/free-asset-index";
import { isSafeFreeAssetPath, listFreePublicAssets } from "@/lib/free-public-assets";

type Item = { source: "r2" | "supabase"; path: string };
type Seal = { sha256: string; bytes: number };
const PUBLIC_BUCKET = "pastpaperprep-free";
const PRIVATE_BUCKET = "pastpaperprep-assets";
const JOBS = Number(process.env.JOBS ?? 3);
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

/** <work>/<area>/<path>, refusing anything that would land outside that folder. */
function inside(work: string, area: string, path: string): string {
  if (!isSafeFreeAssetPath(path)) throw new Error(`Unsafe asset path ${path}`);
  const root = resolve(work, area);
  const file = resolve(root, path);
  const rel = relative(root, file);
  if (!rel || rel.startsWith(`..${sep}`) || rel === ".." || isAbsolute(rel)) throw new Error(`${path} escapes ${area}`);
  return file;
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
    const [path, sha, bytes] = line.split("\t");
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
function finish(phase: string, total: number, failed: string[], work: string) {
  writeFileSync(join(work, "log", `${phase}-failed.txt`), failed.join("\n"));
  console.log(`${phase} ${failed.length ? "incomplete" : "done"}: ${total - failed.length} of ${total}`);
  if (failed.length) process.exitCode = 1;
}

async function download(work: string) {
  const items = await freeSet();
  mkdirSync(join(work, "log"), { recursive: true });
  const seals = readSeals(work);
  const failed: string[] = [];
  await pool(items, Number(process.env.JOBS ?? 12), async ({ source, path }) => {
    const file = inside(work, "files", path);
    if (seals.has(path) && existsSync(file)) return;
    const tmp = `${file}.part`;
    mkdirSync(dirname(file), { recursive: true });
    rmSync(tmp, { force: true });
    const bulk = source === "supabase" ? inside(work, "supabase-all", path) : null;
    let ok: boolean;
    if (bulk && existsSync(bulk)) { copyFileSync(bulk, tmp); ok = true; }
    else if (source === "supabase") ok = (await run("supabase", ["--experimental", "storage", "cp", `ss:///question-assets/${path}`, tmp, "--linked"], SUPABASE_WORKDIR)).code === 0;
    else ok = (await run("npx", ["-y", "wrangler@4", "r2", "object", "get", `${PRIVATE_BUCKET}/${path}`, "--file", tmp, "--remote"])).code === 0;
    const bytes = ok && existsSync(tmp) ? readFileSync(tmp) : Buffer.alloc(0);
    if (!ok || !validBytes(path, bytes)) { rmSync(tmp, { force: true }); failed.push(path); return; }
    renameSync(tmp, file);
    appendFileSync(join(work, "sealed.tsv"), `${path}\t${sha256(bytes)}\t${bytes.length}\n`);
  });
  finish("download", items.length, failed, work);
}

async function upload(work: string) {
  const items = await freeSet();
  const seals = readSeals(work);
  const missing = items.filter(({ path }) => !seals.has(path));
  if (missing.length) throw new Error(`${missing.length} free assets aren't downloaded and sealed; run download first`);
  const log = join(work, "log", "uploaded.txt");
  const key = (path: string) => `${path}\t${seals.get(path)!.sha256}`;
  const refused: string[] = [];
  for (let round = 1; round <= 8; round++) {
    const done = lines(log);
    const todo = items.filter(({ path }) => !done.has(key(path)) && !refused.includes(path));
    if (!todo.length) break;
    console.log(`round ${round}: ${todo.length} to upload`);
    await pool(todo, JOBS, async ({ path }) => {
      const seal = seals.get(path)!;
      const bytes = readFileSync(inside(work, "files", path));
      if (bytes.length !== seal.bytes || sha256(bytes) !== seal.sha256) { refused.push(path); return; }
      const staged = join(work, "staging", `${seal.sha256}${path.endsWith(".json") ? ".json" : ".webp"}`);
      mkdirSync(dirname(staged), { recursive: true });
      writeFileSync(staged, bytes);
      const { code } = await run("npx", ["-y", "wrangler@4", "r2", "object", "put", `${PUBLIC_BUCKET}/${FREE_PUBLIC_ASSET_PREFIX}${path}`, "--file", staged, "--remote",
        "--content-type", contentType(path), "--cache-control", "public, max-age=604800"]);
      rmSync(staged, { force: true });
      if (code === 0) appendFileSync(log, `${key(path)}\n`);
    });
    await new Promise((wait) => setTimeout(wait, 15_000 * round));
  }
  if (refused.length) console.error(`${refused.length} local files no longer match their seal; run download again`);
  const done = lines(log);
  finish("upload", items.length, items.filter(({ path }) => !done.has(key(path))).map(({ path }) => path), work);
}

async function verify(work: string) {
  const items = await freeSet();
  const seals = readSeals(work);
  mkdirSync(join(work, "log"), { recursive: true });
  const failed: string[] = [];
  await pool(items, 16, async ({ path }) => {
    const seal = seals.get(path);
    // DoH: some resolvers (this Mac's router) still cache the pre-Cloudflare DNS for free.pastpaperprep.com.
    const { code, out } = seal ? await run("curl", ["-sfL", "--retry", "2", "--doh-url", "https://1.1.1.1/dns-query", freePublicAssetUrl(path)]) : { code: 1, out: Buffer.alloc(0) };
    if (!seal || code !== 0 || out.length !== seal.bytes || sha256(out) !== seal.sha256) failed.push(path);
  });
  finish("verify", items.length, failed, work);
}

const [phase, work] = process.argv.slice(2);
try {
  if (!work) throw new Error("usage: publish-free-assets.mts download|upload|verify <work-dir>");
  if (phase === "download") await download(resolve(work));
  else if (phase === "upload") await upload(resolve(work));
  else if (phase === "verify") await verify(resolve(work));
  else throw new Error("usage: publish-free-assets.mts download|upload|verify <work-dir>");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
