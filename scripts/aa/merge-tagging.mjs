// Merges item-tagging results into the AA overlay.
//
//   node scripts/aa/merge-tagging.mjs <dir> [--chunks <chunk dir>]
//
// <dir> holds *.json files, each an array of { id, officialItems }. Every id must be a chunked record (from
// export-tagging-chunks.mjs) and every item one of that record's candidates; officialItems must be non-empty and
// each id may appear once across all files. Nothing is written unless every file validates.
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAaData, overlayPath, withOfficialItems, writeOverlay } from "./official-items.mjs";
import { chunksDir, findResearchDir, loadChunkEntries } from "./export-tagging-chunks.mjs";

/**
 * @param {Array<{file: string, rows: unknown}>} files parsed result files
 * @param {Map<string, {candidates: Array<{item: string}>}>} chunked chunk entries by id
 * @returns {{errors: string[], tags: Map<string, string[]>}}
 */
export function validateTagging(files, chunked) {
  const errors = [];
  const tags = new Map();
  const seenIn = new Map();
  for (const { file, rows } of files) {
    if (!Array.isArray(rows)) {
      errors.push(`${file}: expected an array of { id, officialItems }`);
      continue;
    }
    rows.forEach((row, index) => {
      const where = `${file}[${index}]`;
      if (!row || typeof row.id !== "string" || !row.id) return void errors.push(`${where}: missing id`);
      const entry = chunked.get(row.id);
      if (!entry) return void errors.push(`${where}: ${row.id} is not a chunked record`);
      if (seenIn.has(row.id)) return void errors.push(`${where}: duplicate id ${row.id} (also in ${seenIn.get(row.id)})`);
      seenIn.set(row.id, where);
      const items = row.officialItems;
      if (!Array.isArray(items) || items.length === 0 || items.some((item) => typeof item !== "string")) {
        return void errors.push(`${where}: ${row.id} needs a non-empty officialItems array of strings`);
      }
      if (new Set(items).size !== items.length) return void errors.push(`${where}: ${row.id} repeats an item`);
      const allowed = new Set(entry.candidates.map((candidate) => candidate.item));
      const stray = items.filter((item) => !allowed.has(item));
      if (stray.length) return void errors.push(`${where}: ${row.id} item(s) ${stray.join(", ")} not among its candidates (${[...allowed].join(", ")})`);
      tags.set(row.id, items);
    });
  }
  return { errors, tags };
}

/** Writes the tags into a copy of the overlay, sorted in items.json order, and returns it with counts. */
export function applyTagging(data, tags) {
  let written = 0;
  let unchanged = 0;
  const records = data.overlay.records.map((record) => {
    const items = tags.get(record.id);
    if (!items) return record;
    const sorted = [...items].sort((a, b) => data.itemOrder.get(a) - data.itemOrder.get(b));
    if (JSON.stringify(record.officialItems) === JSON.stringify(sorted)) unchanged += 1;
    else written += 1;
    return withOfficialItems(record, sorted);
  });
  return { overlay: { ...data.overlay, records }, written, unchanged };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = args.indexOf("--chunks");
  const chunkArg = flag >= 0 ? args.splice(flag, 2)[1] : null;
  const [dir] = args;
  if (!dir) {
    console.error("Usage: merge-tagging.mjs <dir of result *.json> [--chunks <chunk dir>]");
    process.exit(2);
  }
  const researchDir = chunkArg ? null : findResearchDir();
  const chunkDir = chunkArg ?? (researchDir ? chunksDir(researchDir) : null);
  if (!chunkDir) {
    console.error("No chunk directory: run export-tagging-chunks.mjs or pass --chunks <dir>.");
    process.exit(2);
  }
  const names = readdirSync(dir).filter((name) => name.endsWith(".json")).sort();
  if (!names.length) {
    console.error(`No *.json files in ${dir}`);
    process.exit(2);
  }
  const files = names.map((name) => ({ file: name, rows: JSON.parse(readFileSync(join(dir, name), "utf8")) }));
  const data = loadAaData();
  const { errors, tags } = validateTagging(files, loadChunkEntries(chunkDir));
  if (errors.length) {
    console.error(`${errors.length} problem(s); nothing written:\n${errors.slice(0, 50).join("\n")}${errors.length > 50 ? `\n…and ${errors.length - 50} more` : ""}`);
    process.exit(1);
  }
  const { overlay, written, unchanged } = applyTagging(data, tags);
  writeOverlay(overlay, overlayPath);
  const accepted = overlay.records.filter((record) => record.status === "accepted");
  const missing = accepted.filter((record) => !record.officialItems?.length).length;
  console.log(`${files.length} file(s): ${tags.size} record(s) tagged (${written} written, ${unchanged} unchanged); ${missing} accepted record(s) still without officialItems`);
}
