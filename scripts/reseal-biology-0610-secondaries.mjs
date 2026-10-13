#!/usr/bin/env node
/**
 * Metadata-only reseal: map the material secondaries of the finalized 2019/2020/Feb-March-2026
 * extension rows (the importer used to hard-code them empty). Only secondaryTopics,
 * secondaryTopicIds, subtopics, detailedSubtopics and secondarySubtopics change, on exactly the
 * frozen rows; assets, keys, the storage manifest and the verified receipt are untouched.
 *
 *   --freeze  (needs PASTPAPERPREP_IGCSE_BIOLOGY_SOURCE_ROOT) rebuilds scripts/data/0610-extension-material-secondaries.json
 *   --write   applies the frozen cohort to the pinned finalized baseline and writes the runtime and private index
 *   --check   proves the committed files are that output (the frozen cohort is re-derived too when the source is present)
 */
import { execFileSync } from 'node:child_process';
import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXTENSION_ASSEMBLY, EXTENSION_ASSEMBLY_SHA256, TAXONOMY_V2_PATH, canonicalSha256, defaultSourceRoot,
  loadExtensionAssembly, mapMaterialSecondaries, runtimeSha256, sha256, taxonomyIndex,
} from './generate-igcse-biology-0610-extension-candidate.mjs';

const BANK = 'igcse-biology-0610';
const root = path.resolve(import.meta.dirname, '..');
export const FROZEN_PATH = 'scripts/data/0610-extension-material-secondaries.json';
/** The finalized, Pollution-resealed 4,913-row runtime on main (#123). */
export const BASELINE = {
  gitCommit: '0a0b2246e269c03f81669548947d011c4f68b741',
  runtimeSha256: 'f20c50d65c9ef68e22a3b52a64f3cbfb7092dad23da5373feb2bb511e589ef2f',
  finalizedContentSha256: 'ea6aa0830e97ec40614bb14c35cf2c8f18c151f8f2be1d74326967b0a7146694',
  assetManifestSha256: '4984902a3db4fc7e0599d1c646aabcfb023d958370d529861283c5d37189e3d9',
  manifestFileSha256: '3bbccab9604d600e6dd2ad2db4c29cba8239a86263a9b5546ea7a1ce6689ca14',
  storageReceiptSha256: '2def116660b15df52777805496d024d4799826da0cdee59eabddadab29e622a2',
};
export const FROZEN_COHORT_SHA256 = '540fecab8367de297c649151521fde1f9d18c6272ed29286a53ba28f81c076f6';
export const TARGET_COUNT = 200;
export const CHANGED_FIELDS = ['secondaryTopics', 'secondaryTopicIds', 'subtopics', 'detailedSubtopics', 'secondarySubtopics'];
export const METHOD = 'source assembly classification.final.material_secondaries mapped as the official-rebuild path maps 2021-2025 secondaries: taxonomy v2 by era and normalized subtopic id (2026_2028 via 2023_2025), parent topic titles, ids and subtopic titles, deduplicated, primary excluded; metadata only, no asset or key change';
const assert = (condition, message) => { if (!condition) throw new Error(`0610 secondaries reseal: ${message}`); };

/** Derive the frozen cohort from the pinned source assembly and check every target against the finalized baseline. */
export function freeze({ assembly, taxonomy, taxonomyText, baseline }) {
  const index = taxonomyIndex(taxonomy);
  const byId = new Map(baseline.questions.map((q) => [q.id, q]));
  const rows = [];
  for (const row of assembly.questions) {
    const mapped = mapMaterialSecondaries(row, index);
    if (!mapped.secondaryTopicIds.length) continue;
    const primary = row.classification.final.primary;
    const live = byId.get(row.question_id);
    assert(live?.classificationProvenance?.selectedSource === 'extension-2019-2020-2026' && live.classificationProvenance.labelKey === primary.label_key, `target is not the pinned extension row: ${row.question_id}`);
    assert(live.primaryTopicId === primary.topic_id && JSON.stringify(live.subtopics) === JSON.stringify([primary.official_subtopic]), `target primary drifted: ${row.question_id}`);
    rows.push({
      id: row.question_id,
      era: primary.era,
      primaryTopicId: primary.topic_id,
      primarySubtopic: primary.official_subtopic,
      materialSecondaryLabelKeys: row.classification.final.material_secondaries.map((secondary) => secondary.label_key),
      ...mapped,
      subtopics: [...new Set([primary.official_subtopic, ...mapped.secondarySubtopics])],
    });
  }
  rows.sort((a, b) => a.id.localeCompare(b.id));
  const ids = rows.map((row) => row.id);
  return {
    schema: 'igcse-biology-0610.extension-material-secondaries.v1',
    sourceRepository: 'igcse-biology-0610-topic-practice',
    sourceAssemblyPath: EXTENSION_ASSEMBLY,
    sourceAssemblySha256: EXTENSION_ASSEMBLY_SHA256,
    taxonomyPath: TAXONOMY_V2_PATH,
    taxonomySha256: sha256(taxonomyText),
    baselineGitCommit: BASELINE.gitCommit,
    baselineRuntimeSha256: BASELINE.runtimeSha256,
    targetIdsSha256: sha256(ids.join('\n')),
    method: METHOD,
    rows,
  };
}

function withSecondaries(question, target) {
  const out = {};
  for (const [key, value] of Object.entries(question)) {
    if (key === 'secondaryTopics') {
      out.secondaryTopics = [...target.secondaryTopics];
      out.secondaryTopicIds = [...target.secondaryTopicIds];
    } else if (key === 'subtopics' || key === 'detailedSubtopics') out[key] = [...target.subtopics];
    else if (key === 'secondarySubtopics') out[key] = [...target.secondarySubtopics];
    else out[key] = value;
  }
  return out;
}

export function reseal({ baseline, frozen, manifestText, receiptText }) {
  assert(runtimeSha256(baseline) === BASELINE.runtimeSha256 && baseline.runtimeArtifact?.runtimeSha256 === BASELINE.runtimeSha256, 'baseline seal mismatch');
  assert(canonicalSha256(baseline.questions) === BASELINE.finalizedContentSha256 && baseline.runtimeArtifact.finalizedContentSha256 === BASELINE.finalizedContentSha256, 'baseline finalized content mismatch');
  assert(baseline.runtimeArtifact.taxonomyRepair?.targetId === '0610-2022-w-43-q5', 'prior Pollution repair missing');
  assert(baseline.releaseStatus === 'production' && baseline.runtimeArtifact.assetVerification === 'verified_readback', 'baseline is not finalized');
  assert(baseline.questions.length === 4913 && baseline.questionCount === 4913, 'baseline count mismatch');
  assert(sha256(manifestText) === BASELINE.manifestFileSha256 && sha256(receiptText) === BASELINE.storageReceiptSha256, 'immutable manifest/receipt bytes changed');
  assert(canonicalSha256(JSON.parse(manifestText)) === BASELINE.assetManifestSha256, 'manifest canonical seal mismatch');
  assert(baseline.runtimeArtifact.assetManifestSha256 === BASELINE.assetManifestSha256 && baseline.runtimeArtifact.storageReceiptSha256 === BASELINE.storageReceiptSha256, 'baseline asset seal mismatch');
  assert(canonicalSha256(frozen) === FROZEN_COHORT_SHA256, 'frozen cohort changed');
  assert(frozen.rows.length === TARGET_COUNT && new Set(frozen.rows.map((row) => row.id)).size === TARGET_COUNT, 'target count/uniqueness mismatch');
  assert(sha256(frozen.rows.map((row) => row.id).sort().join('\n')) === frozen.targetIdsSha256, 'target ID seal mismatch');
  const targets = new Map(frozen.rows.map((row) => [row.id, row]));
  const output = structuredClone(baseline);
  let changed = 0;
  output.questions = output.questions.map((q) => {
    const target = targets.get(q.id);
    if (!target) return q;
    assert(q.classificationProvenance?.selectedSource === 'extension-2019-2020-2026' && q.classificationProvenance.sourceRowId === q.id, `not an extension row: ${q.id}`);
    assert(q.publicationStatus === 'production' && q.classificationReviewStatus === 'classified', `not finalized: ${q.id}`);
    assert(q.courseEra === target.era && q.primaryTopicId === target.primaryTopicId, `primary drifted: ${q.id}`);
    assert(!('secondaryTopicIds' in q) && q.secondaryTopics.length === 0 && q.secondarySubtopics.length === 0, `already has secondaries: ${q.id}`);
    assert(JSON.stringify(q.subtopics) === JSON.stringify([target.primarySubtopic]) && JSON.stringify(q.detailedSubtopics) === JSON.stringify([target.primarySubtopic]), `subtopics drifted: ${q.id}`);
    assert(target.secondaryTopicIds.length > 0 && !target.secondaryTopicIds.includes(q.primaryTopicId), `invalid secondaries: ${q.id}`);
    changed++;
    return withSecondaries(q, target);
  });
  assert(changed === TARGET_COUNT, 'runtime target coverage mismatch');
  const ra = output.runtimeArtifact;
  ra.secondaryTopicsRepair = {
    baselineGitCommit: BASELINE.gitCommit,
    baselineRuntimeSha256: BASELINE.runtimeSha256,
    baselineFinalizedContentSha256: BASELINE.finalizedContentSha256,
    sourceAssemblySha256: frozen.sourceAssemblySha256,
    taxonomySha256: frozen.taxonomySha256,
    frozenCohortSha256: FROZEN_COHORT_SHA256,
    targetIdsSha256: frozen.targetIdsSha256,
    changedCount: changed,
    secondaryLabelCount: frozen.rows.reduce((total, row) => total + row.secondaryTopicIds.length, 0),
    changedFields: CHANGED_FIELDS,
    method: METHOD,
  };
  ra.finalizedContentSha256 = canonicalSha256(output.questions);
  ra.runtimeSha256 = null;
  ra.runtimeSha256 = runtimeSha256(output);
  const untouched = output.questions.filter((q) => !targets.has(q.id));
  const before = baseline.questions.filter((q) => !targets.has(q.id));
  assert(untouched.length === before.length && untouched.every((q, i) => JSON.stringify(q) === JSON.stringify(before[i])), 'unrelated row mutation');
  return output;
}

/** The private index changes only secondaryTopics and subtopics of the same rows. */
export function resealPrivateIndex(index, frozen) {
  const targets = new Map(frozen.rows.map((row) => [row.id, row]));
  const out = structuredClone(index);
  let changed = 0;
  for (const q of out.questions) {
    const target = targets.get(q.id);
    if (!target) continue;
    assert(q.secondaryTopics.length === 0 && JSON.stringify(q.subtopics) === JSON.stringify([target.primarySubtopic]), `index row drifted: ${q.id}`);
    q.secondaryTopics = [...target.secondaryTopics];
    q.subtopics = [...target.subtopics];
    changed++;
  }
  assert(out.questions.length === 4913 && changed === TARGET_COUNT, 'index coverage mismatch');
  return out;
}

const git = (file) => execFileSync('git', ['show', `${BASELINE.gitCommit}:${file}`], { cwd: root, encoding: 'utf8', maxBuffer: 200_000_000 });
export const readBaseline = () => JSON.parse(git(`src/data/production/${BANK}.json`));
export const readBaselineIndex = () => JSON.parse(git(`src/data/private-index/${BANK}.json`));
/** The verified manifest/receipt pair of the 4,913-row release, as committed on main at the baseline. */
export const readBaselineStorage = () => ({ manifestText: git(`data/storage/${BANK}.manifest.json`), receiptText: git(`data/storage/${BANK}.receipt.json`) });
export const serializeRuntime = (runtime) => `${JSON.stringify(runtime, null, 2)}\n`;
export const serializeIndex = (index) => `${JSON.stringify(index)}\n`;
export const serializeFrozen = (frozen) => `${JSON.stringify(frozen, null, 1)}\n`;

async function freezeFromSource(baseline) {
  const { assembly } = await loadExtensionAssembly(defaultSourceRoot());
  const taxonomyText = await readFile(path.join(root, TAXONOMY_V2_PATH), 'utf8');
  return freeze({ assembly, taxonomy: JSON.parse(taxonomyText), taxonomyText, baseline });
}

async function main() {
  const mode = process.argv[2];
  assert(['--freeze', '--write', '--check'].includes(mode), 'usage: --freeze | --write | --check');
  const baseline = readBaseline();
  const frozenFile = path.join(root, FROZEN_PATH);
  if (mode === '--freeze') {
    const frozen = await freezeFromSource(baseline);
    await writeFile(frozenFile, serializeFrozen(frozen));
    console.log(JSON.stringify({ rows: frozen.rows.length, frozenCohortSha256: canonicalSha256(frozen), targetIdsSha256: frozen.targetIdsSha256 }));
    return;
  }
  const frozenText = await readFile(frozenFile, 'utf8');
  const frozen = JSON.parse(frozenText);
  const { manifestText, receiptText } = readBaselineStorage();
  const runtime = reseal({ baseline, frozen, manifestText, receiptText });
  const index = resealPrivateIndex(readBaselineIndex(), frozen);
  const outputs = [[`src/data/production/${BANK}.json`, serializeRuntime(runtime)], [`src/data/private-index/${BANK}.json`, serializeIndex(index)]];
  // Once the May/June 2026 rows are appended, this reseal is the addition's baseline: the committed
  // files then hold it as their exact 4,913-row prefix, and rewriting them here would drop the addition.
  const committed = JSON.parse(await readFile(path.join(root, outputs[0][0]), 'utf8'));
  const addition = committed.runtimeArtifact?.extension2026MayJune;
  if (mode === '--check') {
    let sourceChecked = false;
    try { await access(path.join(defaultSourceRoot(), EXTENSION_ASSEMBLY)); sourceChecked = true; } catch { /* source workspace absent (CI) */ }
    if (sourceChecked) assert(serializeFrozen(await freezeFromSource(baseline)) === frozenText, 'frozen cohort no longer re-derives from the pinned source assembly');
    if (addition) {
      const committedIndex = JSON.parse(await readFile(path.join(root, outputs[1][0]), 'utf8'));
      assert(addition.baselineRuntimeSha256 === runtime.runtimeArtifact.runtimeSha256 && addition.baselineFinalizedContentSha256 === runtime.runtimeArtifact.finalizedContentSha256, 'the addition does not record this reseal as its baseline');
      assert(JSON.stringify(committed.questions.slice(0, 4913)) === JSON.stringify(runtime.questions), 'committed runtime does not keep the resealed rows as its prefix');
      assert(JSON.stringify(committedIndex.questions.slice(0, 4913)) === JSON.stringify(index.questions), 'committed private index does not keep the resealed entries as its prefix');
      console.log(JSON.stringify({ status: 'PASS', sourceChecked, changed: TARGET_COUNT, checked: 'prefix of the May/June 2026 candidate', runtimeSha256: runtime.runtimeArtifact.runtimeSha256, finalizedContentSha256: runtime.runtimeArtifact.finalizedContentSha256 }));
      return;
    }
    for (const [file, text] of outputs) assert(await readFile(path.join(root, file), 'utf8') === text, `${file} is not the resealed output`);
    console.log(JSON.stringify({ status: 'PASS', sourceChecked, changed: TARGET_COUNT, runtimeSha256: runtime.runtimeArtifact.runtimeSha256, finalizedContentSha256: runtime.runtimeArtifact.finalizedContentSha256 }));
    return;
  }
  assert(!addition, 'the committed runtime already carries the May/June 2026 addition; regenerate it with generate-igcse-biology-0610-extension-candidate.mjs instead');
  for (const [file, text] of outputs) await writeFile(path.join(root, file), text);
  console.log(JSON.stringify({ changed: TARGET_COUNT, runtimeSha256: runtime.runtimeArtifact.runtimeSha256, finalizedContentSha256: runtime.runtimeArtifact.finalizedContentSha256, assetManifestSha256: runtime.runtimeArtifact.assetManifestSha256, storageReceiptSha256: runtime.runtimeArtifact.storageReceiptSha256 }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
