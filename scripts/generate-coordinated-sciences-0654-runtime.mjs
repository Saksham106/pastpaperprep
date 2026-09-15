#!/usr/bin/env node
/**
 * Deterministic PRODUCTION runtime generator for IGCSE Co-ordinated Sciences 0654.
 *
 * Never hand-edit the generated JSON: regenerate it from the frozen tuple.
 *
 * Frozen input tuple (all sha256-pinned, fail-closed):
 *   assembly      <SOURCE_ROOT>/data/classification/full-bank-assembly/working-assembly.json
 *                 6b161eb9e580bb5f63baa30f1ac2f1d322c9cfd79245ad305cb2a53a7d9a936d
 *   source manifest <SOURCE_ROOT>/data/segmentation/full/full-manifest.json
 *                 8b1091e9836e95be1a8dd70d0fb5cab746777903b5ab1a152c9652bf41fd7e68
 *   emitted taxonomy src/data/igcse-coordinated-sciences-0654-taxonomy.json
 *                 0f4790a44465163b5d8f6b1e09120df11e256f473f9e4b929fc6bf467aafdc6e
 *
 * Expected shape (asserted, not assumed): 4,030 runtime rows / 204 papers,
 * exactly one board-discounted exclusion (0654-2023-summer-22-q17), 4 unresolved
 * taxonomy rows preserved fail-closed, 0 missing marks, 40 topics.
 *
 * Output (candidate only): src/data/production/igcse-coordinated-sciences-0654.json
 * No upload, no finalization. `generate-igcse-release.mjs --finalize` is a later,
 * receipt-gated step.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { TAXONOMY_SHA256, taxonomyOutputPath, syncTaxonomy } from "./sync-coordinated-sciences-0654-taxonomy.mjs";

export const BANK = "igcse-coordinated-sciences-0654";
export const SUBJECT_LABELS = { biology: `Biology 0654`, chemistry: `Chemistry 0654`, physics: `Physics 0654` };
export const COURSE = "Cambridge IGCSE Co-ordinated Sciences 0654 (Double Award)";
export const RIGHTS_STATUS = "user_attested_rights_authorized";
export const CANDIDATE_PUBLICATION_STATUS = "authorized_production_candidate";
export const UNRESOLVED_TAXONOMY_STATUS = "unresolved_taxonomy_gap";

export const ASSEMBLY_SHA256 = "6b161eb9e580bb5f63baa30f1ac2f1d322c9cfd79245ad305cb2a53a7d9a936d";
export const SOURCE_MANIFEST_SHA256 = "8b1091e9836e95be1a8dd70d0fb5cab746777903b5ab1a152c9652bf41fd7e68";
export const EXCLUDED_BOARD_DISCOUNTED = ["0654-2023-summer-22-q17"];
export const DEFAULT_SOURCE_ROOT = "/Users/sakshamgoel/Documents/ProjectsInternships/igcse-coordinated-sciences-0654-topic-practice";
export const EXPECTED = {
  rows: 4030,
  sourceQuestions: 4031,
  papers: 204,
  excluded: EXCLUDED_BOARD_DISCOUNTED.length,
  unresolved: 4,
  // The emitted taxonomy exposes 40 topics; 39 of them carry at least one row.
  taxonomyTopics: 40,
  topics: 39,
  rowsWithoutMarks: 0,
  sourceAssetRefs: 13325,
  runtimeAssetRefs: 13322,
  multiSubjectRows: 20,
  subjects: { biology: 1306, chemistry: 1407, physics: 1317 },
};

const SESSION_LABELS = { march: "March", summer: "June", winter: "November" };
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function sourceRootPath(environment = process.env) {
  return environment.PASTPAPERPREP_IGCSE_COORDINATED_SOURCE_ROOT?.trim() || DEFAULT_SOURCE_ROOT;
}

/** assets/<paper>/{question,markscheme}/<file>.webp -> <paper>/<file>.webp, asserted against the row's paper id. */
function cleanAsset(paperId, value) {
  const raw = String(value ?? "");
  const match = /^assets\/([^/]+)\/(question|markscheme)\/(.+\.webp)$/.exec(raw);
  if (!match) throw new Error(`Unsupported 0654 asset layout: ${raw}`);
  if (match[1] !== paperId) throw new Error(`Asset paper directory ${match[1]} does not match row paper ${paperId}`);
  return `${match[1]}/${match[3]}`;
}

function buildTaxonomyIndex(taxonomy) {
  const topicById = new Map(taxonomy.topics.map((topic) => [topic.id, topic]));
  const subtopicById = new Map(taxonomy.subtopics.map((subtopic) => [subtopic.id, subtopic]));
  const skillTitleById = new Map(
    taxonomy.subtopics.filter((subtopic) => subtopic.ownerTopicId === "practical-skills").map((subtopic) => [subtopic.id, subtopic.title]),
  );
  // A row's printed section code is the topic-level code (e.g. B1) whose numbered
  // sections are B1.1, B1.2, ...; accept either an exact section id or a code prefix.
  const subtopicCodePrefixes = new Set(taxonomy.subtopics.map((subtopic) => subtopic.id.split(".")[0]));
  // Printed section codes are era-scoped (the same code means a different section in a
  // different edition), so they are never matched across eras and are not required to
  // exist as a taxonomy id. What MUST hold is that the student-facing subtopic label is
  // a real syllabus section title, because the label is the filter vocabulary.
  const subtopicTitles = new Set(taxonomy.subtopics.map((subtopic) => subtopic.title));
  return { topicById, subtopicById, skillTitleById, subtopicCodePrefixes, subtopicTitles };
}

function rowToQuestion(row, taxonomy, index) {
  const id = row.question_id;
  const match = /^0654-(\d{4})-([a-z]+)-(\d+)-q(\d+)$/.exec(id);
  if (!match) throw new Error(`Invalid 0654 question id: ${id}`);
  const [, year, sessionCode, component, number] = match;
  const session = SESSION_LABELS[sessionCode];
  if (!session) throw new Error(`Unknown 0654 session code: ${sessionCode}`);
  if (row.paper_id !== `0654-${year}-${sessionCode}-${component}`) throw new Error(`0654 paper id mismatch: ${id}`);

  const primary = row.primary ?? null;
  const secondary = Array.isArray(row.secondary) ? row.secondary : [];
  const subjects = Array.isArray(row.subjects) ? [...new Set(row.subjects)] : [];
  if (!subjects.length) throw new Error(`0654 row has no subject: ${id}`);

  const questionAssets = (row.source?.images ?? []).map((asset) => `questions/${cleanAsset(row.paper_id, asset.path)}`);
  const markschemeAssets = (row.source?.mark_scheme_images ?? []).map((asset) => `markschemes/${cleanAsset(row.paper_id, asset.path)}`);
  if (!questionAssets.length) throw new Error(`Missing question asset: ${id}`);
  if (!markschemeAssets.length) throw new Error(`Missing mark scheme asset: ${id}`);
  for (const asset of [...questionAssets, ...markschemeAssets]) {
    if (!asset.endsWith(".webp")) throw new Error(`Non-WEBP 0654 asset: ${asset}`);
  }

  // Fail closed on the primary subject contract: a multi-subject row's subject list
  // must lead with the subject that owns its primary topic, because downstream
  // consumers paint and filter on the primary.
  let primarySubject = null;
  if (primary?.topic_id) {
    const ownerTopic = index.topicById.get(primary.topic_id);
    if (!ownerTopic) throw new Error(`0654 primary topic id is not in the taxonomy: ${primary.topic_id} (${id})`);
    if (ownerTopic.subject === "all") {
      // `practical-skills` is the one subject-agnostic topic: the row's own printed
      // subject is the leading axis, and it is still the row's real subject.
      primarySubject = null;
    } else {
      primarySubject = ownerTopic.subject;
      if (!SUBJECT_LABELS[primarySubject]) throw new Error(`0654 primary subject is not a science: ${primarySubject} (${id})`);
      if (subjects[0] !== primarySubject) throw new Error(`0654 row does not lead with its primary subject: ${id} subjects=${subjects.join(",")} primary=${primarySubject}`);
      if (!subjects.includes(primarySubject)) throw new Error(`0654 subjects omit the primary subject: ${id}`);
    }
    if (primary.topic_label !== ownerTopic.title) throw new Error(`0654 topic label disagrees with the taxonomy: ${id}`);
    if (!index.subtopicTitles.has(primary.subtopic_label)) throw new Error(`0654 primary subtopic label is not a syllabus section title: ${primary.subtopic_label} (${id})`);
  }
  for (const rowSubject of subjects) {
    if (!SUBJECT_LABELS[rowSubject]) throw new Error(`0654 row carries an unknown subject: ${rowSubject} (${id})`);
  }

  const unresolved = row.classification_status === "unresolved";
  // Fail closed: an unresolved row keeps its counted gap and must NOT carry a label,
  // and a labelled row must carry one. Neither state is silently converted.
  if (unresolved && (primary?.topic_id || primary?.subtopic_label)) throw new Error(`0654 unresolved row carries a primary label: ${id}`);
  if (!unresolved && !primary?.topic_label) throw new Error(`0654 labelled row has no primary topic: ${id}`);
  // A row's own subject is real either way, so the leading axis is never invented.
  const subject = primarySubject ? SUBJECT_LABELS[primarySubject] : SUBJECT_LABELS[subjects[0]];
  if (!subject) throw new Error(`0654 row has no subject label: ${id}`);

  const primaryLabel = primary?.subtopic_label ?? null;
  const secondaryLabels = secondary.map((item) => item.subtopic_label).filter(Boolean);
  const subtopics = [...new Set([primaryLabel, ...secondaryLabels].filter(Boolean))];
  const secondaryTopics = [...new Set(secondary.map((item) => item.topic_label).filter(Boolean))];
  const skills = [...new Set((row.practical_skills ?? []).map((skillId) => {
    const title = index.skillTitleById.get(skillId);
    if (!title) throw new Error(`Unmapped 0654 practical skill id: ${skillId} (${id})`);
    return title;
  }))];

  for (const label of [...subtopics, ...skills]) {
    if (label === label.toLowerCase() && label.includes("-")) throw new Error(`Internal id leaked as a student-facing label: ${label} (${id})`);
  }

  const text = typeof row.source?.text === "string" ? row.source.text.trim() : "";
  if (!text) throw new Error(`Missing question text: ${id}`);
  const marks = typeof row.marks === "number" && Number.isInteger(row.marks) && row.marks > 0 ? row.marks : null;
  if (marks === null) throw new Error(`0654 row has no usable printed mark: ${id}`);

  return {
    id,
    canonicalId: id,
    bankSlug: BANK,
    number: Number(number),
    paper: Number(component[0]),
    year: Number(year),
    session,
    zone: `Variant ${component[1]}`,
    component,
    courseEra: row.era ?? null,
    paperTier: row.tier ?? null,
    subject,
    course: COURSE,
    subjects,
    primaryTopic: primary?.topic_label ?? null,
    primaryTopicId: primary?.topic_id ?? null,
    secondaryTopics,
    subtopics,
    detailedSubtopics: [...new Set([...subtopics, ...skills])],
    secondarySubtopics: [...new Set(secondaryLabels)],
    skills,
    assessmentObjectives: [],
    marks,
    maxMarks: marks,
    summary: text.slice(0, 220),
    accessibleText: text,
    questionImages: questionAssets,
    markschemeImages: markschemeAssets,
    officialMarkscheme: { images: markschemeAssets },
    sourceQuestionUrl: row.source?.qp_pdf?.source_url ?? row.source?.qp_pdf?.final_url ?? null,
    sourceMarkSchemeUrl: row.source?.ms_pdf?.source_url ?? row.source?.ms_pdf?.final_url ?? null,
    sourceType: "actual_past_paper",
    sourceId: id,
    publicationStatus: CANDIDATE_PUBLICATION_STATUS,
    classificationReviewStatus: unresolved ? UNRESOLVED_TAXONOMY_STATUS : "candidate_not_approved",
    classificationProvenance: {
      selectedSource: "mvp-assembly",
      sourceRowId: id,
      labelSource: row.label_source ?? null,
      confidence: row.confidence ?? null,
      primaryDetailId: primary?.detail_id ?? null,
      officialCode: primary?.official_code ?? null,
      era: primary?.era ?? null,
      level: primary?.level ?? null,
      syllabusBoundary: row.syllabus_boundary ?? null,
      reconciled: row.reconciled ?? null,
      gaps: row.gaps ?? [],
      taxonomyPath: "src/data/igcse-coordinated-sciences-0654-taxonomy.json",
    },
    marks_ready: true,
    rightsStatus: RIGHTS_STATUS,
    answer: typeof row.answer === "string" && row.answer.length ? row.answer : null,
    answerProvenance: typeof row.answer === "string" && row.answer.length
      ? { status: row.answer_status ?? "official", questionId: id, assetPaths: markschemeAssets }
      : null,
    printedParts: row.printed_parts ?? ["question-level"],
  };
}

/** Deterministic self-seal: candidate hash over the artifact with the seal fields blanked, then the runtime self-hash. */
export function seal(artifact) {
  const blanked = (fields) => JSON.stringify({
    ...artifact,
    runtimeArtifact: {
      ...artifact.runtimeArtifact,
      sourceCandidateSha256: fields.includes("candidate") ? null : artifact.runtimeArtifact.sourceCandidateSha256,
      originalCandidateRuntimeSha256: fields.includes("candidate") ? null : artifact.runtimeArtifact.originalCandidateRuntimeSha256,
      runtimeSha256: fields.includes("runtime") ? null : artifact.runtimeArtifact.runtimeSha256,
    },
  });
  const candidate = sha256(blanked(["candidate", "runtime"]));
  artifact.runtimeArtifact.sourceCandidateSha256 = candidate;
  artifact.runtimeArtifact.originalCandidateRuntimeSha256 = candidate;
  artifact.runtimeArtifact.runtimeSha256 = sha256(blanked(["runtime"]));
  return { candidate, runtime: artifact.runtimeArtifact.runtimeSha256 };
}

export async function buildRuntime({ sourceRoot = sourceRootPath() } = {}) {
  const assemblyPath = path.join(sourceRoot, "data/classification/full-bank-assembly/working-assembly.json");
  const manifestPath = path.join(sourceRoot, "data/segmentation/full/full-manifest.json");
  const marksOverlayPath = path.join(sourceRoot, "data/classification/marks-repair/overlay.json");

  const assemblyBytes = await readFile(assemblyPath);
  const manifestBytes = await readFile(manifestPath);
  const marksOverlayBytes = await readFile(marksOverlayPath);
  const assemblySha = sha256(assemblyBytes);
  const manifestSha = sha256(manifestBytes);
  if (assemblySha !== ASSEMBLY_SHA256) throw new Error(`0654 assembly sha256 mismatch: ${assemblySha}`);
  if (manifestSha !== SOURCE_MANIFEST_SHA256) throw new Error(`0654 source manifest sha256 mismatch: ${manifestSha}`);

  const taxonomyPath = taxonomyOutputPath();
  const taxonomyBytes = await readFile(taxonomyPath);
  const taxonomyFileSha = sha256(taxonomyBytes);
  if (taxonomyFileSha !== TAXONOMY_SHA256) throw new Error(`0654 taxonomy sha256 mismatch: ${taxonomyFileSha}`);
  const taxonomy = JSON.parse(taxonomyBytes.toString("utf8"));
  const index = buildTaxonomyIndex(taxonomy);

  const assembly = JSON.parse(assemblyBytes.toString("utf8"));
  const rows = assembly.rows;
  if (!Array.isArray(rows)) throw new Error("0654 assembly has no rows array");

  // The source manifest is the source universe: it still contains the board-discounted
  // question, so its counts are asserted against the frozen source audit figures.
  const sourceManifest = JSON.parse(manifestBytes.toString("utf8"));
  if (sourceManifest.question_count !== EXPECTED.sourceQuestions) throw new Error(`0654 source question count ${sourceManifest.question_count} != ${EXPECTED.sourceQuestions}`);
  if (sourceManifest.paper_count !== EXPECTED.papers) throw new Error(`0654 source paper count ${sourceManifest.paper_count} != ${EXPECTED.papers}`);
  if (sourceManifest.asset_count !== EXPECTED.sourceAssetRefs) throw new Error(`0654 source asset refs ${sourceManifest.asset_count} != ${EXPECTED.sourceAssetRefs}`);

  const questions = rows.map((row) => rowToQuestion(row, taxonomy, index))
    .sort((a, b) => b.year - a.year || a.paper - b.paper || a.number - b.number || a.id.localeCompare(b.id));

  // ---- Coverage assertions (fail closed) ----
  if (questions.length !== EXPECTED.rows) throw new Error(`0654 row count ${questions.length} != ${EXPECTED.rows}`);
  if (new Set(questions.map((question) => question.id)).size !== questions.length) throw new Error("0654 runtime has duplicate question ids");
  const paperCount = new Set(rows.map((row) => row.paper_id)).size;
  if (paperCount !== EXPECTED.papers) throw new Error(`0654 paper count ${paperCount} != ${EXPECTED.papers}`);
  for (const excluded of EXCLUDED_BOARD_DISCOUNTED) {
    if (questions.some((question) => question.id === excluded)) throw new Error(`0654 board-discounted question was not excluded: ${excluded}`);
  }
  const unresolved = questions.filter((question) => question.classificationReviewStatus === UNRESOLVED_TAXONOMY_STATUS);
  if (unresolved.length !== EXPECTED.unresolved) throw new Error(`0654 unresolved rows ${unresolved.length} != ${EXPECTED.unresolved}`);
  const topics = new Set(questions.map((question) => question.primaryTopic).filter(Boolean));
  if (topics.size !== EXPECTED.topics) throw new Error(`0654 topic count ${topics.size} != ${EXPECTED.topics}`);
  if (taxonomy.topics.length !== EXPECTED.taxonomyTopics) throw new Error(`0654 taxonomy topic count ${taxonomy.topics.length} != ${EXPECTED.taxonomyTopics}`);
  const taxonomyTopicTitles = new Set(taxonomy.topics.map((topic) => topic.title));
  for (const topic of topics) {
    if (!taxonomyTopicTitles.has(topic)) throw new Error(`0654 row topic is not a taxonomy topic title: ${topic}`);
  }
  const multiSubject = questions.filter((question) => question.subjects.length > 1);
  if (multiSubject.length !== EXPECTED.multiSubjectRows) throw new Error(`0654 multi-subject rows ${multiSubject.length} != ${EXPECTED.multiSubjectRows}`);
  const subjects = questions.reduce((counts, question) => {
    const key = question.subjects[0];
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  for (const [subject, expected] of Object.entries(EXPECTED.subjects)) {
    if (subjects[subject] !== expected) throw new Error(`0654 primary subject ${subject} count ${subjects[subject]} != ${expected}`);
  }

  const years = questions.map((question) => question.year);
  const runtimeAssetRefs = questions.reduce((count, question) => count + question.questionImages.length + question.markschemeImages.length, 0);
  if (runtimeAssetRefs !== EXPECTED.runtimeAssetRefs) throw new Error(`0654 runtime asset refs ${runtimeAssetRefs} != ${EXPECTED.runtimeAssetRefs}`);
  const sourceAssetRefs = rows.reduce((count, row) => count + (row.source?.images?.length ?? 0) + (row.source?.mark_scheme_images?.length ?? 0), 0);
  if (sourceAssetRefs !== EXPECTED.runtimeAssetRefs) throw new Error(`0654 source asset refs ${sourceAssetRefs} != ${EXPECTED.runtimeAssetRefs}`);

  const artifact = {
    version: `igcse-coordinated-sciences-0654-full${questions.length}-v1`,
    releaseStatus: CANDIDATE_PUBLICATION_STATUS,
    rightsStatus: RIGHTS_STATUS,
    sourceType: "actual_past_paper",
    specimenQuestionsIncluded: false,
    liveOnlyUnderReleaseGate: true,
    years: `${Math.min(...years)}-${Math.max(...years)}`,
    paperCount,
    questionCount: questions.length,
    marks_ready: true,
    sourceCandidate: {
      path: "data/classification/full-bank-assembly/working-assembly.json",
      sha256: assemblySha,
      questionCount: questions.length,
    },
    taxonomy: {
      path: "src/data/igcse-coordinated-sciences-0654-taxonomy.json",
      version: taxonomy.version,
      sha256: taxonomyFileSha,
    },
    questions,
    publicationStatus: CANDIDATE_PUBLICATION_STATUS,
    assetVerification: "pending_upload",
    runtimeArtifact: {
      schemaVersion: "igcse-production-runtime-v1",
      sourceRepository: BANK,
      sourceCandidateSha256: null,
      releaseTaxonomySha256: taxonomyFileSha,
      runtimeTaxonomySha256: sha256(JSON.stringify(taxonomy)),
      publicationStatus: CANDIDATE_PUBLICATION_STATUS,
      rightsStatus: RIGHTS_STATUS,
      assetVerification: "pending_upload",
      assetManifestSha256: null,
      storageReceiptSha256: null,
      contentSha256: sha256(JSON.stringify(questions)),
      marksReady: true,
      marksRepairStatus: "verified_against_print",
      marksRepairOverlaySha256: sha256(marksOverlayBytes),
      marksRepairUnresolvedCount: 0,
      excludedBoardDiscounted: EXCLUDED_BOARD_DISCOUNTED,
      originalCandidateRuntimeSha256: null,
      runtimeSha256: null,
    },
  };
  const seals = seal(artifact);

  const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
  return {
    artifact,
    serialized,
    seals,
    report: {
      status: "PASS",
      bank: BANK,
      assemblySha256: assemblySha,
      sourceManifestSha256: manifestSha,
      taxonomySha256: taxonomyFileSha,
      rows: questions.length,
      papers: paperCount,
      years: artifact.years,
      topics: topics.size,
      unresolved: unresolved.length,
      multiSubjectRows: multiSubject.length,
      subjects,
      runtimeAssetRefs,
      sourceAssetRefs,
      rowsWithoutMarks: questions.filter((question) => question.marks === null).length,
    },
  };
}

export function createPrivateIndex(artifact) {
  return {
    version: 1,
    bank: BANK,
    questions: artifact.questions.map((question) => ({
      id: question.id,
      number: question.number,
      paper: question.paper,
      year: question.year,
      session: question.session,
      primaryTopic: question.primaryTopic,
      secondaryTopics: [...question.secondaryTopics],
      skills: [...question.skills],
      subtopics: [...question.subtopics],
      subject: question.subject,
      zone: question.zone,
      component: question.component,
      marks: question.marks,
    })),
  };
}

export async function writeRuntime({ repo = path.resolve(import.meta.dirname, ".."), sourceRoot = sourceRootPath() } = {}) {
  await syncTaxonomy({ repo });
  const built = await buildRuntime({ sourceRoot });
  const output = path.join(repo, "src/data/production", `${BANK}.json`);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, built.serialized);
  // Metadata-only candidate private index (same compact shape as the other private
  // banks). No answers, text, or asset paths cross this boundary.
  const privateIndex = path.join(repo, "src/data/private-index", `${BANK}.json`);
  await mkdir(path.dirname(privateIndex), { recursive: true });
  await writeFile(privateIndex, `${JSON.stringify(createPrivateIndex(built.artifact))}\n`);
  return { ...built, output, privateIndex };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const result = await writeRuntime();
  console.log(JSON.stringify({ ...result.report, seals: result.seals, output: result.output }, null, 2));
}
