#!/usr/bin/env tsx
// Writes src/data/image-sizes/<bank>.json: the pixel width and height of every question and
// mark-scheme crop, read from each WebP header (first 30 bytes, no decoding). Bank pages use
// them to reserve each image's real box before it loads, so cards stop jumping (CLS).
//
//   Free-year crops: 64-byte range requests to the public bucket (free.pastpaperprep.com).
//   Paid crops:      the local crop files in the sibling ingestion folders, matched by SHA-256
//                    where a receipt records it (upload logs, *ImageHashes), else by folder + name.
//   Spot-check:      every crop found both ways must have the same size, or the script fails.
//
// Read-only: nothing is uploaded, replaced or deleted. Paths come from generated/asset-manifest,
// so generate it first with the CI build env (all released banks), then run:
//   npx tsx scripts/generate-image-sizes.mts [--bank <slug>] [--no-bucket]
// Re-run after adding a bank or a year (docs/content-ingestion.md).
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { open, readFile, readdir, stat, writeFile, mkdir } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { isPreviewQuestion } from "@/lib/access";
import type { AssetManifestEntry } from "@/lib/asset-manifest";
import { deliveredAssetPaths } from "@/lib/asset-kinds";
import type { BankSlug } from "@/lib/banks";
import { freePublicAssetUrl } from "@/lib/free-asset-index";
import { encodeImageSizes, type ImageSize } from "@/lib/image-sizes";
import { webpSize } from "@/lib/webp-size";

const repo = process.cwd();
const siblings = resolve(repo, process.env.PPP_INGESTION_ROOT ?? findSiblingRoot());
const manifestDirectory = join(repo, "generated", "asset-manifest");
const outputDirectory = join(repo, "src", "data", "image-sizes");
const onlyBank = process.argv.includes("--bank") ? process.argv[process.argv.indexOf("--bank") + 1] : null;
const useBucket = !process.argv.includes("--no-bucket");

/** Sibling ingestion folders holding each bank's crops. */
const LOCAL_FOLDERS: Record<string, string[]> = {
  igcse: ["igcse-0580-topic-practice"],
  "igcse-additional": ["igcse-additional-mathematics-0606-topic-practice"],
  "igcse-biology-0610": ["igcse-biology-0610-topic-practice"],
  "igcse-chemistry-0620": ["igcse-chemistry-0620-topic-practice"],
  "igcse-physics-0625": ["igcse-physics-0625-topic-practice"],
  "igcse-coordinated-sciences-0654": ["igcse-coordinated-sciences-0654-topic-practice"],
  "igcse-economics-0455": ["igcse-economics-0455-topic-practice"],
  "igcse-computer-science-0478": ["igcse-computer-science-0478-topic-practice"],
  "ib-hl": ["ib-maths-aa-hl-topic-practice"],
  "ib-sl": ["ib-maths-aa-topic-finder-audit"],
  "ib-ai-hl": ["ib-maths-ai-hl-topic-practice-audit"],
  "ib-ai-sl": ["ib-maths-ai-sl-topic-practice-audit-fix"],
  "ib-chemistry-hl": ["ib-chemistry-topic-practice"],
  "ib-chemistry-sl": ["ib-chemistry-topic-practice"],
  "ib-physics-hl": ["ib-physics-topic-practice"],
  "ib-physics-sl": ["ib-physics-topic-practice"],
  "ib-biology-hl": ["ib-biology-topic-practice"],
  "ib-biology-sl": ["ib-biology-topic-practice"],
  "ib-computer-science-hl": ["ib-computer-science-topic-practice"],
  "ib-computer-science-sl": ["ib-computer-science-topic-practice"],
  "ib-business-management-hl": ["ib-business-management-topic-practice"],
  "ib-business-management-sl": ["ib-business-management-topic-practice"],
  "ib-economics-hl": ["ib-economics-topic-practice"],
  "ib-economics-sl": ["ib-economics-topic-practice"],
  "a-level-maths-9709": ["cambridge-a-level-mathematics-9709-topic-practice"],
  "a-level-further-maths-9231": ["cambridge-a-level-further-mathematics-9231-topic-practice"],
  "a-level-physics-9702": ["cambridge-a-level-physics-9702-topic-practice"],
  "a-level-chemistry-9701": ["cambridge-a-level-chemistry-9701-topic-practice"],
  "a-level-biology-9700": ["cambridge-a-level-biology-9700-topic-practice"],
  "a-level-economics-9708": ["cambridge-a-level-economics-9708-topic-practice"],
  "a-level-computer-science-9618": ["cambridge-a-level-computer-science-9618-topic-practice"],
};
const SKIP_DIRECTORIES = new Set(["node_modules", ".git", ".worktrees", ".venv", "venv", "__pycache__"]);

/** The folder holding the main checkout and its siblings, also from inside a worktree. */
function findSiblingRoot(): string {
  const marker = `${join("pastpaperprep", ".claude", "worktrees")}`;
  const at = repo.indexOf(marker);
  return at >= 0 ? repo.slice(0, at) : dirname(repo);
}

async function headerSize(file: string): Promise<ImageSize | null> {
  const handle = await open(file, "r");
  try {
    const buffer = Buffer.alloc(64);
    const { bytesRead } = await handle.read(buffer, 0, 64, 0);
    return webpSize(buffer.subarray(0, bytesRead));
  } finally { await handle.close(); }
}

function sha256(file: string): Promise<string> {
  return new Promise((done, fail) => {
    const hash = createHash("sha256");
    createReadStream(file).on("data", (chunk) => hash.update(chunk)).on("end", () => done(hash.digest("hex"))).on("error", fail);
  });
}

async function walk(directory: string, files: string[] = []): Promise<string[]> {
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
    if (entry.isDirectory()) { if (!SKIP_DIRECTORIES.has(entry.name)) await walk(join(directory, entry.name), files); }
    else if (entry.isFile() && entry.name.endsWith(".webp")) files.push(join(directory, entry.name));
  }
  return files;
}

async function pool<T>(items: readonly T[], size: number, work: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: size }, async () => { while (next < items.length) await work(items[next++]); }));
}

/**
 * SHA-256 receipts: storage manifests and R2 upload logs (exact object key, and where the upload
 * read the file from), and the runtime data's *ImageHashes (relative path).
 */
async function knownHashes(): Promise<{ byKey: Map<string, string>; byRelative: Map<string, string>; sourceByKey: Map<string, string> }> {
  const byKey = new Map<string, string>();
  const sourceByKey = new Map<string, string>();
  for (const name of await readdir(join(repo, "data", "storage"))) {
    if (!name.endsWith(".manifest.json")) continue;
    const manifest = JSON.parse(await readFile(join(repo, "data", "storage", name), "utf8")) as { assets?: unknown; objects?: unknown };
    const rows = Array.isArray(manifest.assets) ? manifest.assets : Array.isArray(manifest.objects) ? manifest.objects : [];
    for (const row of rows as Array<Record<string, unknown>>) {
      if (typeof row.objectKey !== "string" || typeof row.sha256 !== "string") continue;
      byKey.set(row.objectKey, row.sha256);
      const source = [row.sourcePath, row.localPath].find((value): value is string => typeof value === "string" && value.startsWith("/"));
      if (source) sourceByKey.set(row.objectKey, source);
    }
  }
  for (const name of await readdir(join(repo, "docs"))) {
    if (!name.endsWith(".jsonl") || !name.includes("upload-log")) continue;
    for (const line of (await readFile(join(repo, "docs", name), "utf8")).split("\n")) {
      if (!line.trim()) continue;
      const row = JSON.parse(line) as { key?: string; sha256?: string; status?: string };
      if (row.key && row.sha256 && row.status !== "failed") byKey.set(row.key, row.sha256);
    }
  }
  const byRelative = new Map<string, string>();
  for (const folder of ["production", "raw"]) {
    for (const name of await readdir(join(repo, "src", "data", folder))) {
      if (!name.endsWith(".json")) continue;
      const data = JSON.parse(await readFile(join(repo, "src", "data", folder, name), "utf8")) as { questions?: Array<Record<string, unknown>> };
      for (const question of data.questions ?? []) {
        const pairs: Array<[unknown, unknown]> = [
          [question.questionImages, question.questionImageHashes],
          [question.markschemeImages, question.markschemeImageHashes],
          [(question.officialMarkscheme as Record<string, unknown> | undefined)?.images, (question.officialMarkscheme as Record<string, unknown> | undefined)?.imageHashes],
        ];
        for (const [paths, hashes] of pairs) {
          if (!Array.isArray(paths) || !Array.isArray(hashes) || paths.length !== hashes.length) continue;
          paths.forEach((path, index) => { if (typeof path === "string" && typeof hashes[index] === "string") byRelative.set(path, hashes[index] as string); });
        }
      }
    }
  }
  return { byKey, byRelative, sourceByKey };
}

function expectedHash(path: string, hashes: Awaited<ReturnType<typeof knownHashes>>): string | null {
  const exact = hashes.byKey.get(path);
  if (exact) return exact;
  // Repair crops are content-addressed: the file name is the SHA-256 of the bytes.
  const named = /^([a-f0-9]{64})\.webp$/.exec(basename(path));
  if (named) return named[1];
  // A release path is <bank>/releases/<release>/<relative path in the runtime data>.
  const segments = path.split("/");
  for (let start = 1; start < segments.length - 1; start += 1) {
    const hash = hashes.byRelative.get(segments.slice(start).join("/"));
    if (hash) return hash;
  }
  return null;
}

type LocalFile = { file: string; size: ImageSize | null; sha?: Promise<string> };
type LocalIndex = { byName: Map<string, LocalFile[]>; all: LocalFile[]; bySha?: Promise<Map<string, LocalFile>> };

/** One bank's local crops, indexed by file name (and, only when needed, by SHA-256). */
async function localIndex(bank: string): Promise<LocalIndex> {
  const byName = new Map<string, LocalFile[]>();
  const all: LocalFile[] = [];
  for (const folder of LOCAL_FOLDERS[bank] ?? []) {
    const files = await walk(join(siblings, folder));
    const entries: LocalFile[] = files.map((file) => ({ file, size: null }));
    await pool(entries, 64, async (entry) => { entry.size = await headerSize(entry.file).catch(() => null); });
    for (const entry of entries) {
      const name = basename(entry.file);
      byName.set(name, [...(byName.get(name) ?? []), entry]);
      all.push(entry);
    }
  }
  return { byName, all };
}

/** Hashes every local crop once, for stored files whose local copy has another name. */
function shaIndex(index: LocalIndex): Promise<Map<string, LocalFile>> {
  index.bySha ??= (async () => {
    const bySha = new Map<string, LocalFile>();
    await pool(index.all.filter((entry) => entry.size), 16, async (entry) => {
      entry.sha ??= sha256(entry.file);
      bySha.set(await entry.sha, entry);
    });
    return bySha;
  })();
  return index.bySha;
}

const normalizeFolder = (folder: string) => folder.replace(/-extension$/, "").replace(/s$/, "");

/** The folders of a stored path below its bank (and release) prefix. */
function storedFolders(path: string): string[] {
  const segments = path.split("/").slice(1, -1);
  const start = segments[0] === "releases" ? 2 : 0;
  return segments.slice(start).map(normalizeFolder);
}

const sameSize = (a: ImageSize, b: ImageSize) => a[0] === b[0] && a[1] === b[1];

/**
 * A local size for one stored path. With a recorded hash only a byte-identical file counts. Without
 * one, files with the same name in the same-named folder must all agree, or the path stays unsized.
 */
async function localSize(path: string, sha: string | null, index: LocalIndex): Promise<ImageSize | null> {
  const candidates = (index.byName.get(basename(path)) ?? []).filter((entry) => entry.size);
  const recorded = hashes.sourceByKey.get(path);
  if (sha && recorded) {
    // The file the upload read, if it is still there unchanged.
    const size = await headerSize(recorded).catch(() => null);
    if (size && await sha256(recorded).catch(() => null) === sha) return size;
  }
  if (sha) {
    for (const entry of candidates) {
      entry.sha ??= sha256(entry.file);
      if (await entry.sha === sha) return entry.size;
    }
    return (await shaIndex(index)).get(sha)?.size ?? null;
  }
  // Stored folders (questions/0610-2026-m-12) and local ones (assets/0610-2026-m-12/question)
  // differ in order and plural; every stored folder must still appear in the local path.
  const wanted = storedFolders(path);
  const matching = candidates.filter((entry) => {
    const local = new Set(entry.file.slice(siblings.length).split("/").slice(0, -1).map(normalizeFolder));
    return wanted.every((folder) => local.has(folder));
  });
  if (!matching.length) return null;
  return matching.every((entry) => sameSize(entry.size!, matching[0].size!)) ? matching[0].size : null;
}

async function bucketSize(path: string): Promise<ImageSize | null | "missing"> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(freePublicAssetUrl(path), { headers: { range: "bytes=0-63" } });
      if (response.status === 404) return "missing";
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer()).subarray(0, 64);
      return webpSize(bytes);
    } catch (error) {
      if (attempt === 2) throw new Error(`bucket read failed for ${path}`, { cause: error });
      await new Promise((done) => setTimeout(done, 500 * (attempt + 1)));
    }
  }
  return null;
}

const hashes = await knownHashes();
await mkdir(outputDirectory, { recursive: true });
const manifestFiles = (await readdir(manifestDirectory)).filter((name) => name.endsWith(".json"));
if (!manifestFiles.length) throw new Error("generated/asset-manifest is empty; run generate:asset-manifest with the CI build env first");
const report: string[] = [];
let mismatches = 0;

for (const name of manifestFiles.sort()) {
  const bank = name.slice(0, name.indexOf(".")) as BankSlug;
  if (onlyBank && bank !== onlyBank) continue;
  const manifest = JSON.parse(await readFile(join(manifestDirectory, name), "utf8")) as Record<string, AssetManifestEntry>;
  const images = new Map<string, boolean>();
  for (const [questionId, entry] of Object.entries(manifest)) {
    const free = isPreviewQuestion(bank, questionId);
    for (const kind of ["question", "answer"] as const) {
      for (const path of deliveredAssetPaths(entry, kind)) if (path.endsWith(".webp")) images.set(path, (images.get(path) ?? false) || free);
    }
  }
  const index = await localIndex(bank);
  const sizes = new Map<string, ImageSize>();
  let fromBucket = 0, fromLocal = 0, checked = 0, missingFree = 0;
  const unsized: string[] = [];
  await pool([...images], useBucket ? 24 : 32, async ([path, free]) => {
    const local = await localSize(path, expectedHash(path, hashes), index);
    const remote = free && useBucket ? await bucketSize(path) : null;
    if (remote === "missing") missingFree += 1;
    const published = remote && remote !== "missing" ? remote : null;
    if (published && local) {
      checked += 1;
      if (!sameSize(published, local)) { mismatches += 1; console.error(`${bank}: ${path} bucket ${published.join("x")} != local ${local.join("x")}`); }
    }
    const size = published ?? local;
    if (!size) { unsized.push(path); return; }
    if (published) fromBucket += 1; else fromLocal += 1;
    sizes.set(path, size);
  });
  const freeCount = [...images.values()].filter(Boolean).length;
  const encoded = JSON.stringify(encodeImageSizes(sizes));
  await writeFile(join(outputDirectory, `${bank}.json`), `${encoded}\n`);
  const line = `${bank}: ${sizes.size}/${images.size} sized (${(100 * sizes.size / Math.max(images.size, 1)).toFixed(1)}%); free ${fromBucket}/${freeCount} from bucket${missingFree ? ` (${missingFree} not in bucket)` : ""}, ${fromLocal} from local, ${checked} cross-checked; ${(encoded.length / 1024).toFixed(0)} KiB`;
  report.push(line);
  if (process.env.DEBUG_IMAGE_SIZES) console.log(unsized.sort().filter((_, i) => i % Math.max(1, Math.floor(unsized.length / 12)) === 0).join("\n"));
  console.log(line);
}

if (mismatches) throw new Error(`${mismatches} crops differ between the public bucket and the local crops`);
await stat(outputDirectory);
console.log(`\n${report.length} banks written to src/data/image-sizes/`);
