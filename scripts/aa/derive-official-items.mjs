// Writes `officialItems` into the AA overlay for every accepted record whose groups are all single-item groups.
//
//   node scripts/aa/derive-official-items.mjs
//
// The value is the union of the groups' member items in items.json order. Records touching a multi-item group are left
// alone (an agent tags them later). Idempotent; keeps the overlay's 2-space JSON and puts the key right after `subtopics`.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { derivedItems, loadAaData, overlayPath, serializeOverlay, withOfficialItems, writeOverlay } from "./official-items.mjs";

export function deriveOverlay(data) {
  let derived = 0;
  let pending = 0;
  let blocked = 0;
  const records = data.overlay.records.map((record) => {
    if (record.status !== "accepted") {
      blocked += 1;
      return record;
    }
    const items = derivedItems(record, data);
    if (!items) {
      pending += 1;
      return record;
    }
    derived += 1;
    return withOfficialItems(record, items);
  });
  return { overlay: { ...data.overlay, records }, derived, pending, blocked };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const before = readFileSync(overlayPath, "utf8");
  const { overlay, derived, pending, blocked } = deriveOverlay(loadAaData());
  const after = serializeOverlay(overlay);
  if (after !== before) writeOverlay(overlay);
  console.log(`derived ${derived} record(s) from single-item groups; ${pending} need item tagging; ${blocked} blocked; ${after === before ? "overlay unchanged" : "overlay updated"}`);
}
