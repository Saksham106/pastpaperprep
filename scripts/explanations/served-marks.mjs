// The marks students are served for a question: the raw runtime marks projected through the same reviewed overlays,
// in the same order, as `marks` in normalizeQuestion (src/lib/questions.ts):
//   historical Biology crops -> Biology printed marks -> 0606 split -> removed parts -> IB boundaries -> 0580 split.
// Used by prepare-batch (the writer's task) and publish (the validator), so both see the printed total.
// src/lib/explanations-served-marks.test.ts checks this projection against the runtime loader for every bank.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (name) => JSON.parse(readFileSync(join(repoRoot, "src/data", name), "utf8"));
const HISTORICAL = read("reviewed-biology-historical-crop-repairs.json");
const PRINTED = read("reviewed-biology-printed-marks.json");
const SPLITS_0606 = read("reviewed-0606-question-splits.json");
const REMOVED_PARTS = read("reviewed-science-removed-part-marks.json").entries;
const IB_BOUNDARIES = [read("reviewed-ib-question-boundary-repairs.json").banks, read("reviewed-ib-question-boundary-repairs-v2.json").banks];
const SPLITS_0580 = read("reviewed-0580-question-splits.json");

const has = (object, key) => Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
function step(entry, marks, what, bank, id) {
  if (!entry) return marks;
  if ((marks ?? null) !== entry.old || !Number.isInteger(entry.new) || entry.new <= 0) throw new Error(`Reviewed ${what} disagrees with ${bank}:${id}`);
  return entry.new;
}

export function servedMarks(bank, id, rawMarks) {
  let marks = typeof rawMarks === "number" ? rawMarks : null;
  marks = step(bank === HISTORICAL.bank && has(HISTORICAL.entries, id) ? HISTORICAL.entries[id].marks : null, marks, "historical marks repair", bank, id);
  marks = step(bank === PRINTED.bank && has(PRINTED.entries, id) ? PRINTED.entries[id] : null, marks, "printed marks repair", bank, id);
  marks = step(bank === SPLITS_0606.bank && has(SPLITS_0606.entries, id) ? SPLITS_0606.entries[id].marks : null, marks, "0606 question split", bank, id);
  marks = step(has(REMOVED_PARTS[bank], id) ? REMOVED_PARTS[bank][id] : null, marks, "removed-part marks", bank, id);
  const boundaries = IB_BOUNDARIES.filter((banks) => has(banks[bank], id));
  if (boundaries.length > 1) throw new Error(`Two reviewed IB question boundaries for ${bank}:${id}`);
  marks = step(boundaries[0]?.[bank][id].marks, marks, "IB question boundary", bank, id);
  marks = step(bank === SPLITS_0580.bank && has(SPLITS_0580.entries, id) ? SPLITS_0580.entries[id].marks : null, marks, "0580 question split", bank, id);
  return marks;
}
