#!/usr/bin/env node
// Proves the 0455 2026 addition is a pure insertion against the finalized 2019-2025 release in Git:
// every baseline row is byte-identical (same serialized text) and in the same order, every baseline
// private-index entry is unchanged, and the only header changes are the listed release-state fields.
// Usage: node scripts/verify-0455-2026-addition.mjs [--json]
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { BASELINE_2019_2025, LANE_2026 } from "./generate-igcse-economics-0455-runtime.mjs";

const sha = (b) => createHash("sha256").update(b).digest("hex");
const blob = (spec) => execFileSync("git", ["cat-file", "blob", spec], { maxBuffer: 64 * 1024 * 1024 });
const fail = (message) => { throw new Error(message); };

const baseBytes = blob(BASELINE_2019_2025.gitBlob);
if (sha(baseBytes) !== BASELINE_2019_2025.fileSha256) fail("baseline blob SHA256 mismatch");
const baseText = baseBytes.toString("utf8");
const nextText = readFileSync("src/data/production/igcse-economics-0455.json", "utf8");
const base = JSON.parse(baseText);
const next = JSON.parse(nextText);

// 1. Rows: same serialized bytes, same order, then exactly the pinned 2026 rows.
const baseRows = base.questions.map((q) => JSON.stringify(q));
const nextRows = next.questions.map((q) => JSON.stringify(q));
baseRows.forEach((row, i) => { if (nextRows[i] !== row) fail(`baseline row ${i} (${base.questions[i].id}) changed or moved`); });
const baseArray = baseText.slice(baseText.indexOf('"questions":[') + 12, baseText.indexOf('],"runtimeArtifact"') + 1);
if (!nextText.includes(baseArray.slice(0, -1) + ",")) fail("baseline question array is not a byte prefix of the new question array");
const added = next.questions.slice(base.questions.length);
const addedIds = added.map((q) => q.id).sort();
if (added.length !== LANE_2026.rows || sha(JSON.stringify(addedIds)) !== LANE_2026.idSeal || sha(addedIds.join("\n")) !== LANE_2026.idsSha256) fail("appended rows are not the pinned 2026 set");
if (added.some((q) => q.year !== 2026 || q.publicationStatus !== "authorized_production_candidate")) fail("appended rows are not pending 2026 candidates");
if (Object.keys(LANE_2026.excluded).some((id) => next.questions.some((q) => q.id === id))) fail("an officially removed 2026 question is served");

// 2. Header: everything except the listed release-state fields is unchanged.
const ALLOWED_TOP = new Set(["version", "releaseStatus", "years", "paperCount", "questionCount", "publicationStatus", "assetVerification", "knownCoverageGaps", "questions", "runtimeArtifact"]);
const ALLOWED_RA = new Set(["publicationStatus", "assetVerification", "storageReceiptSha256", "assetManifestSha256", "contentSha256", "originalCandidateRuntimeSha256", "sourceCandidateSha256", "runtimeSha256", "storageState", "combinedIdSeal", "finalizedContentSha256", "extension2026"]);
const changed = (a, b, allowed, scope) => {
  const out = [];
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (JSON.stringify(a[key]) === JSON.stringify(b[key])) continue;
    if (!allowed.has(key)) fail(`${scope}.${key} changed outside the allowed release-state fields`);
    out.push(key);
  }
  return out;
};
const topChanged = changed(base, next, ALLOWED_TOP, "header").filter((k) => k !== "questions" && k !== "runtimeArtifact");
const raChanged = changed(base.runtimeArtifact, next.runtimeArtifact, ALLOWED_RA, "runtimeArtifact");
if (JSON.stringify(Object.keys(base)) !== JSON.stringify(Object.keys(next))) fail("header key order changed");
const extension = next.runtimeArtifact.extension2026;
for (const [key, value] of Object.entries({ baselineRuntimeSha256: base.runtimeArtifact.runtimeSha256, baselineFinalizedContentSha256: base.runtimeArtifact.finalizedContentSha256, baselineAssetManifestSha256: base.runtimeArtifact.assetManifestSha256, baselineStorageReceiptSha256: base.runtimeArtifact.storageReceiptSha256, baselineCombinedIdSeal: base.runtimeArtifact.combinedIdSeal, baselineOriginalCandidateRuntimeSha256: base.runtimeArtifact.originalCandidateRuntimeSha256 })) {
  if (extension?.[key] !== value) fail(`extension2026.${key} does not record the baseline value`);
}

// 3. Private index: the baseline text is a prefix of the new text up to the last baseline entry.
const indexBaseText = blob(`${execFileSync("git", ["rev-parse", `${process.env.BASE_REF ?? "origin/main"}:src/data/private-index/igcse-economics-0455.json`]).toString().trim()}`).toString("utf8");
const indexNextText = readFileSync("src/data/private-index/igcse-economics-0455.json", "utf8");
const cut = indexBaseText.lastIndexOf("\n ]\n}");
if (cut < 0 || !indexNextText.startsWith(indexBaseText.slice(0, cut))) fail("private index is not a pure append");
const indexBase = JSON.parse(indexBaseText).questions;
const indexNext = JSON.parse(indexNextText).questions;
indexBase.forEach((entry, i) => { if (JSON.stringify(indexNext[i]) !== JSON.stringify(entry)) fail(`private index entry ${i} changed`); });

const result = {
  baselineRows: baseRows.length, unchangedInOrder: baseRows.length, addedRows: added.length, totalRows: nextRows.length,
  baselineContentSha256: sha(JSON.stringify(base.questions)), prefixContentSha256: sha(JSON.stringify(next.questions.slice(0, baseRows.length))),
  headerFieldsChanged: topChanged, runtimeArtifactFieldsChanged: raChanged,
  privateIndex: { baselineEntries: indexBase.length, unchanged: indexBase.length, added: indexNext.length - indexBase.length },
};
if (result.prefixContentSha256 !== BASELINE_2019_2025.finalizedContentSha256) fail("prefix content seal mismatch");
console.log(process.argv.includes("--json") ? JSON.stringify(result, null, 2) : `PASS ${JSON.stringify(result)}`);
