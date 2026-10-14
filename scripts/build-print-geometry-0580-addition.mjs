#!/usr/bin/env node
// Physical print geometry for the reviewed 0580 Core 2026 addition.
//
// Same contract as src/data/print-geometry-0580.json (scripts/generate-print-geometry-0580.mjs):
// each crop's recorded source-page bounds give the exact rows where one exam page ends. This
// script reads, read-only, the source worktree's data/core-2026/{question,markscheme}-images.json
// registries, checks every registry hash/size against the actual WebP bytes and against the
// addition receipt, and writes a separate non-overlapping file. No 2026 crop carries a blank
// source page (the source pipeline trimmed trailing BLANK/copyright pages), so no segment is hidden.
//
//   node scripts/build-print-geometry-0580-addition.mjs --source <0580 source worktree> [--check]
//
// It also re-derives the historical file from the same source worktree's 2016-2025 registries
// and fails unless that equals the committed src/data/print-geometry-0580.json.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { buildGeometry } from "./generate-print-geometry-0580.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const RECEIPT = join(ROOT, "docs/igcse-0580-2026-core-addition.json");
const HISTORICAL = join(ROOT, "src/data/print-geometry-0580.json");
const OUTPUT = join(ROOT, "src/data/print-geometry-0580-2026-core.json");
const BLANKS = join(ROOT, "data/print/0580-blank-source-pages.json");
const HISTORICAL_RECEIPTS = [
  ["question", "data/question-images.json"],
  ["answer", "data/markscheme-images.json"],
  ["question", "data/core-2021-2025/question-images.json"],
  ["answer", "data/core-2021-2025/markscheme-images.json"],
];
const ADDITION_RECEIPTS = [
  ["question", "data/core-2026/question-images.json"],
  ["answer", "data/core-2026/markscheme-images.json"],
];

const fail = (message) => { throw new Error(`0580 addition geometry: ${message}`); };
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const args = process.argv.slice(2);
const sourceIndex = args.indexOf("--source");
if (sourceIndex < 0 || !args[sourceIndex + 1]) fail("--source <0580 source worktree> is required");
const source = resolve(args[sourceIndex + 1]);
const load = (file) => JSON.parse(readFileSync(join(source, file), "utf8")).images;

// The released 2021-2025 Core crops: the reviewed crop repair (crop-repair-receipt-2026-10-14.json)
// changed 81 lane crops after release; the historical receipt is re-derived from their recorded
// pre-repair ("before") geometry, so it stays provable from a repaired source worktree.
const REPAIR_RECEIPT = "data/core-2021-2025/crop-repair-receipt-2026-10-14.json";
const released = (() => {
  if (!existsSync(join(source, REPAIR_RECEIPT))) return new Map();
  const rows = JSON.parse(readFileSync(join(source, REPAIR_RECEIPT), "utf8")).repaired_crops.rows;
  return new Map(rows.map((row) => [`${row.kind}:${row.id}`, row.before]));
})();
const loadReleased = (kind, file) => load(file).map((image) => {
  const before = file.startsWith("data/core-2021-2025/") && released.get(`${kind === "question" ? "question" : "markscheme"}:${image.id}`);
  if (!before) return image;
  return { id: image.id, path: image.path, source_pages: before.source_pages, bounds_pt: before.bounds_pt,
    width: before.width, height: before.height, sha256: before.sha256 };
});

const blanks = JSON.parse(readFileSync(BLANKS, "utf8")).pages;
const historical = `${JSON.stringify(buildGeometry(HISTORICAL_RECEIPTS.map(([kind, file]) => [kind, loadReleased(kind, file)]), blanks))}\n`;
if (historical !== readFileSync(HISTORICAL, "utf8")) fail("historical 0580 geometry does not re-derive from this source worktree");

const receipt = JSON.parse(readFileSync(RECEIPT, "utf8"));
const rows = new Map(receipt.rows.map((row) => [row.id, row]));
const receipts = ADDITION_RECEIPTS.map(([kind, file]) => [kind, load(file)]);
for (const [kind, images] of receipts) {
  if (images.length !== receipt.addedQuestionCount || new Set(images.map((image) => image.id)).size !== images.length) fail(`${kind} registry inventory drift`);
  for (const image of images) {
    const row = rows.get(image.id) ?? fail(`${image.id} is not in the addition receipt`);
    const bytes = readFileSync(join(source, image.path));
    if (sha256(bytes) !== image.sha256) fail(`${image.path} bytes differ from its registry`);
    if (image.sha256 !== (kind === "question" ? row.questionImageSha256 : row.markschemeImageSha256)) fail(`${image.id}/${kind} differs from the receipt`);
    const { width, height } = await sharp(bytes).metadata();
    if (width !== image.width || height !== image.height) fail(`${image.path} dimensions differ from its registry`);
    if (image.source_pages.length !== image.bounds_pt.length) fail(`${image.id}/${kind} page bounds mismatch`);
  }
}
const geometry = buildGeometry(receipts, []);
const historicalIds = new Set(Object.keys(JSON.parse(historical).entries));
const ids = Object.keys(geometry.entries);
if (ids.length !== receipt.addedQuestionCount || ids.some((id) => historicalIds.has(id) || !rows.has(id))) fail("addition overlaps history or the receipt");
if (Object.values(geometry.entries).some((pair) => pair.some((entry) => !entry))) fail("every added question needs both a question and an answer entry");
const text = `${JSON.stringify({ ...geometry, addition: receipt.addition })}\n`;
if (args.includes("--check")) {
  if (readFileSync(OUTPUT, "utf8") !== text) fail("print-geometry-0580-2026-core.json is stale");
  console.log(`historical geometry re-derived exactly; ${ids.length} addition entries are current`);
} else {
  writeFileSync(OUTPUT, text);
  console.log(`historical geometry re-derived exactly; wrote ${ids.length} addition entries to ${OUTPUT}`);
}
