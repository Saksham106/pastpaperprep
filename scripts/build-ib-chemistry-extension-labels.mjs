#!/usr/bin/env node
// Writes src/data/reviewed-ib-chemistry-extension-labels.json: reviewed labels for the IB Chemistry 2016-2019 rows.
// Two corrections to the sealed runtime, applied at load time by src/lib/reviewed-ib-chemistry-labels.ts so the sealed
// bytes are unchanged:
// - primaries the primary review (docs/audits/ib-chemistry-extension-primaries-review.json) changed;
// - the verified secondary subtopics, which the extension generator dropped (every such row serves its primary only).
//
//   node scripts/build-ib-chemistry-extension-labels.mjs [--check]
//
// Candidates: the extension's reconciled results at the sealed source commit (SHA-256 pinned by its own
// receipt) and, for the 2019 HL Paper 2 rows, docs/audits/ib-chemistry-hl-2019-p2-review.json. Only links the
// verification audit (docs/audits/ib-chemistry-extension-secondaries-verification.json) keeps are written. A changed
// primary drops out of the secondaries, and the old primary becomes a secondary only where the review says it still
// earns marks.
// Names come from the extension taxonomy. Every row is checked against the committed runtime.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const SOURCE_COMMIT = "85cae43c22852460af47699c94cca16d86380755";
const RECONCILED_PATH = "data/classification-extension/reconciliation-2026-09-21/classification-results.reconciled.json";
const RECONCILED_SHA256 = "af5d0a796bef5227bbbdd4f8e79ba3faa1fb77bb60c8ce889aa953465e38c718";
const TAXONOMY_SHA256 = "98304b2aa38eb2c082ad2c8510ddd85c108311e950cf93d598e64a1a9d756d30";
const REVIEW_PATH = "docs/audits/ib-chemistry-hl-2019-p2-review.json";
const VERIFICATION_PATH = "docs/audits/ib-chemistry-extension-secondaries-verification.json";
const PRIMARIES_PATH = "docs/audits/ib-chemistry-extension-primaries-review.json";
const OUTPUT = "src/data/reviewed-ib-chemistry-extension-labels.json";
const BANKS = ["ib-chemistry-hl", "ib-chemistry-sl"];
const VERSION = "ib-chemistry-extension-2016-2019";

const common = execFileSync("git", ["-C", root, "rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" }).trim();
const sourceRoot = process.env.PASTPAPERPREP_IB_CHEMISTRY_SOURCE_ROOT
  ? resolve(process.env.PASTPAPERPREP_IB_CHEMISTRY_SOURCE_ROOT)
  : join(resolve(dirname(common), ".."), "ib-chemistry-topic-practice");
const sourceAt = (path) => execFileSync("git", ["-C", sourceRoot, "show", `${SOURCE_COMMIT}:${path}`], { maxBuffer: 200_000_000 });

const reconciledBytes = sourceAt(RECONCILED_PATH);
if (sha(reconciledBytes) !== RECONCILED_SHA256) throw new Error("Reconciled results hash drift");
const taxonomyBytes = sourceAt("data/classification-taxonomy.json");
if (sha(taxonomyBytes) !== TAXONOMY_SHA256) throw new Error("Taxonomy hash drift");
const taxonomy = JSON.parse(taxonomyBytes);
const subtopics = new Map(taxonomy.normalized_topics.flatMap((t) => t.subtopics.map((s) => [s.id, { name: s.name, topic: t.name }])));

const reviewBytes = readFileSync(join(root, REVIEW_PATH));
const verificationBytes = readFileSync(join(root, VERIFICATION_PATH));
const primariesBytes = readFileSync(join(root, PRIMARIES_PATH));
const candidates = new Map(JSON.parse(reconciledBytes).rows.map((row) => [row.id, row]));
for (const row of JSON.parse(reviewBytes).rows) candidates.set(row.id, row);
const verdicts = new Map(JSON.parse(verificationBytes).rows.map((row) => [row.id, row.links]));
const primaryReview = new Map();
for (const row of JSON.parse(primariesBytes).rows) {
  for (const id of row.members) {
    if (primaryReview.has(id)) throw new Error(`${id}: reviewed twice in the primary review`);
    primaryReview.set(id, row);
  }
}

const banks = {};
let rowsWithSecondaries = 0, links = 0, changedPrimaries = 0, entriesTotal = 0, reviewed = 0;
for (const bank of BANKS) {
  const runtime = JSON.parse(readFileSync(join(root, `src/data/raw/${bank}.json`), "utf8"));
  const entries = {};
  for (const q of runtime.questions.filter((row) => row.classificationVersion === VERSION)) {
    const candidate = candidates.get(q.id);
    if (!candidate) throw new Error(`No candidate row for ${q.id}`);
    const source = subtopics.get(candidate.primary_subtopic_id);
    if (!source || q.subtopics.length !== 1 || q.subtopics[0] !== source.name || q.primaryTopic !== source.topic || q.secondaryTopics.length) throw new Error(`${q.id}: runtime classification does not match its candidate row`);
    const review = primaryReview.get(q.id);
    if (!review || review.current !== candidate.primary_subtopic_id) throw new Error(`${q.id}: primary review missing or reviewed a different primary`);
    reviewed++;
    const primaryId = review.final_primary;
    if (primaryId !== review.current && review.adjudication?.verdict !== "change") throw new Error(`${q.id}: primary changed without a change verdict`);
    const primary = subtopics.get(primaryId);
    if (!primary) throw new Error(`${q.id}: unknown primary ${primaryId}`);
    const proposed = [...new Set(candidate.secondary_subtopic_ids ?? [])].filter((id) => id !== candidate.primary_subtopic_id);
    let kept = [];
    if (proposed.length) {
      const linksFor = verdicts.get(q.id);
      if (!linksFor || JSON.stringify(linksFor.map((l) => l.subtopic_id)) !== JSON.stringify(proposed)) throw new Error(`${q.id}: verification does not cover its candidates exactly`);
      kept = linksFor.filter((l) => l.verdict === "keep").map((l) => {
        if (!l.part || !(l.marks > 0)) throw new Error(`${q.id}: kept link ${l.subtopic_id} has no part and marks`);
        if (!subtopics.has(l.subtopic_id)) throw new Error(`${q.id}: unknown subtopic ${l.subtopic_id}`);
        return l.subtopic_id;
      });
    }
    const changed = primaryId !== candidate.primary_subtopic_id;
    const secondaryIds = [...new Set([...(changed && review.adjudication.old_primary_earns_marks ? [candidate.primary_subtopic_id] : []), ...kept])].filter((id) => id !== primaryId);
    if (!changed && !secondaryIds.length) continue;
    const secondaries = secondaryIds.map((id) => subtopics.get(id));
    entries[q.id] = {
      sourceTopic: source.topic,
      sourceSubtopic: source.name,
      primaryTopic: primary.topic,
      primarySubtopic: primary.name,
      secondarySubtopics: secondaries.map((s) => s.name),
      secondaryTopics: [...new Set(secondaries.map((s) => s.topic))].filter((topic) => topic !== primary.topic),
    };
    entriesTotal++;
    if (changed) changedPrimaries++;
    if (secondaries.length) { rowsWithSecondaries++; links += secondaries.length; }
  }
  banks[bank] = entries;
}
if (reviewed !== primaryReview.size) throw new Error("Primary review does not cover the 2016-2019 rows exactly");

const out = {
  schemaVersion: "reviewed-ib-chemistry-extension-labels.v1",
  sources: { sourceCommit: SOURCE_COMMIT, reconciledResultsSha256: RECONCILED_SHA256, taxonomySha256: TAXONOMY_SHA256, reviewManifestSha256: sha(reviewBytes), verificationSha256: sha(verificationBytes), primariesReviewSha256: sha(primariesBytes) },
  counts: { entries: entriesTotal, changedPrimaries, rowsWithSecondaries, links },
  banks,
};
const text = `${JSON.stringify(out, null, 1)}\n`;
if (check) {
  let current = "";
  try { current = readFileSync(join(root, OUTPUT), "utf8"); } catch { /* missing */ }
  if (current !== text) { console.error(`DRIFT ${OUTPUT}`); process.exit(1); }
} else writeFileSync(join(root, OUTPUT), text);
console.log(`${check ? "checked" : "wrote"} ${OUTPUT}: ${entriesTotal} entries, ${changedPrimaries} changed primaries, ${rowsWithSecondaries} rows with ${links} secondary links`);
