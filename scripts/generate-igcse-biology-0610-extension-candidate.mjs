#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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

async function main() {
  if (process.argv.includes('--check-historical')) {
    const { candidateSeal, prefix, assetCount, sourceCandidateSha256 } = await buildHistoricalCandidate();
    if (candidateSeal !== HISTORICAL_CANDIDATE_SHA256) throw new Error(`historical 4,913-row candidate no longer reproduces (${candidateSeal})`);
    console.log(JSON.stringify({ historicalCandidate: candidateSeal, prefix, assetCount, sourceCandidateSha256 }));
    return;
  }
  throw new Error('Usage: generate-igcse-biology-0610-extension-candidate.mjs --check-historical');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error instanceof Error ? error.stack ?? error.message : String(error)); process.exitCode = 1; });
}
