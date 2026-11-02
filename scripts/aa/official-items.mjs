// Shared helpers for the item-level official tags on AA bank questions (`officialItems` in overlay.json).
//
// A record's `groupIds` are student-facing groups; 25 of the 50 groups hold more than one syllabus item. Records whose groups
// are all single-item derive `officialItems` mechanically (derive-official-items.mjs). The rest are tagged by an agent pass
// from chunk files (export-tagging-chunks.mjs) and written back by merge-tagging.mjs.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const subtopicsDir = join(repoRoot, "src/data/aa-official-subtopics");
export const overlayPath = join(subtopicsDir, "overlay.json");

export const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

export function loadAaData(dir = subtopicsDir) {
  const items = readJson(join(dir, "items.json")).items;
  const groups = readJson(join(dir, "taxonomy.json")).groups;
  const overlay = readJson(join(dir, "overlay.json"));
  const itemOrder = new Map(items.map((entry, index) => [entry.item, index]));
  const groupById = new Map(groups.map((group) => [group.id, group]));
  return { items, groups, overlay, itemOrder, groupById };
}

/** True when every group of the record holds exactly one official item. */
export function isSingleItemRecord(record, groupById) {
  return record.groupIds.length > 0 && record.groupIds.every((id) => (groupById.get(id)?.memberOfficialItems ?? []).length === 1);
}

/** Union of the member items of the record's groups, in items.json order. */
export function unionItems(record, { groupById, itemOrder }) {
  const found = new Set();
  for (const id of record.groupIds) {
    const group = groupById.get(id);
    if (!group) throw new Error(`${record.id}: unknown group ${id}`);
    for (const item of group.memberOfficialItems) {
      if (!itemOrder.has(item)) throw new Error(`${record.id}: group ${id} lists unknown item ${item}`);
      found.add(item);
    }
  }
  return [...found].sort((a, b) => itemOrder.get(a) - itemOrder.get(b));
}

/** The derived tags of a record when it needs no judgement, else null. */
export function derivedItems(record, data) {
  return record.status === "accepted" && isSingleItemRecord(record, data.groupById) ? unionItems(record, data) : null;
}

/** Returns a copy of the record with `officialItems` placed right after `subtopics` (key order otherwise untouched). */
export function withOfficialItems(record, officialItems) {
  const next = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === "officialItems") continue;
    next[key] = value;
    if (key === "subtopics") next.officialItems = officialItems;
  }
  if (!("subtopics" in record)) next.officialItems = officialItems;
  return next;
}

/** Same format as the generator writes: 2-space JSON and a trailing newline. */
export const serializeOverlay = (overlay) => JSON.stringify(overlay, null, 2) + "\n";

export function writeOverlay(overlay, file = overlayPath) {
  writeFileSync(file, serializeOverlay(overlay));
}

export const levelKey = (record) => `${record.level}:${record.id}`;
