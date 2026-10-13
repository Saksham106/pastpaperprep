#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { project0610Sections } from '../src/lib/igcse-0610-official.mjs';

const BANK = 'igcse-biology-0610';
const repo = resolve(import.meta.dirname, '..');
export const defaultSourceRoot = () => resolve(process.env.PASTPAPERPREP_IGCSE_BIOLOGY_SOURCE_ROOT ?? '/Users/sakshamgoel/Documents/ProjectsInternships/igcse-biology-0610-topic-practice');
export const EXTENSION_ASSEMBLY = 'data/classification/extension-2019-2020-2026/assembly/release/assembly.json';
export const EXTENSION_RECEIPT = 'data/classification/extension-2019-2020-2026/assembly/release/reconciliation-receipt.json';
export const EXTENSION_ASSEMBLY_SHA256 = '92132de006cb98dcd7f7feef193be05d6cf0233addcaa41b045f6b7771490de1';
export const EXTENSION_RECEIPT_SHA256 = 'c708d4b0116b3559fd550481a355d0964a722f7027962dfc6297eea1408bcbbd';
/** The taxonomy the official-rebuild path (2021-2025 rows) resolves primaries and secondaries against. */
export const TAXONOMY_V2_PATH = 'src/data/classification/igcse-biology-0610-official-taxonomy-v2.json';
/** The commit before the original extension candidate (5955ad2): its runtime/manifest are the historical base. */
const HISTORICAL_BASE_REF = '5955ad2^';
const HISTORICAL_CANDIDATE_SHA256 = '9e97cd0c0455ae865b1d14dc462f74ce22d1c66fb734e7d4a8baaf414e0ff961';

export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
export const canonicalSha256 = (value) => sha256(JSON.stringify(value));
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const readGitJson = (ref, path) => JSON.parse(execFileSync('git', ['show', `${ref}:${path}`], { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));

export function topicMap(taxonomy) {
  const result = new Map();
  for (const era of taxonomy.eras ?? []) for (const topic of era.topics ?? []) {
    for (const subtopic of topic.subtopics ?? []) {
      result.set(`${era.era}|${subtopic.normalized_subtopic_id}`, topic.title);
      result.set(`any|${subtopic.normalized_subtopic_id}`, topic.title);
    }
  }
  return result;
}

/** era -> normalized subtopic id -> { topic, subtopic }, exactly as the official-rebuild path indexes taxonomy v2. */
export function taxonomyIndex(taxonomy) {
  const byEra = new Map();
  for (const era of taxonomy.eras) {
    const index = new Map();
    for (const topic of era.topics) for (const subtopic of topic.subtopics) index.set(subtopic.normalized_subtopic_id, { topic, subtopic });
    byEra.set(era.era, index);
  }
  return byEra;
}

/**
 * The 2026-28 syllabus keeps the 61 numbered 2023-25 addresses (src/lib/igcse-0610-official.mjs routes
 * 2026_2028 through the 2023_2025 registry the same way); the bank taxonomy has no separate 2026 era.
 */
export const registryEra = (era) => (era === '2026_2028' ? '2023_2025' : era);

/**
 * Material secondaries (`classification.final.material_secondaries`) mapped the way the official-rebuild
 * path maps reviewed secondaries for 2021-2025 rows: taxonomy lookup by era and normalized subtopic id,
 * parent-topic titles in `secondaryTopics`, ids in `secondaryTopicIds`, subtopic titles in
 * `secondarySubtopics`. Duplicates (the same subtopic on several printed parts) collapse to the first;
 * a secondary equal to the primary subtopic is excluded.
 */
export function mapMaterialSecondaries(row, index) {
  const final = row.classification?.final;
  const primary = final?.primary;
  const list = final?.material_secondaries ?? [];
  if (!primary || !Array.isArray(list)) throw new Error(`Malformed classification: ${row.question_id}`);
  const metas = [];
  const ids = [];
  for (const secondary of list) {
    if (secondary.era !== primary.era) throw new Error(`Secondary era differs from the primary era: ${row.question_id}`);
    if (secondary.label_key !== `${secondary.era}|${secondary.topic_id}|${secondary.official_subtopic}|${secondary.tier}`) throw new Error(`Secondary label key drift: ${row.question_id}`);
    if (secondary.topic_id === primary.topic_id || ids.includes(secondary.topic_id)) continue;
    const meta = index.get(registryEra(secondary.era))?.get(secondary.topic_id);
    if (!meta) throw new Error(`Secondary label is not in its routed era: ${row.question_id} ${secondary.label_key}`);
    if (meta.subtopic.id !== secondary.official_subtopic) throw new Error(`Secondary section address mismatch: ${row.question_id} ${secondary.label_key}`);
    metas.push(meta);
    ids.push(secondary.topic_id);
  }
  return {
    secondaryTopics: [...new Set(metas.map((entry) => entry.topic.title))],
    secondaryTopicIds: ids,
    secondarySubtopics: [...new Set(metas.map((entry) => entry.subtopic.title))],
  };
}

function sessionName(code) {
  return ({ m: 'March', s: 'June', w: 'November', f: 'February' })[code] ?? code;
}

/**
 * One extension assembly row as a runtime question. `secondaryIndex` (taxonomy v2, see taxonomyIndex)
 * maps material secondaries; without it the row is the original 2019/2020/Feb-March-2026 candidate
 * shape (no secondaries), which the historical candidate seal was computed over.
 */
export function extensionRuntimeQuestion(row, topics, { secondaryIndex = null, selectedSource = 'extension-2019-2020-2026' } = {}) {
  const source = row.source;
  const classification = row.classification;
  const primary = classification.final.primary;
  const [, year, sessionCode, component, qPart] = row.question_id.split('-');
  const questionImages = source.images.map((image) => `questions/${row.paper_id}/${image.path.split('/').at(-1)}`);
  const markschemeImages = source.mark_scheme_images.map((image) => `markschemes/${row.paper_id}/${image.path.split('/').at(-1)}`);
  const marks = Number(row.marks);
  if (!Number.isInteger(marks) || marks <= 0) throw new Error(`Invalid extension marks: ${row.question_id}`);
  const topic = topics.get(`${primary.era}|${primary.topic_id}`) ?? topics.get(`any|${primary.topic_id}`);
  if (!topic) throw new Error(`Missing taxonomy topic for ${row.question_id}`);
  const subtopic = primary.official_subtopic;
  const secondaries = secondaryIndex ? mapMaterialSecondaries(row, secondaryIndex) : null;
  const subtopics = [...new Set([subtopic, ...(secondaries?.secondarySubtopics ?? [])])];
  return {
    id: row.question_id,
    canonicalId: row.question_id,
    bankSlug: BANK,
    number: Number(qPart.replace(/^q/, '')),
    paper: Number(component[0]),
    year: Number(year),
    session: sessionName(sessionCode),
    zone: `Variant ${component.at(-1)}`,
    component,
    courseEra: primary.era,
    subject: 'Biology 0610',
    course: 'Cambridge IGCSE Biology 0610',
    primaryTopic: topic,
    primaryTopicId: primary.topic_id,
    secondaryTopics: secondaries?.secondaryTopics ?? [],
    ...(secondaries ? { secondaryTopicIds: secondaries.secondaryTopicIds } : {}),
    subtopics,
    detailedSubtopics: [...subtopics],
    secondarySubtopics: secondaries?.secondarySubtopics ?? [],
    skills: primary.skills ?? [],
    assessmentObjectives: [],
    marks,
    maxMarks: marks,
    summary: source.text.slice(0, 300),
    accessibleText: source.text,
    questionImages,
    markschemeImages,
    officialMarkscheme: { images: markschemeImages },
    sourceQuestionUrl: null,
    sourceMarkSchemeUrl: null,
    sourceType: 'actual_past_paper',
    sourceId: row.question_id,
    publicationStatus: 'authorized_production_candidate',
    classificationReviewStatus: 'candidate_not_approved',
    classificationProvenance: {
      selectedSource,
      sourceRowId: row.question_id,
      taxonomyPath: 'src/data/igcse-biology-0610-official-taxonomy.json',
      labelKey: primary.label_key,
      evidenceBindings: classification.evidence_bindings,
    },
    marks_ready: true,
    rightsStatus: 'user_attested_non_blocking_for_named_corpus',
    answer: source.answer,
    answerProvenance: {
      status: source.answer ? 'official' : 'not_applicable_structured',
      questionId: row.question_id,
      qpId: source.qp_id,
      msId: source.ms_id,
      assetPaths: markschemeImages,
    },
    printedParts: [primary.printed_part],
    assetStorage: 'private_r2_pending_upload',
  };
}

export function runtimeSha256(runtime) {
  const copy = JSON.parse(JSON.stringify(runtime));
  copy.runtimeArtifact.runtimeSha256 = null;
  return canonicalSha256(copy);
}

export function createPrivateIndex(questions) {
  return { version: 1, bank: BANK, questions: questions.map((q) => ({ id: q.id, number: q.number, paper: q.paper, year: q.year, session: q.session, primaryTopic: q.primaryTopic, secondaryTopics: q.secondaryTopics, skills: q.skills, subtopics: q.subtopics, subject: q.subject, option: null, zone: q.zone, component: q.component, calculator: null, marks: q.marks })) };
}

/** Load and pin the 2019/2020/Feb-March-2026 extension assembly and its reconciliation receipt. */
export async function loadExtensionAssembly(sourceRoot = defaultSourceRoot()) {
  const [assemblyBytes, receiptBytes] = await Promise.all([readFile(resolve(sourceRoot, EXTENSION_ASSEMBLY)), readFile(resolve(sourceRoot, EXTENSION_RECEIPT))]);
  if (sha256(assemblyBytes) !== EXTENSION_ASSEMBLY_SHA256) throw new Error('Extension assembly hash mismatch');
  if (sha256(receiptBytes) !== EXTENSION_RECEIPT_SHA256) throw new Error('Extension reconciliation receipt hash mismatch');
  const assembly = JSON.parse(assemblyBytes);
  const receipt = JSON.parse(receiptBytes);
  if (assembly.question_count !== 1472 || assembly.paper_count !== 89 || assembly.questions.length !== 1472) throw new Error('Unexpected extension counts');
  if (receipt.counts.asset_count !== 5099 || receipt.counts.mcq_marks !== 1200 || receipt.counts.structured_overlays !== 272) throw new Error('Unexpected extension receipt counts');
  return { assembly, receipt };
}

/**
 * Historical builder: reproduces the original 4,913-row combined candidate (original candidate runtime
 * 9e97cd0c…) from the 3,441-row base at 5955ad2^ and the pinned extension assembly. That candidate was
 * finalized and then repaired in place (Pollution #123, material secondaries), so it is not the live
 * runtime; later additions start from the finalized live file. Kept so the historical seal stays
 * reproducible (`--check-historical`); it writes nothing.
 */
export async function buildHistoricalCandidate({ sourceRoot = defaultSourceRoot() } = {}) {
  const base = readGitJson(HISTORICAL_BASE_REF, 'src/data/production/igcse-biology-0610.json');
  const baseManifest = readGitJson(HISTORICAL_BASE_REF, 'data/storage/igcse-biology-0610.manifest.json');
  const { assembly, receipt } = await loadExtensionAssembly(sourceRoot);
  const taxonomy = await readJson(resolve(repo, 'src/data/igcse-biology-0610-official-taxonomy.json'));
  const topics = topicMap(taxonomy);
  const extensionQuestions = assembly.questions.map((row) => extensionRuntimeQuestion(row, topics));
  const ids = new Set(base.questions.map((q) => q.id));
  for (const q of extensionQuestions) { if (ids.has(q.id)) throw new Error(`Duplicate question id: ${q.id}`); ids.add(q.id); }
  const questions = [...base.questions, ...extensionQuestions];
  const years = [...new Set(questions.map((q) => q.year))].sort((a, b) => a - b);
  const papers = new Set(questions.map((q) => `${q.year}-${q.session}-${q.component}`));
  const sourceCandidateSha256 = sha256(`${base.runtimeArtifact.sourceCandidateSha256}:${EXTENSION_ASSEMBLY_SHA256}:${EXTENSION_RECEIPT_SHA256}`);
  const runtime = {
    ...base,
    version: 'igcse-biology-0610-combined4913-v1',
    releaseStatus: 'production_candidate',
    publicationStatus: 'authorized_production_candidate',
    assetVerification: 'pending_upload',
    years: `${years[0]}-${years.at(-1)}`,
    paperCount: papers.size,
    questionCount: questions.length,
    marks_ready: true,
    questions,
    runtimeArtifact: {
      ...base.runtimeArtifact,
      publicationStatus: 'authorized_production_candidate',
      assetVerification: 'pending_upload',
      storageReceiptSha256: null,
      assetManifestSha256: null,
      sourceCandidateSha256,
      sourceManifestSha256: null,
      sourceAssemblySha256: EXTENSION_ASSEMBLY_SHA256,
      sourceReconciliationReceiptSha256: EXTENSION_RECEIPT_SHA256,
      extensionQuestionCount: 1472,
      extensionPaperCount: 89,
      extensionAssetCount: 5099,
      extensionMcqMarks: 1200,
      extensionStructuredMarks: 272,
      paperException: receipt.paper_exception,
      originalCandidateRuntimeSha256: null,
      runtimeSha256: null,
    },
  };
  const candidateSeal = runtimeSha256(runtime);
  runtime.runtimeArtifact.originalCandidateRuntimeSha256 = candidateSeal;
  const prefix = `${BANK}/releases/combined4913-v1-${candidateSeal.slice(0, 12)}`;
  const manifestAssets = new Map();
  const addAsset = async (reference, sourcePath, expectedSha) => {
    const bytes = await readFile(sourcePath); const info = await stat(sourcePath);
    const actual = sha256(bytes);
    if (actual !== expectedSha) throw new Error(`Asset hash mismatch: ${reference}`);
    const old = manifestAssets.get(reference);
    if (old && old.sha256 !== actual) throw new Error(`Asset collision: ${reference}`);
    manifestAssets.set(reference, { objectKey: `${prefix}/${reference}`, sourcePath, sha256: actual, size: info.size, contentType: 'image/webp' });
  };
  for (const asset of baseManifest.assets) await addAsset(asset.objectKey.split('/').slice(3).join('/'), asset.sourcePath, asset.sha256);
  for (const row of assembly.questions) {
    for (const image of row.source.images) await addAsset(`questions/${row.paper_id}/${image.path.split('/').at(-1)}`, resolve(sourceRoot, 'data/segmentation/full-extension', image.path), image.sha256);
    for (const image of row.source.mark_scheme_images) await addAsset(`markschemes/${row.paper_id}/${image.path.split('/').at(-1)}`, resolve(sourceRoot, 'data/segmentation/full-extension', image.path), image.sha256);
  }
  if (manifestAssets.size !== 13953) throw new Error(`Combined asset count ${manifestAssets.size} != 13953`);
  return { runtime, candidateSeal, prefix, assetCount: manifestAssets.size, sourceCandidateSha256 };
}

// ---------------------------------------------------------------------------------------------
// May/June 2026 addition: 18 papers / 298 rows appended to the finalized 4,913-row release.
// ---------------------------------------------------------------------------------------------

/** The finalized 4,913-row release after the material-secondaries reseal (the addition's baseline). */
export const BASELINE_4913 = {
  mainGitCommit: '0a0b2246e269c03f81669548947d011c4f68b741',
  derivation: 'git show 0a0b224:src/data/production/igcse-biology-0610.json, then scripts/reseal-biology-0610-secondaries.mjs (frozen cohort 540fecab)',
  runtimeSha256: 'b93df7a1feb6a65677ee8a7ff94b2b13f339ee626a2aaaa84e49de7321605d49',
  originalCandidateRuntimeSha256: HISTORICAL_CANDIDATE_SHA256,
  sourceCandidateSha256: 'ae8d6aef098c380bcb3d221e152474d2ef10d666d61c472ee42b6d4077cd4e25',
  finalizedContentSha256: 'b72e02463e6648f232996bbaa4846aa5560124476797a94239ae45e592bf7910',
  assetManifestSha256: '4984902a3db4fc7e0599d1c646aabcfb023d958370d529861283c5d37189e3d9',
  storageReceiptSha256: '2def116660b15df52777805496d024d4799826da0cdee59eabddadab29e622a2',
  questionCount: 4913,
  paperCount: 298,
  assetCount: 13953,
  /** sha256(sorted ids joined by "\n"): 2021-2025 rebuild rows and the 2019/2020/Feb-March-2026 extension. */
  baseIdsSha256: 'ac7402d11f008ca2e76d44eaa67aba85a79039d07f88214b1bbe020f2377543f',
  extensionIdsSha256: '310bf7a7f3f0d36b82acacc709e511eda0d52864c57420cc0027c924384f74dc',
};
export const LANE_2026_MJ = {
  assembly: 'data/classification/extension-2026-mj/assembly/release/assembly.json',
  assemblySha256: '4ef5a5fe6669e8d4cd27fd20dcb8b5ab54c350740205e0d9bbfe6b7313187944',
  receipt: 'data/classification/extension-2026-mj/assembly/release/reconciliation-receipt.json',
  receiptSha256: '98b3cda42383dc4833be36fd56d35bde4636dfd66d25955dfc1aed1d56d6159d',
  segmentationLane: 'data/segmentation/full-extension-2026-mj',
  sourceBranch: 'feat/2026-may-june-acquisition',
  sourceCommitAtBuild: 'a80ad4b36be4b4c8889b587d0332e52cce68b0cc',
  selectedSource: 'extension-2026-mj',
  era: '2026_2028',
  rows: 298,
  papers: 18,
  mcq: 240,
  structured: 58,
  assets: 780,
  materialSecondaryRows: 36,
  /** sha256(sorted ids joined by "\n"): the release-script cohort formula. */
  idsSha256: 'eb34baa109216fa30293c71262fa2fa05420908aeaf610f3d7215902b4048a99',
  /** The whole non-2021-2025 extension after this addition (1,472 finalized + 298 candidates). */
  extensionThroughMayJuneIdsSha256: 'f257b8f0e664914344fca4f1f5dbcc405ec3c0bfcea7c4ac03a789540286bb41',
  /** QP wins over the MS's withdrawn 5(a) [3], as for 0610-2019-s-31 (owner-approved). */
  paperException: { paper_id: '0610-2026-s-43', question_id: '0610-2026-s-43-q5', qp_authoritative: true, qp_printed_total: 15, ms_marks_column_sum: 12, withdrawn_part: '5(a)', paired_ms_header_max: 80 },
};
export const EXPECTED_2026_MJ = { rows: 5211, papers: 316, assets: 14733, years: '2019-2026' };
export const idsSha256 = (ids) => sha256([...ids].sort().join('\n'));
const paperKey = (q) => `${q.year}-${q.session}-${q.component}`;
const refsOf = (q) => [...q.questionImages, ...q.markschemeImages];

/** Rebuild the addition's baseline from main's finalized file plus the committed reseal, and prove its seals. */
export async function loadBaseline() {
  const { reseal, readBaseline, FROZEN_PATH } = await import('./reseal-biology-0610-secondaries.mjs');
  const [frozenText, manifestText, receiptText] = await Promise.all([
    readFile(resolve(repo, FROZEN_PATH), 'utf8'),
    readFile(resolve(repo, `data/storage/${BANK}.manifest.json`), 'utf8'),
    readFile(resolve(repo, `data/storage/${BANK}.receipt.json`), 'utf8'),
  ]);
  const baseline = reseal({ baseline: readBaseline(), frozen: JSON.parse(frozenText), manifestText, receiptText });
  const ra = baseline.runtimeArtifact;
  if (ra.runtimeSha256 !== BASELINE_4913.runtimeSha256 || runtimeSha256(baseline) !== ra.runtimeSha256) throw new Error('baseline runtime seal mismatch');
  if (ra.finalizedContentSha256 !== BASELINE_4913.finalizedContentSha256 || canonicalSha256(baseline.questions) !== BASELINE_4913.finalizedContentSha256) throw new Error('baseline finalized content mismatch');
  if (ra.originalCandidateRuntimeSha256 !== BASELINE_4913.originalCandidateRuntimeSha256 || ra.sourceCandidateSha256 !== BASELINE_4913.sourceCandidateSha256) throw new Error('baseline candidate seals mismatch');
  if (ra.assetManifestSha256 !== BASELINE_4913.assetManifestSha256 || ra.storageReceiptSha256 !== BASELINE_4913.storageReceiptSha256) throw new Error('baseline storage seals mismatch');
  if (baseline.releaseStatus !== 'production' || ra.assetVerification !== 'verified_readback') throw new Error('baseline is not the finalized release');
  if (baseline.questions.length !== BASELINE_4913.questionCount || baseline.paperCount !== BASELINE_4913.paperCount || new Set(baseline.questions.map(paperKey)).size !== BASELINE_4913.paperCount) throw new Error('baseline counts drifted');
  const base = baseline.questions.filter((q) => q.year >= 2021 && q.year <= 2025);
  const extension = baseline.questions.filter((q) => !(q.year >= 2021 && q.year <= 2025));
  if (idsSha256(base.map((q) => q.id)) !== BASELINE_4913.baseIdsSha256 || idsSha256(extension.map((q) => q.id)) !== BASELINE_4913.extensionIdsSha256) throw new Error('baseline cohort seals mismatch');
  if (baseline.questions.some((q) => q.publicationStatus !== 'production' || q.classificationReviewStatus !== 'classified')) throw new Error('baseline rows are not all finalized');
  if (new Set(baseline.questions.flatMap(refsOf)).size !== BASELINE_4913.assetCount) throw new Error('baseline asset closure drifted');
  return baseline;
}

/** Build the 298 May/June 2026 rows from the pinned lane; every crop is re-hashed from the lane recorded in the assembly. */
export async function buildMayJune2026Rows({ sourceRoot = defaultSourceRoot() } = {}) {
  const [assemblyBytes, receiptBytes] = await Promise.all([readFile(resolve(sourceRoot, LANE_2026_MJ.assembly)), readFile(resolve(sourceRoot, LANE_2026_MJ.receipt))]);
  if (sha256(assemblyBytes) !== LANE_2026_MJ.assemblySha256) throw new Error('May/June 2026 assembly hash mismatch');
  if (sha256(receiptBytes) !== LANE_2026_MJ.receiptSha256) throw new Error('May/June 2026 reconciliation receipt hash mismatch');
  const assembly = JSON.parse(assemblyBytes);
  const receipt = JSON.parse(receiptBytes);
  if (assembly.question_count !== LANE_2026_MJ.rows || assembly.paper_count !== LANE_2026_MJ.papers || assembly.questions.length !== LANE_2026_MJ.rows
    || JSON.stringify(assembly.years) !== '["2026"]' || assembly.segmentation_lane !== LANE_2026_MJ.segmentationLane) throw new Error('Unexpected May/June 2026 assembly counts or lane');
  const c = receipt.counts;
  if (c.served_ids !== LANE_2026_MJ.rows || c.papers !== LANE_2026_MJ.papers || c.asset_count !== LANE_2026_MJ.assets || c.mcq_marks !== LANE_2026_MJ.mcq
    || c.structured_overlays !== LANE_2026_MJ.structured || c.classification_modes?.mcq !== LANE_2026_MJ.mcq || c.classification_modes?.structured !== LANE_2026_MJ.structured) throw new Error('Unexpected May/June 2026 receipt counts');
  const sr = receipt.set_reconciliation;
  if (sr.duplicate_ids || sr.missing_ids || sr.extra_ids || sr.null_or_nonpositive_marks) throw new Error('May/June 2026 set reconciliation is not clean');
  if (receipt.asset_closure?.missing !== 0 || receipt.asset_closure?.hash_mismatches !== 0 || receipt.asset_closure?.referenced_asset_count !== LANE_2026_MJ.assets) throw new Error('May/June 2026 asset closure is not clean');
  if (JSON.stringify(receipt.paper_exception) !== JSON.stringify(LANE_2026_MJ.paperException)) throw new Error('May/June 2026 paper exception drifted');
  if (receipt.outputs?.assembly_sha256 !== LANE_2026_MJ.assemblySha256) throw new Error('May/June 2026 receipt does not seal this assembly');
  const taxonomy = await readJson(resolve(repo, 'src/data/igcse-biology-0610-official-taxonomy.json'));
  const taxonomyV2 = await readJson(resolve(repo, TAXONOMY_V2_PATH));
  const topics = topicMap(taxonomy);
  const secondaryIndex = taxonomyIndex(taxonomyV2);
  const assets = new Map();
  const rows = [];
  for (const row of assembly.questions) {
    if (!/^0610-2026-s-\d{2}-q\d+$/.test(row.question_id) || row.paper_id !== row.question_id.replace(/-q\d+$/, '') || row.year !== 2026) throw new Error(`Unexpected May/June 2026 id: ${row.question_id}`);
    const primary = row.classification.final.primary;
    if (row.classification.era !== LANE_2026_MJ.era || primary.era !== LANE_2026_MJ.era) throw new Error(`May/June 2026 row is not on the 2026_2028 registry: ${row.question_id}`);
    const routed = secondaryIndex.get(registryEra(primary.era)).get(primary.topic_id);
    if (!routed || routed.subtopic.id !== primary.official_subtopic || topics.get(`any|${primary.topic_id}`) !== routed.topic.title) throw new Error(`May/June 2026 primary does not route to the 2023_2025 registry: ${row.question_id}`);
    const expectedMarks = row.assessment_mode === 'mcq' ? 1 : null;
    if (expectedMarks !== null && row.marks !== 1) throw new Error(`May/June 2026 MCQ marks: ${row.question_id}`);
    if (row.question_id === LANE_2026_MJ.paperException.question_id && row.marks !== LANE_2026_MJ.paperException.qp_printed_total) throw new Error('0610-2026-s-43-q5 must serve the printed 15 marks');
    for (const [kind, images] of [['questions', row.source.images], ['markschemes', row.source.mark_scheme_images]]) {
      if (!images.length) throw new Error(`May/June 2026 row without ${kind}: ${row.question_id}`);
      for (const image of images) {
        if (!image.path.startsWith(`assets/${row.paper_id}/${kind === 'questions' ? 'question' : 'markscheme'}/`) || !image.path.endsWith('.webp')) throw new Error(`Unexpected crop path: ${image.path}`);
        const sourcePath = resolve(sourceRoot, LANE_2026_MJ.segmentationLane, image.path);
        const bytes = await readFile(sourcePath);
        if (sha256(bytes) !== image.sha256) throw new Error(`May/June 2026 crop SHA256 mismatch: ${image.path}`);
        if (bytes.subarray(0, 4).toString() !== 'RIFF' || bytes.subarray(8, 12).toString() !== 'WEBP') throw new Error(`Not a WebP: ${image.path}`);
        const reference = `${kind}/${row.paper_id}/${image.path.split('/').at(-1)}`;
        const prior = assets.get(reference);
        if (prior && prior.sha256 !== image.sha256) throw new Error(`Asset collision: ${reference}`);
        assets.set(reference, { reference, sourcePath, relativeSourcePath: `${LANE_2026_MJ.segmentationLane}/${image.path}`, sha256: image.sha256, size: bytes.length });
      }
    }
    const question = extensionRuntimeQuestion(row, topics, { secondaryIndex, selectedSource: LANE_2026_MJ.selectedSource });
    project0610Sections(question); // fails closed on an unseen 2026 code or a changed parent
    rows.push(question);
  }
  if (assets.size !== LANE_2026_MJ.assets) throw new Error(`May/June 2026 asset count ${assets.size} != ${LANE_2026_MJ.assets}`);
  if (new Set(rows.map(paperKey)).size !== LANE_2026_MJ.papers) throw new Error('May/June 2026 paper count is not exact');
  if (rows.filter((q) => q.paper <= 2).length !== LANE_2026_MJ.mcq || rows.filter((q) => q.paper >= 3).length !== LANE_2026_MJ.structured) throw new Error('May/June 2026 MCQ/structured split drifted');
  if (rows.filter((q) => q.secondaryTopicIds.length).length !== LANE_2026_MJ.materialSecondaryRows) throw new Error('May/June 2026 material-secondary rows drifted');
  for (const [paper, total] of Object.entries(receipt.marks_reconciliation.per_paper_served_total)) {
    if (rows.filter((q) => q.id.startsWith(`${paper}-`)).reduce((sum, q) => sum + q.marks, 0) !== total) throw new Error(`May/June 2026 marks total drifted: ${paper}`);
  }
  if (idsSha256(rows.map((q) => q.id)) !== LANE_2026_MJ.idsSha256) throw new Error('May/June 2026 ID seal mismatch');
  return { rows, assets: [...assets.values()].sort((a, b) => a.reference.localeCompare(b.reference)), receipt };
}

/** Pure insertion: the finalized baseline rows stay verbatim and in order; the 298 rows are appended. */
export async function buildRuntime2026MayJune({ sourceRoot = defaultSourceRoot() } = {}) {
  const baseline = await loadBaseline();
  const before = baseline.questions.map((q) => JSON.stringify(q));
  const { rows, assets } = await buildMayJune2026Rows({ sourceRoot });
  const baselineIds = new Set(baseline.questions.map((q) => q.id));
  if (rows.some((q) => baselineIds.has(q.id))) throw new Error('May/June 2026 rows collide with baseline IDs');
  const baselineRefs = new Set(baseline.questions.flatMap(refsOf));
  if (assets.some((asset) => baselineRefs.has(asset.reference))) throw new Error('May/June 2026 assets collide with baseline object keys');
  const questions = [...baseline.questions, ...rows];
  if (questions.slice(0, before.length).some((q, i) => JSON.stringify(q) !== before[i])) throw new Error('baseline rows changed');
  if (canonicalSha256(questions.slice(0, before.length)) !== BASELINE_4913.finalizedContentSha256) throw new Error('baseline content seal changed');
  const extension = questions.filter((q) => !(q.year >= 2021 && q.year <= 2025));
  if (idsSha256(extension.map((q) => q.id)) !== LANE_2026_MJ.extensionThroughMayJuneIdsSha256) throw new Error('combined extension ID seal mismatch');
  const papers = new Set(questions.map(paperKey));
  if (questions.length !== EXPECTED_2026_MJ.rows || papers.size !== EXPECTED_2026_MJ.papers || new Set(questions.flatMap(refsOf)).size !== EXPECTED_2026_MJ.assets) throw new Error('combined counts are not exact');
  const ra = baseline.runtimeArtifact;
  const runtime = {
    ...baseline,
    version: 'igcse-biology-0610-combined5211-v1',
    releaseStatus: 'authorized_production_candidate',
    publicationStatus: 'authorized_production_candidate',
    assetVerification: 'pending_storage_release',
    years: EXPECTED_2026_MJ.years,
    paperCount: EXPECTED_2026_MJ.papers,
    questionCount: EXPECTED_2026_MJ.rows,
    questions,
    runtimeArtifact: {
      ...ra,
      publicationStatus: 'authorized_production_candidate',
      assetVerification: 'pending_storage_release',
      storageState: 'pending_upload',
      storageReceiptSha256: null,
      assetManifestSha256: null,
      finalizedContentSha256: null,
      contentSha256: canonicalSha256(questions),
      sourceCandidateSha256: sha256(`${ra.sourceCandidateSha256}:${LANE_2026_MJ.assemblySha256}:${LANE_2026_MJ.receiptSha256}`),
      originalCandidateRuntimeSha256: null,
      runtimeSha256: null,
      extension2026MayJune: {
        method: 'pure insertion: the finalized, secondaries-resealed 4,913-row runtime is kept verbatim and in order; the 298 May/June 2026 rows are appended',
        baselineMainGitCommit: BASELINE_4913.mainGitCommit,
        baselineDerivation: BASELINE_4913.derivation,
        baselineRuntimeSha256: BASELINE_4913.runtimeSha256,
        baselineOriginalCandidateRuntimeSha256: BASELINE_4913.originalCandidateRuntimeSha256,
        baselineSourceCandidateSha256: BASELINE_4913.sourceCandidateSha256,
        baselineFinalizedContentSha256: BASELINE_4913.finalizedContentSha256,
        baselineAssetManifestSha256: BASELINE_4913.assetManifestSha256,
        baselineStorageReceiptSha256: BASELINE_4913.storageReceiptSha256,
        baselineQuestionCount: BASELINE_4913.questionCount,
        baselinePaperCount: BASELINE_4913.paperCount,
        baselineAssetCount: BASELINE_4913.assetCount,
        questionCount: LANE_2026_MJ.rows,
        paperCount: LANE_2026_MJ.papers,
        mcqCount: LANE_2026_MJ.mcq,
        structuredCount: LANE_2026_MJ.structured,
        assetCount: LANE_2026_MJ.assets,
        questionAssetCount: assets.filter((asset) => asset.reference.startsWith('questions/')).length,
        markschemeAssetCount: assets.filter((asset) => asset.reference.startsWith('markschemes/')).length,
        materialSecondaryRows: LANE_2026_MJ.materialSecondaryRows,
        idsSha256: LANE_2026_MJ.idsSha256,
        extensionThroughMayJuneIdsSha256: LANE_2026_MJ.extensionThroughMayJuneIdsSha256,
        courseEra: LANE_2026_MJ.era,
        registryEra: registryEra(LANE_2026_MJ.era),
        paperException: LANE_2026_MJ.paperException,
        sourceRepository: 'igcse-biology-0610-topic-practice',
        sourceBranch: LANE_2026_MJ.sourceBranch,
        sourceCommitAtBuild: LANE_2026_MJ.sourceCommitAtBuild,
        sourceAssemblySha256: LANE_2026_MJ.assemblySha256,
        sourceReconciliationReceiptSha256: LANE_2026_MJ.receiptSha256,
        segmentationLane: LANE_2026_MJ.segmentationLane,
      },
    },
  };
  const candidate = runtimeSha256(runtime);
  runtime.runtimeArtifact.originalCandidateRuntimeSha256 = candidate;
  runtime.runtimeArtifact.runtimeSha256 = runtimeSha256(runtime);
  return { runtime, baseline, assets, seals: { candidate, runtime: runtime.runtimeArtifact.runtimeSha256, contentSha256: runtime.runtimeArtifact.contentSha256, sourceCandidateSha256: runtime.runtimeArtifact.sourceCandidateSha256 } };
}

/** The live 0610 runtime is pretty-printed, so the baseline rows keep their exact serialized lines. */
export const serializeRuntime = (runtime) => `${JSON.stringify(runtime, null, 2)}\n`;
export async function serializePrivateIndex(runtime) {
  const { resealPrivateIndex, readBaselineIndex, FROZEN_PATH } = await import('./reseal-biology-0610-secondaries.mjs');
  const baselineIndex = resealPrivateIndex(readBaselineIndex(), JSON.parse(await readFile(resolve(repo, FROZEN_PATH), 'utf8')));
  const added = createPrivateIndex(runtime.questions.slice(BASELINE_4913.questionCount)).questions;
  return `${JSON.stringify({ ...baselineIndex, questions: [...baselineIndex.questions, ...added] })}\n`;
}

async function main() {
  if (process.argv.includes('--check-historical')) {
    const { candidateSeal, prefix, assetCount, sourceCandidateSha256 } = await buildHistoricalCandidate();
    if (candidateSeal !== HISTORICAL_CANDIDATE_SHA256) throw new Error(`historical 4,913-row candidate no longer reproduces (${candidateSeal})`);
    console.log(JSON.stringify({ historicalCandidate: candidateSeal, prefix, assetCount, sourceCandidateSha256 }));
    return;
  }
  const { runtime, seals } = await buildRuntime2026MayJune();
  const outputs = [[`src/data/production/${BANK}.json`, serializeRuntime(runtime)], [`src/data/private-index/${BANK}.json`, await serializePrivateIndex(runtime)]];
  if (process.argv.includes('--check')) {
    for (const [file, text] of outputs) if (await readFile(resolve(repo, file), 'utf8') !== text) throw new Error(`${file} is not the regenerated May/June 2026 candidate`);
  } else {
    for (const [file, text] of outputs) await writeFile(resolve(repo, file), text);
  }
  console.log(JSON.stringify({ rows: runtime.questionCount, papers: runtime.paperCount, years: runtime.years, ...seals }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error instanceof Error ? error.stack ?? error.message : String(error)); process.exitCode = 1; });
}
