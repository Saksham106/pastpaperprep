#!/usr/bin/env node
/**
 * Build the IGCSE Computer Science 0478 candidate runtime from the pinned source workspace.
 *
 * Inputs (SHA-256 pinned; any drift fails closed):
 *   data/segmentation/full/segmentation.json   2023-2026: 50 QP/MS pairs, 471 questions, audited crops
 *   data/classification/final-labels.json      469 labels (2 questions Cambridge withdrew are excluded)
 *   data/classification/taxonomy.json          official 2023-2028 tree, owner-approved topic 7 filters and
 *                                              the 2015-2022 earlier-syllabus block
 *   data/source-manifest.json                  source URLs
 *   data/segmentation/extension-2019-2022/…   2019-2022 (2015-2022 syllabus): 55 pairs, 405 questions; the 27
 *                                              Paper 2 pre-release questions (Section A, Q1) are excluded
 *   data/classification/extension-2019-2022/final-labels.json   378 labels on the current tree
 *   data/source-manifest-extension-2019-2022.json, data/extension-2019-clean-sources.json
 *                                              source URLs; 2019 crops come from clean cienotes copies
 *
 * Writes src/data/igcse-computer-science-0478-taxonomy.json (student-facing tree), the candidate
 * runtime and a metadata-only private index. The runtime stays a candidate until the R2 upload
 * receipt exists and `generate-igcse-release.mjs --finalize` seals it.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const BANK = "igcse-computer-science-0478";
export const COURSE = "Cambridge IGCSE Computer Science 0478";
export const RIGHTS_STATUS = "user_attested_rights_authorized";
export const CANDIDATE_PUBLICATION_STATUS = "authorized_production_candidate";
export const DEFAULT_SOURCE_ROOT = "/Users/sakshamgoel/Documents/ProjectsInternships/igcse-computer-science-0478-topic-practice";
export const SOURCE_SHA256 = {
  segmentation: "1219c79acf515ae8361c1f668a8476ca8063d91ad3e60249acf86d6d32636b2c",
  labels: "00eaad5c0167afac47f20f8e187ce481b9e6752a193a7e8c1b02011105b6dcb8",
  taxonomy: "a122a85f3950a3da479069f97f85655344b5d95b8cf66350dfa420330546ceb3",
  sourceManifest: "668bce70ce3eb2e6d49d3c8e0ef0eb9130bc6b791108bcab9437800836c29c68",
  extensionSegmentation: "70e6dec305359624d116f310a4321050bb087f9635a549503ec4870392975f60",
  extensionLabels: "ad3d74d158253d3777e6c484c1351e1ab34c69af4a6daffc1e0e7f04ba65c55e",
  extensionSourceManifest: "93dfc3b43fe5b4fd80d23d021d5e2805afee4b6bed9ed0ba84d1ba8126e0ac14",
  extensionCleanSources: "a4bcbb57aa4636037cb1feb24285324c745614fa873e377aa17c174567424099",
};
export const EXTENSION_LANE = "extension-2019-2022";
/** Cambridge withdrew these after the exam; the mark schemes say so. Kept out of practice. */
export const EXCLUDED_WITHDRAWN = ["0478-2023-s-22-q5", "0478-2025-s-22-q10"];
/** The pre-release task questions (old Paper 2, Section A, Q1) need material students never see. */
export const EXCLUDED_PRERELEASE = 27;
export const EXPECTED = { sourceQuestions: 876, rows: 847, papers: 105, years: "2019-2026", topics: 11, leafFilters: 31 };
/** Printed paper totals by syllabus era and paper. */
const PRINTED_TOTALS = { "2023_2028": { 1: 75, 2: 75 }, "2015_2022": { 1: 75, 2: 50 } };
const EARLIER_TOPIC_LABEL = "Earlier syllabus topics";
const SESSION_LABELS = { february_march: "March", may_june: "June", october_november: "November" };
const TAXONOMY_OUTPUT = "src/data/igcse-computer-science-0478-taxonomy.json";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function sourceRootPath(environment = process.env) {
  return environment.PASTPAPERPREP_IGCSE_COMPUTER_SCIENCE_SOURCE_ROOT?.trim() || DEFAULT_SOURCE_ROOT;
}

async function pinned(sourceRoot, relative, expected) {
  const bytes = await readFile(path.join(sourceRoot, relative));
  const actual = sha256(bytes);
  if (actual !== expected) throw new Error(`0478 source ${relative} SHA-256 ${actual} != pinned ${expected}`);
  return JSON.parse(bytes.toString("utf8"));
}

/** Student-facing tree: official topics in teaching order; topic 7 shows its approved filters. */
export function studentTaxonomy(source) {
  const topics = source.topics.map((topic) => {
    const sections = topic.code === "7"
      ? source.filter_splits.map((split) => ({ code: split.code, label: split.title, official: false }))
      : source.sections.filter((section) => section.topic === topic.code).map((section) => ({ code: section.code, label: section.title, official: true }));
    return { id: `topic-${topic.code}`, code: topic.code, label: topic.title, paper: topic.paper, sections };
  });
  // Content the 2023 syllabus dropped stays findable under one named earlier-syllabus topic.
  const earlier = source.earlier_syllabus;
  topics.push({
    id: `topic-${earlier.topic.code}`, code: earlier.topic.code, label: EARLIER_TOPIC_LABEL, paper: 1, era: earlier.era,
    sections: earlier.sections.map((section) => ({ code: section.code, label: section.title, official: false })),
  });
  return {
    artifact: "computer_science0478_student_taxonomy",
    version: "computer_science0478_source_backed_taxonomy@1",
    boardcode: "0478",
    eras: source.eras,
    note: "Topic 7 has no official subtopics; its filters are owner-approved groupings of its official learning points (2026-10-18). 2019-2022 questions (2015-2022 syllabus) are mapped onto the current tree; content the 2023 syllabus dropped sits under Earlier syllabus topics.",
    sourceTaxonomyPath: "data/classification/taxonomy.json",
    sourceTaxonomySHA256: SOURCE_SHA256.taxonomy,
    topics,
  };
}

function codeIndex(taxonomy) {
  const index = new Map();
  for (const topic of taxonomy.topics) {
    for (const section of topic.sections) index.set(section.code, { topic, section });
  }
  return index;
}

function runtimeAsset(kind, asset) {
  const match = /^assets\/(0478-\d{4}-[msw]-\d{2})\/(questions|markschemes)\/(q\d+-\d+-\d+\.webp)$/.exec(asset.path);
  if (!match || match[2] !== kind) throw new Error(`Unexpected 0478 ${kind} asset path: ${asset.path}`);
  return `${kind}/${match[1]}/${match[3]}`;
}

/** Topic codes each (era, paper) may use. The 2015-2022 Paper 1 also assessed Boolean logic and ethics. */
function allowedTopics(source, era, paperNumber) {
  if (era === "2023_2028") return new Set(source.topics.filter((topic) => topic.paper === paperNumber).map((topic) => topic.code));
  const rule = source.earlier_syllabus.paper_filters[String(paperNumber)];
  return new Set([...rule.topics, ...(rule.earlier.length ? [source.earlier_syllabus.topic.code] : [])]);
}

function toQuestion(question, paper, label, index, source, era, provenance) {
  const codes = [label.primary, ...label.secondaries];
  const allowed = allowedTopics(source, era, question.paper);
  const resolved = codes.map((code) => {
    const hit = index.get(code);
    if (!hit) throw new Error(`0478 ${question.id} uses unknown filter code ${code}`);
    if (!allowed.has(hit.topic.code)) throw new Error(`0478 ${question.id} code ${code} is outside ${era} Paper ${question.paper}`);
    return hit;
  });
  const [primary, ...secondary] = resolved;
  const session = SESSION_LABELS[question.session];
  if (!session) throw new Error(`Unknown 0478 session: ${question.session}`);
  const questionImages = question.question_images.map((asset) => runtimeAsset("questions", asset));
  const markschemeImages = question.markscheme_images.map((asset) => runtimeAsset("markschemes", asset));
  if (!questionImages.length || !markschemeImages.length) throw new Error(`0478 ${question.id} is missing crops`);
  if (!(question.marks > 0)) throw new Error(`0478 ${question.id} has no positive printed marks`);
  const subtopics = [...new Set(resolved.map((hit) => hit.section.label))];
  const component = question.id.split("-")[3];
  return {
    id: question.id,
    canonicalId: question.id,
    bankSlug: BANK,
    number: question.number,
    paper: question.paper,
    year: question.year,
    session,
    zone: `Variant ${question.variant}`,
    component,
    courseEra: era,
    era,
    subject: "Computer Science",
    course: COURSE,
    primaryTopic: primary.topic.label,
    primaryTopicId: primary.topic.id,
    secondaryTopics: [...new Set(secondary.map((hit) => hit.topic.label))].filter((topic) => topic !== primary.topic.label),
    secondaryTopicIds: [...new Set(secondary.map((hit) => hit.topic.id))].filter((id) => id !== primary.topic.id),
    subtopics,
    detailedSubtopics: subtopics,
    secondarySubtopics: subtopics.slice(1),
    skills: [],
    assessmentObjectives: [],
    marks: question.marks,
    maxMarks: paper.printed_total,
    marksSource: "printed_question_paper",
    summary: question.text.slice(0, 220),
    accessibleText: question.text,
    questionImages,
    markschemeImages,
    questionImageHashes: question.question_images.map((asset) => asset.sha256),
    markschemeImageHashes: question.markscheme_images.map((asset) => asset.sha256),
    officialMarkscheme: { images: markschemeImages, imageHashes: question.markscheme_images.map((asset) => asset.sha256) },
    officialCodeRefs: resolved.map((hit, i) => `${hit.topic.era ?? "2023_2028"}:${codes[i]}`),
    sourceQuestionUrl: provenance.question,
    sourceMarkSchemeUrl: provenance.markscheme,
    sourceType: "actual_past_paper",
    sourceId: question.id,
    publicationStatus: CANDIDATE_PUBLICATION_STATUS,
    classificationReviewStatus: "candidate_not_approved",
    classificationProvenance: {
      selectedSource: "final-labels",
      labelSource: label.source,
      primaryCode: label.primary,
      secondaryCodes: label.secondaries,
      taxonomyPath: TAXONOMY_OUTPUT,
    },
    marks_ready: true,
    rightsStatus: RIGHTS_STATUS,
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
  const segmentation = await pinned(sourceRoot, "data/segmentation/full/segmentation.json", SOURCE_SHA256.segmentation);
  const finalLabels = await pinned(sourceRoot, "data/classification/final-labels.json", SOURCE_SHA256.labels);
  const sourceTaxonomy = await pinned(sourceRoot, "data/classification/taxonomy.json", SOURCE_SHA256.taxonomy);
  const sourceManifest = await pinned(sourceRoot, "data/source-manifest.json", SOURCE_SHA256.sourceManifest);
  const extensionSegmentation = await pinned(sourceRoot, `data/segmentation/${EXTENSION_LANE}/segmentation.json`, SOURCE_SHA256.extensionSegmentation);
  const extensionLabels = await pinned(sourceRoot, `data/classification/${EXTENSION_LANE}/final-labels.json`, SOURCE_SHA256.extensionLabels);
  const extensionManifest = await pinned(sourceRoot, `data/source-manifest-${EXTENSION_LANE}.json`, SOURCE_SHA256.extensionSourceManifest);
  const cleanSources = await pinned(sourceRoot, "data/extension-2019-clean-sources.json", SOURCE_SHA256.extensionCleanSources);
  // 2019 crops were cut from clean copies, so their provenance links point at those copies.
  const sourceUrl = (manifest, paperId, kind) => cleanSources.files[`${paperId}/${kind}`]?.accepted.url ?? manifest.papers[paperId][kind].canonical_exact_url;
  const taxonomy = studentTaxonomy(sourceTaxonomy);
  const taxonomySerialized = `${JSON.stringify(taxonomy, null, 2)}\n`;
  const index = codeIndex(taxonomy);
  if (taxonomy.topics.length !== EXPECTED.topics || index.size !== EXPECTED.leafFilters) throw new Error("0478 taxonomy shape drifted");

  const lanes = [
    { era: "2015_2022", segmentation: extensionSegmentation, labels: extensionLabels, manifest: extensionManifest },
    { era: "2023_2028", segmentation, labels: finalLabels, manifest: sourceManifest },
  ];
  const labels = new Map(lanes.flatMap((lane) => lane.labels.labels.map((label) => [label.id, label])));
  const sourceQuestions = lanes.flatMap((lane) => lane.segmentation.papers.flatMap((paper) => paper.questions.map((question) => ({ lane, paper, question }))));
  if (sourceQuestions.length !== EXPECTED.sourceQuestions) throw new Error(`0478 source questions ${sourceQuestions.length} != ${EXPECTED.sourceQuestions}`);
  const excluded = sourceQuestions.filter(({ question }) => question.excluded_from_practice).map(({ question }) => question);
  const withdrawn = excluded.filter((question) => question.marks_status !== "prerelease_skipped").map((question) => question.id).sort();
  if (JSON.stringify(withdrawn) !== JSON.stringify(EXCLUDED_WITHDRAWN)) throw new Error(`0478 withdrawn set drifted: ${withdrawn}`);
  const prerelease = excluded.filter((question) => question.marks_status === "prerelease_skipped");
  if (prerelease.length !== EXCLUDED_PRERELEASE || prerelease.some((question) => question.paper !== 2 || question.number !== 1 || question.year > 2022)) {
    throw new Error(`0478 pre-release exclusions drifted: ${prerelease.map((question) => question.id)}`);
  }

  const questions = [];
  for (const { lane, paper, question } of sourceQuestions) {
    if (question.excluded_from_practice) continue;
    if (paper.printed_total !== PRINTED_TOTALS[lane.era][question.paper]) throw new Error(`0478 ${paper.paper_id} printed total ${paper.printed_total}`);
    const label = labels.get(question.id);
    if (!label) throw new Error(`0478 ${question.id} has no final label`);
    const provenance = { question: sourceUrl(lane.manifest, paper.paper_id, "question_paper"), markscheme: sourceUrl(lane.manifest, paper.paper_id, "mark_scheme") };
    questions.push(toQuestion(question, paper, label, index, sourceTaxonomy, lane.era, provenance));
  }
  if (questions.length !== EXPECTED.rows || labels.size !== EXPECTED.rows) throw new Error(`0478 rows ${questions.length} != ${EXPECTED.rows}`);
  if (new Set(questions.map((question) => question.id)).size !== questions.length) throw new Error("0478 question ids are not unique");
  const papers = new Set(questions.map((question) => question.id.replace(/-q\d+$/, "")));
  if (papers.size !== EXPECTED.papers) throw new Error(`0478 papers ${papers.size} != ${EXPECTED.papers}`);
  const years = questions.map((question) => question.year);
  const yearRange = `${Math.min(...years)}-${Math.max(...years)}`;
  if (yearRange !== EXPECTED.years) throw new Error(`0478 years ${yearRange}`);
  const usedFilters = new Set(questions.flatMap((question) => question.subtopics));
  if (usedFilters.size !== EXPECTED.leafFilters) throw new Error(`0478 only ${usedFilters.size} of ${EXPECTED.leafFilters} filters have questions`);

  const taxonomyFileSha = sha256(taxonomySerialized);
  const artifact = {
    version: `igcse-computer-science-0478-full${questions.length}-v1`,
    releaseStatus: CANDIDATE_PUBLICATION_STATUS,
    rightsStatus: RIGHTS_STATUS,
    sourceType: "actual_past_paper",
    specimenQuestionsIncluded: false,
    liveOnlyUnderReleaseGate: true,
    years: yearRange,
    paperCount: papers.size,
    questionCount: questions.length,
    marks_ready: true,
    sourceCandidate: {
      paths: ["data/classification/final-labels.json", `data/classification/${EXTENSION_LANE}/final-labels.json`],
      sha256: [SOURCE_SHA256.labels, SOURCE_SHA256.extensionLabels],
      questionCount: questions.length,
    },
    taxonomy: { path: TAXONOMY_OUTPUT, version: taxonomy.version, sha256: taxonomyFileSha },
    questions,
    publicationStatus: CANDIDATE_PUBLICATION_STATUS,
    assetVerification: "pending_upload",
    runtimeArtifact: {
      schemaVersion: "igcse-production-runtime-v1",
      sourceRepository: "igcse-computer-science-0478-topic-practice",
      sourceSha256: SOURCE_SHA256,
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
      marksRepairUnresolvedCount: 0,
      excludedWithdrawn: EXCLUDED_WITHDRAWN,
      excludedPrerelease: prerelease.map((question) => question.id),
      originalCandidateRuntimeSha256: null,
      runtimeSha256: null,
    },
  };
  const seals = seal(artifact);
  return {
    artifact,
    taxonomy,
    taxonomySerialized,
    serialized: `${JSON.stringify(artifact, null, 2)}\n`,
    seals,
    report: { status: "PASS", bank: BANK, rows: questions.length, papers: papers.size, years: yearRange,
      runtimeAssetRefs: new Set(questions.flatMap((question) => [...question.questionImages, ...question.markschemeImages])).size },
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
  const built = await buildRuntime({ sourceRoot });
  await writeFile(path.join(repo, TAXONOMY_OUTPUT), built.taxonomySerialized);
  const output = path.join(repo, "src/data/production", `${BANK}.json`);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, built.serialized);
  // Metadata-only candidate private index: no answers, text or asset paths cross this boundary.
  const privateIndex = path.join(repo, "src/data/private-index", `${BANK}.json`);
  await writeFile(privateIndex, `${JSON.stringify(createPrivateIndex(built.artifact))}\n`);
  return { ...built, output, privateIndex };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const result = await writeRuntime();
  console.log(JSON.stringify({ ...result.report, seals: result.seals, output: result.output }, null, 2));
}
