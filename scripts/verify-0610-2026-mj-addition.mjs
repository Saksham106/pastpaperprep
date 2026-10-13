#!/usr/bin/env node
// Proves the 0610 May/June 2026 addition is a pure insertion against the finalized 4,913-row release:
// every baseline row is byte-identical (same serialized text, same pretty-printed lines) and in the same
// order, every baseline private-index entry is unchanged, and the only header changes are the listed
// release-state fields. The baseline is main's finalized file (0a0b224) plus the committed
// material-secondaries reseal; pass --base-ref <git ref> to also compare with a committed file directly.
// Usage: node scripts/verify-0610-2026-mj-addition.mjs [--base-ref <ref>] [--json]
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { BASELINE_4913, LANE_2026_MJ, loadBaseline, serializeRuntime } from './generate-igcse-biology-0610-extension-candidate.mjs';
import { FROZEN_PATH, readBaselineIndex, resealPrivateIndex } from './reseal-biology-0610-secondaries.mjs';
import { committedCandidateText } from './igcse-2026-release-finalization.mjs';

const BANK = 'igcse-biology-0610';
const sha = (b) => createHash('sha256').update(b).digest('hex');
const fail = (message) => { throw new Error(`0610 May/June 2026 addition proof: ${message}`); };
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };

const base = await loadBaseline();
const baseText = serializeRuntime(base);
// After --finalize this is the exact reconstruction of the candidate (the finalized file is finalizeRelease(candidate)).
const nextText = await committedCandidateText(BANK);
const next = JSON.parse(nextText);
const baseRef = arg('--base-ref');
if (baseRef) {
  const committed = execFileSync('git', ['show', `${baseRef}:src/data/production/${BANK}.json`], { maxBuffer: 300_000_000 }).toString('utf8');
  if (committed !== baseText) fail(`${baseRef} is not the derived baseline`);
}

// 1. Rows: same serialized bytes, same order, then exactly the pinned 298 rows.
const baseRows = base.questions.map((q) => JSON.stringify(q));
const nextRows = next.questions.map((q) => JSON.stringify(q));
baseRows.forEach((row, i) => { if (nextRows[i] !== row) fail(`baseline row ${i} (${base.questions[i].id}) changed or moved`); });
const open = baseText.indexOf('\n  "questions": [\n') + 1;
const close = baseText.indexOf('\n  ],\n  "publicationStatus"', open);
const baseArray = baseText.slice(open, close);
if (open <= 0 || close < 0 || !nextText.includes(`${baseArray},\n`)) fail('baseline question array lines are not a byte prefix of the new question array');
const added = next.questions.slice(base.questions.length);
const addedIds = added.map((q) => q.id).sort();
if (added.length !== LANE_2026_MJ.rows || sha(addedIds.join('\n')) !== LANE_2026_MJ.idsSha256) fail('appended rows are not the pinned May/June 2026 set');
if (added.some((q) => q.year !== 2026 || q.session !== 'June' || q.courseEra !== '2026_2028' || q.publicationStatus !== 'authorized_production_candidate' || q.classificationReviewStatus !== 'candidate_not_approved')) fail('appended rows are not pending May/June 2026 candidates');
const baseRefs = new Set(base.questions.flatMap((q) => [...q.questionImages, ...q.markschemeImages]));
const addedRefs = new Set(added.flatMap((q) => [...q.questionImages, ...q.markschemeImages]));
if ([...addedRefs].some((ref) => baseRefs.has(ref)) || addedRefs.size !== LANE_2026_MJ.assets) fail('new asset references overlap the baseline or are not exactly 780');

// 2. Header: everything except the listed release-state fields is unchanged.
const ALLOWED_TOP = new Set(['version', 'releaseStatus', 'years', 'paperCount', 'questionCount', 'publicationStatus', 'assetVerification', 'questions', 'runtimeArtifact']);
const ALLOWED_RA = new Set(['publicationStatus', 'assetVerification', 'storageState', 'storageReceiptSha256', 'assetManifestSha256', 'finalizedContentSha256', 'contentSha256', 'sourceCandidateSha256', 'originalCandidateRuntimeSha256', 'runtimeSha256', 'extension2026MayJune']);
const changed = (a, b, allowed, scope) => {
  const out = [];
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (JSON.stringify(a[key]) === JSON.stringify(b[key])) continue;
    if (!allowed.has(key)) fail(`${scope}.${key} changed outside the allowed release-state fields`);
    out.push(key);
  }
  return out;
};
const topChanged = changed(base, next, ALLOWED_TOP, 'header').filter((k) => k !== 'questions' && k !== 'runtimeArtifact');
const raChanged = changed(base.runtimeArtifact, next.runtimeArtifact, ALLOWED_RA, 'runtimeArtifact');
if (JSON.stringify(Object.keys(base)) !== JSON.stringify(Object.keys(next))) fail('header key order changed');
const addition = next.runtimeArtifact.extension2026MayJune;
for (const [key, value] of Object.entries({ baselineRuntimeSha256: base.runtimeArtifact.runtimeSha256, baselineFinalizedContentSha256: base.runtimeArtifact.finalizedContentSha256, baselineAssetManifestSha256: base.runtimeArtifact.assetManifestSha256, baselineStorageReceiptSha256: base.runtimeArtifact.storageReceiptSha256, baselineOriginalCandidateRuntimeSha256: base.runtimeArtifact.originalCandidateRuntimeSha256, baselineSourceCandidateSha256: base.runtimeArtifact.sourceCandidateSha256 })) {
  if (addition?.[key] !== value) fail(`extension2026MayJune.${key} does not record the baseline value`);
}

// 3. Private index: every baseline entry unchanged and in order, then exactly the 298 new entries.
const indexBase = resealPrivateIndex(readBaselineIndex(), JSON.parse(readFileSync(FROZEN_PATH, 'utf8')));
const indexBaseText = JSON.stringify(indexBase);
const indexNextText = readFileSync(`src/data/private-index/${BANK}.json`, 'utf8');
if (!indexNextText.startsWith(`${indexBaseText.slice(0, -2)},`)) fail('private index is not a pure append');
const indexNext = JSON.parse(indexNextText).questions;
indexBase.questions.forEach((entry, i) => { if (JSON.stringify(indexNext[i]) !== JSON.stringify(entry)) fail(`private index entry ${i} changed`); });
if (indexNext.length !== indexBase.questions.length + LANE_2026_MJ.rows) fail('private index count');

const result = {
  baselineRows: baseRows.length, unchangedInOrder: baseRows.length, addedRows: added.length, totalRows: nextRows.length,
  baselineContentSha256: sha(JSON.stringify(base.questions)), prefixContentSha256: sha(JSON.stringify(next.questions.slice(0, baseRows.length))),
  addedAssetReferences: addedRefs.size, headerFieldsChanged: topChanged, runtimeArtifactFieldsChanged: raChanged,
  privateIndex: { baselineEntries: indexBase.questions.length, unchanged: indexBase.questions.length, added: indexNext.length - indexBase.questions.length },
  ...(baseRef ? { comparedWithGit: baseRef } : {}),
};
if (result.prefixContentSha256 !== BASELINE_4913.finalizedContentSha256) fail('prefix content seal mismatch');
console.log(process.argv.includes('--json') ? JSON.stringify(result, null, 2) : `PASS ${JSON.stringify(result)}`);
