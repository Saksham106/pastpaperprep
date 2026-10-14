#!/usr/bin/env node
// Builds the reviewed 0606 mark-scheme right/left-edge repair overlay and its storage manifest from
// the source repository's sealed repair results (igcse-additional-mathematics-0606-topic-practice,
// data/ms-right-edge-repair-images.json). Every replaced path is bound to its exact current active
// path and SHA-256; historical crops, raw runtime JSON and earlier repair overlays are not modified.
//
// usage: node scripts/build-0606-ms-right-edge-repairs.mjs [--check]
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const commonDir = execFileSync("git", ["-C", ROOT, "rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" }).trim();
const SOURCE = process.env.PASTPAPERPREP_0606_SOURCE_ROOT
  ? resolve(process.env.PASTPAPERPREP_0606_SOURCE_ROOT)
  : join(dirname(commonDir), "..", "igcse-additional-mathematics-0606-topic-practice");
const VERSION = "0606-ms-right-edge-v1";
const OVERLAY = join(ROOT, "src/data/reviewed-0606-ms-right-edge-repairs.json");
const STORAGE = join(ROOT, "data/storage/0606-ms-right-edge-repairs.manifest.json");
const FREE_YEARS = [2016, 2017, 2018];

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const resultsBytes = readFileSync(join(SOURCE, "data/ms-right-edge-repair-images.json"));
const results = JSON.parse(resultsBytes);
if (results.version !== VERSION) throw new Error("Unexpected source repair version");
const namespace = `repairs/${VERSION}-${sha(resultsBytes).slice(0, 16)}`;

const raw = new Map(readJson(join(ROOT, "src/data/raw/igcse-additional.json")).questions.map((q) => [q.id, q]));
const maths = readJson(join(ROOT, "src/data/reviewed-maths-source-answer-repairs.json"))["igcse-additional"];
const geometry = readJson(join(ROOT, "src/data/print-geometry-0606.json")).entries;
const sourceCrops = new Map(readJson(join(SOURCE, "data/markscheme-images.json")).images.map((e) => [e.id, e]));

const entries = {};
const objects = [];
for (const item of results.images) {
  const local = join(SOURCE, item.path);
  if (lstatSync(local).isSymbolicLink()) throw new Error(`Refusing symlink ${item.path}`);
  const bytes = readFileSync(local);
  if (sha(bytes) !== item.sha256 || bytes.length !== item.bytes) throw new Error(`Source repair drift: ${item.path}`);
  const question = raw.get(item.id);
  if (!question || question.markschemeImages.length !== 1) throw new Error(`Unexpected runtime row ${item.id}`);
  const newPath = `${namespace}/${item.sha256}.webp`;
  const year = Number(item.id.split("-")[1]);
  // Content-addressed: papers that reprint an identical mark-scheme table share one object.
  const existing = objects.find((o) => o.path === newPath);
  if (existing) {
    existing.questionIds.push(item.id);
    existing.freeYear ||= FREE_YEARS.includes(year);
  } else {
    objects.push({
      objectKey: `igcse-additional/${newPath}`, path: newPath, questionIds: [item.id],
      sourcePath: item.path, sha256: item.sha256, bytes: item.bytes, contentType: "image/webp",
      width: item.width, height: item.height, freeYear: FREE_YEARS.includes(year),
    });
  }
  if (item.kind === "build_crops") {
    // Only rows whose answer is still the historical crop: the reviewed maths repair supersedes the rest.
    if (maths[item.id]) throw new Error(`${item.id}: historical crop is not the active answer`);
    const oldPath = `markschemes/${item.id}.webp`;
    if (question.markschemeImages[0] !== oldPath || item.old_path !== `site/${oldPath}`) throw new Error(`${item.id}: path mismatch`);
    if (sourceCrops.get(item.id)?.sha256 !== item.old_sha256) throw new Error(`${item.id}: historical crop hash mismatch`);
    const historical = geometry[item.id]?.[1];
    if (!historical || historical.imageDimensions[0] !== item.old_size[0] || historical.imageDimensions[1] !== item.old_size[1] ||
      historical.imageDimensions[1] !== item.height) throw new Error(`${item.id}: print geometry disagrees`);
    const [left, right] = item.clip_x_pt;
    entries[item.id] = {
      oldPaths: [oldPath], oldSha256: [item.old_sha256], newPaths: [newPath], sha256: [item.sha256],
      clipXPt: [[left, right]],
      // Same vertical geometry as the historical receipt; only the width grows with the window.
      printGeometry: {
        physicalSizePt: [Math.round((right - left) * 100) / 100, historical.physicalSizePt[1]],
        imageDimensions: [item.width, item.height],
        segments: historical.segments,
      },
    };
  } else if (item.kind === "source_grid") {
    const prior = maths[item.id];
    if (!prior || JSON.stringify(question.markschemeImages) !== JSON.stringify(prior.oldPaths)) throw new Error(`${item.id}: no reviewed maths repair`);
    const index = item.image_index - 1;
    if (prior.sha256[index] !== item.old_sha256) throw new Error(`${item.id}: source-grid image hash mismatch`);
    const newPaths = [...prior.newPaths];
    const hashes = [...prior.sha256];
    newPaths[index] = newPath;
    hashes[index] = item.sha256;
    entries[item.id] = {
      oldPaths: [...prior.newPaths], oldSha256: [...prior.sha256], newPaths, sha256: hashes,
      rectPt: [item.rect_pt],
    };
  } else {
    throw new Error(`${item.id}: unknown repair kind`);
  }
}

const overlay = {
  schema: "reviewed-0606-ms-right-edge-repairs-v1",
  bank: "igcse-additional",
  namespace,
  reason: "Mark-scheme crops whose printed table (guidance text, question labels or outer rules) ran past the crop window, re-rendered from the clean source PDFs with the same vertical geometry and a window containing every printed mark.",
  sourceRepository: "igcse-additional-mathematics-0606-topic-practice",
  sourceResultsSha256: sha(resultsBytes),
  entries: Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b))),
};
objects.sort((a, b) => a.objectKey.localeCompare(b.objectKey));
const storage = {
  schema: "0606-ms-right-edge-repairs-storage-v1",
  namespace,
  sourceResultsSha256: sha(resultsBytes),
  privateBucket: "pastpaperprep-assets",
  supabaseBucket: "question-assets",
  publicFreeBucket: "pastpaperprep-free",
  freeYears: FREE_YEARS,
  objectCount: objects.length,
  freeObjectCount: objects.filter((o) => o.freeYear).length,
  objectBytes: objects.reduce((sum, o) => sum + o.bytes, 0),
  objects,
};
const outputs = [[OVERLAY, overlay], [STORAGE, storage]];
if (process.argv.includes("--check")) {
  for (const [path, value] of outputs) {
    if (readFileSync(path, "utf8") !== `${JSON.stringify(value, null, 1)}\n`) throw new Error(`${path} is stale`);
  }
  console.log("up to date");
} else {
  for (const [path, value] of outputs) writeFileSync(path, `${JSON.stringify(value, null, 1)}\n`);
  console.log(`${Object.keys(entries).length} entries, ${objects.length} objects (${storage.freeObjectCount} free-year) -> ${namespace}`);
}
