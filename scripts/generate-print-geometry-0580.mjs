#!/usr/bin/env node
// Builds src/data/print-geometry-0580.json from the 0580 source pipeline's crop receipts.
//
// Each 0580 crop stitches one or more source exam pages; the pipeline records every page's
// vertical PDF bounds (bounds_pt) and the crop's SHA-256. Those bounds give the exact pixel
// rows where one exam page ends and the next begins, so the PDF exporter can break a long
// question only where the printed paper itself breaks. Source pages that are "BLANK PAGE"
// (data/print/0580-blank-source-pages.json, OCR evidence bound to the same image hashes)
// are marked so the exporter can leave them out.
//
// Usage: node scripts/generate-print-geometry-0580.mjs [--check]
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// The 0580 source pipeline repository (not its site/ folder); defaults to the sibling checkout.
const SOURCE_ROOT = process.env.PASTPAPERPREP_IGCSE_0580_REPO
  ? resolve(process.env.PASTPAPERPREP_IGCSE_0580_REPO)
  : join(REPO_ROOT, "..", "igcse-0580-topic-practice");
const OUTPUT = join(REPO_ROOT, "src/data/print-geometry-0580.json");
const BLANKS = join(REPO_ROOT, "data/print/0580-blank-source-pages.json");
const RECEIPTS = [
  ["question", "data/question-images.json"],
  ["answer", "data/markscheme-images.json"],
  ["question", "data/core-2021-2025/question-images.json"],
  ["answer", "data/core-2021-2025/markscheme-images.json"],
];
// Crops are 1070 px across a 513 pt exam text block; wider crops keep the same horizontal scale.
const POINTS_PER_PIXEL_X = 513 / 1070;

const round2 = (value) => Math.round(value * 100) / 100;

export function segmentRows(heightPx, boundsPt) {
  const heights = boundsPt.map(([top, bottom]) => bottom - top);
  if (heights.some((height) => !(height > 0))) throw new Error("Source page bounds must have positive height");
  const total = heights.reduce((sum, height) => sum + height, 0);
  const rows = [0];
  let cumulative = 0;
  for (const height of heights.slice(0, -1)) {
    cumulative += height;
    rows.push(Math.round(cumulative * heightPx / total));
  }
  rows.push(heightPx);
  return heights.map((height, index) => [rows[index], rows[index + 1] - rows[index], round2(height)]);
}

export function buildGeometry(receipts, blankPages) {
  const blank = new Map(blankPages.map((page) => [`${page.path}#${page.segmentIndex}`, page]));
  const entries = {};
  for (const [kind, images] of receipts) {
    for (const image of images) {
      const path = image.path.replace(/^site\//, "");
      const rows = segmentRows(image.height, image.bounds_pt);
      const segments = rows.map(([sourceY, sourceHeight, physicalHeightPt], index) => {
        const evidence = blank.get(`${path}#${index}`);
        if (evidence && (evidence.imageSha256 !== image.sha256 || evidence.sourcePage !== image.source_pages[index])) {
          throw new Error(`Blank-page evidence for ${path} does not match its source receipt`);
        }
        return [sourceY, sourceHeight, physicalHeightPt, image.source_pages[index], evidence ? 0 : 1];
      });
      const physicalHeightPt = round2(segments.reduce((sum, segment) => sum + segment[2], 0));
      const entry = [path, image.sha256, image.width, image.height, round2(image.width * POINTS_PER_PIXEL_X), physicalHeightPt, segments];
      (entries[image.id] ??= [null, null])[kind === "question" ? 0 : 1] = entry;
    }
  }
  const used = new Set(Object.values(entries).flatMap((pair) => pair.filter(Boolean)
    .flatMap(([path, , , , , , segments]) => segments.map((segment, index) => segment[4] === 0 ? `${path}#${index}` : null))));
  for (const key of blank.keys()) if (!used.has(key)) throw new Error(`Blank-page evidence ${key} matches no source crop`);
  return {
    schema: "verified-0580-print-geometry-v2",
    format: "entries[id] = [question, answer]; each is [path, imageSha256, widthPx, heightPx, widthPt, heightPt, segments[[sourceY, sourceHeight, physicalHeightPt, sourcePage, include]]]",
    entries: Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b))),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const receipts = RECEIPTS.map(([kind, file]) => [kind, JSON.parse(readFileSync(join(SOURCE_ROOT, file), "utf8")).images]);
  const geometry = buildGeometry(receipts, JSON.parse(readFileSync(BLANKS, "utf8")).pages);
  const text = `${JSON.stringify(geometry)}\n`;
  if (process.argv.includes("--check")) {
    if (readFileSync(OUTPUT, "utf8") !== text) { console.error("print-geometry-0580.json is stale"); process.exit(1); }
    console.log("print-geometry-0580.json is current");
  } else {
    writeFileSync(OUTPUT, text);
    console.log(`Wrote ${Object.keys(geometry.entries).length} questions to ${OUTPUT}`);
  }
}
