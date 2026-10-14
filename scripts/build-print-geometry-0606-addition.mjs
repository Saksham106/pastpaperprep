#!/usr/bin/env node
// Physical print geometry for the reviewed 0606 Feb/March 2026 addition.
//
// The historical src/data/print-geometry-0606.json (1,633 pairs) was projected from the
// research sidecar verified-geometry.json (pastpaperprep-crop-audit-20260928/igcse-0606-geometry).
// This script applies the same contract to the 23 added pairs, read-only, from the source
// repository: hash-verified original PDFs, the crop registries' page bounds, the crop generator's
// x-window (default margins or a reviewed clip_x_pt) at 150 DPI, and the actual WebP dimensions.
//
//   node scripts/build-print-geometry-0606-addition.mjs --source <0606 source worktree> [--check]
//   node scripts/build-print-geometry-0606-addition.mjs --validate-sidecar <verified-geometry.json>
//
// --validate-sidecar re-derives all 1,633 historical entries from the sidecar's source bounds with
// this script's raster rule and fails unless they equal the committed historical file.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import sharp from "sharp";

const ROOT = resolve(import.meta.dirname, "..");
const ADDITION = "0606-2026-march";
const PAPERS = ["0606-2026-march-12", "0606-2026-march-22"];
const HISTORICAL = join(ROOT, "src/data/print-geometry-0606.json");
const OUTPUT = join(ROOT, "src/data/print-geometry-0606-2026-march.json");
const SCALE = 150 / 72;
// PyMuPDF rounds a transformed clip outward with a small tolerance; this reproduces all
// 4,170 verified source-page raster heights and widths in the historical sidecar.
const EPS = 1e-3;
// Reviewed historical seams where the stitched asset has one extra row in the later segment.
const REVIEWED_ONE_PIXEL_SEAMS = new Set([
  "0606-2018-november-23-q6:markscheme",
  "0606-2024-november-22-q2:markscheme",
  "0606-2025-november-11-q5:markscheme",
]);

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const round2 = (value) => Math.round(value * 100) / 100;
const rasterSpan = (from, to) => Math.ceil(to * SCALE - EPS) - Math.floor(from * SCALE + EPS);
const fail = (message) => { throw new Error(`0606 addition geometry: ${message}`); };

function defaultWindow(pageWidth) {
  return pageWidth <= 600 ? [42, Math.min(555, pageWidth - 40)] : [30, pageWidth - 30];
}

/** Project one crop to the app's verified-0606-print-geometry-v1 entry shape. */
export function projectEntry({ id, kind, pages, bounds, window, imageDimensions, reviewedSeam = false }) {
  if (!pages.length || pages.length !== bounds.length) fail(`${id}/${kind}: page bounds mismatch`);
  const [left, right] = window;
  if (rasterSpan(left, right) !== imageDimensions[0]) fail(`${id}/${kind}: raster width disagrees with the source window`);
  let y = 0;
  const segments = pages.map((page, index) => {
    const [top, bottom] = bounds[index];
    if (!(bottom > top && top >= 0)) fail(`${id}/${kind}: invalid bounds`);
    const height = rasterSpan(top, bottom);
    const segment = [y, height, round2(bottom - top), page];
    y += height;
    return segment;
  });
  const delta = imageDimensions[1] - y;
  if (delta === 1 && segments.length === 1) segments[0][1] += 1;
  else if (delta === 1 && segments.length === 2 && reviewedSeam) segments[1][1] += 1;
  else if (delta !== 0) fail(`${id}/${kind}: unreviewed raster/source discrepancy ${delta}`);
  for (let index = 1; index < segments.length; index += 1) {
    if (segments[index - 1][0] + segments[index - 1][1] !== segments[index][0]) fail(`${id}/${kind}: segment gap`);
  }
  const physicalHeight = round2(bounds.reduce((sum, [top, bottom]) => sum + (bottom - top), 0));
  return { physicalSizePt: [round2(right - left), physicalHeight], imageDimensions, segments };
}

function serialize(value) {
  const sort = (item) => Array.isArray(item) ? item.map(sort)
    : item && typeof item === "object" ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, sort(item[key])])) : item;
  return `${JSON.stringify(sort(value))}\n`;
}

function pageWidth(pdfBytes) {
  const boxes = new Set([...pdfBytes.toString("latin1").matchAll(/\/MediaBox\s*\[\s*([^\]]+)\]/g)].map((match) => match[1].trim().split(/\s+/).map(Number).join(" ")));
  if (boxes.size !== 1) fail("source PDF needs exactly one uniform MediaBox");
  const [x0, , x1] = [...boxes][0].split(" ").map(Number);
  return x1 - x0;
}

async function buildAddition(sourceRoot) {
  const raw = JSON.parse(readFileSync(join(ROOT, "src/data/raw/igcse-additional.json"), "utf8"));
  const historical = JSON.parse(readFileSync(HISTORICAL, "utf8"));
  const manifest = new Map(JSON.parse(readFileSync(join(sourceRoot, "data/source-manifest.json"), "utf8")).records.map((r) => [r.id, r]));
  const registries = Object.fromEntries(["question", "markscheme"].map((kind) => [kind,
    new Map(JSON.parse(readFileSync(join(sourceRoot, `data/${kind}-images.json`), "utf8")).images.map((r) => [r.id, r]))]));
  const rows = raw.questions.filter((row) => PAPERS.includes(row.paperId));
  if (rows.length !== 23) fail(`expected 23 added rows, found ${rows.length}`);
  const sources = {};
  const entries = {};
  for (const row of rows) {
    if (historical.entries[row.id]) fail(`${row.id} already has historical geometry`);
    const record = manifest.get(row.paperId) ?? fail(`${row.paperId} missing from source manifest`);
    const pair = [];
    for (const [kind, field, folder, pdfSha] of [
      ["question", "questionImages", "questions", record.question_sha256],
      ["markscheme", "markschemeImages", "markschemes", record.mark_scheme_sha256],
    ]) {
      const reg = registries[kind].get(row.id) ?? fail(`${row.id}/${kind} missing from registry`);
      const assetPath = `${folder}/${row.id}.webp`;
      if (JSON.stringify(row[field]) !== JSON.stringify([assetPath]) || reg.path !== `site/${assetPath}`) fail(`${row.id}/${kind}: asset reference mismatch`);
      if (reg.source_sha256 !== pdfSha) fail(`${row.id}/${kind}: registry PDF hash differs from source manifest`);
      const pdfBytes = readFileSync(join(sourceRoot, reg.source_pdf));
      if (sha256(pdfBytes) !== pdfSha) fail(`${row.id}/${kind}: original PDF hash mismatch`);
      sources[`${row.paperId}:${kind}`] = pdfSha;
      const image = readFileSync(join(sourceRoot, reg.path));
      if (sha256(image) !== reg.sha256) fail(`${row.id}/${kind}: crop hash mismatch`);
      const meta = await sharp(image).metadata();
      if (meta.width !== reg.width || meta.height !== reg.height) fail(`${row.id}/${kind}: registry dimensions differ from WebP`);
      const window = reg.clip_x_pt ?? defaultWindow(pageWidth(pdfBytes));
      pair.push(projectEntry({ id: row.id, kind, pages: reg.source_pages, bounds: reg.bounds_pt, window, imageDimensions: [meta.width, meta.height] }));
    }
    entries[row.id] = pair;
  }
  return {
    schema: "verified-0606-print-geometry-v1",
    addition: ADDITION,
    historicalGeometrySha256: sha256(readFileSync(HISTORICAL)),
    sourcePdfSha256: Object.fromEntries(Object.entries(sources).sort()),
    entries,
  };
}

function validateSidecar(path) {
  const sidecar = JSON.parse(readFileSync(path, "utf8"));
  const historical = JSON.parse(readFileSync(HISTORICAL, "utf8"));
  if (sha256(readFileSync(path)) !== historical.sourceSidecarSha256) fail("sidecar hash differs from the historical receipt");
  let compared = 0;
  for (const [id, parts] of Object.entries(sidecar.entries)) {
    const pair = ["question", "markscheme"].map((kind) => {
      const part = parts[kind];
      const segments = part.sourcePageSegments;
      return projectEntry({
        id, kind,
        pages: segments.map((segment) => segment.sourcePage),
        bounds: segments.map((segment) => [segment.sourceBoundsPt[1], segment.sourceBoundsPt[3]]),
        window: [segments[0].sourceBoundsPt[0], segments[0].sourceBoundsPt[2]],
        imageDimensions: part.imageDimensions,
        reviewedSeam: REVIEWED_ONE_PIXEL_SEAMS.has(`${id}:${kind}`),
      });
    });
    if (serialize(pair) !== serialize(historical.entries[id])) fail(`${id}: re-derived historical entry differs`);
    compared += 1;
  }
  if (compared !== Object.keys(historical.entries).length) fail("historical entry coverage differs");
  return compared;
}

const args = process.argv.slice(2);
const option = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
if (option("--validate-sidecar")) {
  console.log(`re-derived ${validateSidecar(resolve(option("--validate-sidecar")))} historical pairs exactly`);
} else {
  const sourceRoot = option("--source") ?? fail("--source <0606 source worktree> is required");
  const bytes = serialize(await buildAddition(resolve(sourceRoot)));
  if (args.includes("--check")) {
    if (readFileSync(OUTPUT, "utf8") !== bytes) fail("committed addition geometry differs from a rebuild");
    console.log("addition geometry matches a rebuild");
  } else {
    writeFileSync(OUTPUT, bytes);
    console.log(`wrote ${OUTPUT} sha256=${sha256(Buffer.from(bytes))}`);
  }
}
