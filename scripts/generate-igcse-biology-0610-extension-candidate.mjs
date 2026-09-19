#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const BANK = 'igcse-biology-0610';
const repo = resolve(import.meta.dirname, '..');
const sourceRoot = resolve(process.env.PASTPAPERPREP_IGCSE_BIOLOGY_SOURCE_ROOT ?? '/Users/sakshamgoel/Documents/ProjectsInternships/igcse-biology-0610-topic-practice');
const basePath = resolve(repo, 'src/data/production/igcse-biology-0610.json');
const baseManifestPath = resolve(repo, 'data/storage/igcse-biology-0610.manifest.json');
const extensionPath = resolve(sourceRoot, 'data/classification/extension-2019-2020-2026/assembly/release/assembly.json');
const extensionReceiptPath = resolve(sourceRoot, 'data/classification/extension-2019-2020-2026/assembly/release/reconciliation-receipt.json');

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonicalSha256 = (value) => sha256(JSON.stringify(value));
const writeJson = async (path, value) => writeFile(path, `${JSON.stringify(value)}\n`);
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const readHeadJson = (path) => JSON.parse(execFileSync('git', ['show', `HEAD:${path}`], { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));

function topicMap(taxonomy) {
  const result = new Map();
  for (const era of taxonomy.eras ?? []) for (const topic of era.topics ?? []) {
    for (const subtopic of topic.subtopics ?? []) {
      result.set(`${era.era}|${subtopic.normalized_subtopic_id}`, topic.title);
      result.set(`any|${subtopic.normalized_subtopic_id}`, topic.title);
    }
  }
  return result;
}

function sessionName(code) {
  return ({ m: 'March', s: 'June', w: 'November', f: 'February' })[code] ?? code;
}

function extensionRuntimeQuestion(row, topics) {
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
    secondaryTopics: [],
    subtopics: [subtopic],
    detailedSubtopics: [subtopic],
    secondarySubtopics: [],
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
      selectedSource: 'extension-2019-2020-2026',
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

function runtimeSha256(runtime) {
  const copy = JSON.parse(JSON.stringify(runtime));
  copy.runtimeArtifact.runtimeSha256 = null;
  return canonicalSha256(copy);
}

async function main() {
  const base = readHeadJson('src/data/production/igcse-biology-0610.json');
  const baseManifest = readHeadJson('data/storage/igcse-biology-0610.manifest.json');
  const assembly = await readJson(extensionPath);
  const extensionReceipt = await readJson(extensionReceiptPath);
  const taxonomy = await readJson(resolve(repo, 'src/data/igcse-biology-0610-official-taxonomy.json'));
  if (sha256(await readFile(extensionPath)) !== '92132de006cb98dcd7f7feef193be05d6cf0233addcaa41b045f6b7771490de1') throw new Error('Extension assembly hash mismatch');
  if (sha256(await readFile(extensionReceiptPath)) !== 'c708d4b0116b3559fd550481a355d0964a722f7027962dfc6297eea1408bcbbd') throw new Error('Extension reconciliation receipt hash mismatch');
  if (assembly.question_count !== 1472 || assembly.paper_count !== 89 || assembly.questions.length !== 1472) throw new Error('Unexpected extension counts');
  if (extensionReceipt.counts.asset_count !== 5099 || extensionReceipt.counts.mcq_marks !== 1200 || extensionReceipt.counts.structured_overlays !== 272) throw new Error('Unexpected extension receipt counts');
  const topics = topicMap(taxonomy);
  const extensionQuestions = assembly.questions.map((row) => extensionRuntimeQuestion(row, topics));
  const ids = new Set(base.questions.map((q) => q.id));
  for (const q of extensionQuestions) { if (ids.has(q.id)) throw new Error(`Duplicate question id: ${q.id}`); ids.add(q.id); }
  const questions = [...base.questions, ...extensionQuestions];
  const years = [...new Set(questions.map((q) => q.year))].sort((a, b) => a - b);
  const papers = new Set(questions.map((q) => `${q.year}-${q.session}-${q.component}`));
  const sourceCandidateSha256 = sha256(`${base.runtimeArtifact.sourceCandidateSha256}:${sha256(await readFile(extensionPath))}:${sha256(await readFile(extensionReceiptPath))}`);
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
      sourceAssemblySha256: sha256(await readFile(extensionPath)),
      sourceReconciliationReceiptSha256: sha256(await readFile(extensionReceiptPath)),
      extensionQuestionCount: 1472,
      extensionPaperCount: 89,
      extensionAssetCount: 5099,
      extensionMcqMarks: 1200,
      extensionStructuredMarks: 272,
      paperException: extensionReceipt.paper_exception,
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
  const manifest = {
    schemaVersion: 'igcse-private-assets-v1', bank: BANK, objectPrefix: `${prefix}/`, storageState: 'pending_upload',
    originalCandidateRuntimeSha256: candidateSeal, contentSha256: null,
    assets: [...manifestAssets.values()].sort((a, b) => a.objectKey.localeCompare(b.objectKey)),
  };
  runtime.runtimeArtifact.assetManifestSha256 = canonicalSha256(manifest);
  runtime.runtimeArtifact.runtimeSha256 = runtimeSha256(runtime);
  const index = { version: 1, bank: BANK, questions: questions.map((q) => ({ id: q.id, number: q.number, paper: q.paper, year: q.year, session: q.session, primaryTopic: q.primaryTopic, secondaryTopics: q.secondaryTopics, skills: q.skills, subtopics: q.subtopics, subject: q.subject, option: null, zone: q.zone, component: q.component, calculator: null, marks: q.marks })) };
  await mkdir(resolve(repo, 'data/storage'), { recursive: true });
  await writeJson(basePath, runtime);
  await writeJson(resolve(repo, 'src/data/private-index/igcse-biology-0610.json'), index);
  await writeJson(baseManifestPath, manifest);
  console.log(JSON.stringify({ questionCount: questions.length, paperCount: papers.size, years: runtime.years, assetCount: manifest.assets.length, prefix, candidateSeal, runtimeSha256: runtime.runtimeArtifact.runtimeSha256, assetManifestSha256: runtime.runtimeArtifact.assetManifestSha256, sourceCandidateSha256 }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.stack ?? error.message : String(error)); process.exitCode = 1; });
