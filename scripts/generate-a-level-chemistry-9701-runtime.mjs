#!/usr/bin/env node
/**
 * Build the Cambridge International AS & A Level Chemistry 9701 candidate runtime from the pinned source workspace
 * (cambridge-a-level-chemistry-9701-topic-practice, commit 7023841). Every input is SHA-256 pinned; any drift fails closed.
 *
 *   data/segmentation/full/segmentation.json   2,221 canonical questions in 123 canonical papers (P1, P2, P4)
 *   data/classification/final-labels.json      2,220 labels: primary topic, primary_subtopic, secondaries
 *   data/taxonomy/taxonomy.json                topics 1-37 (9701:2022:<n>) and 12 earlier-syllabus topics (9 used)
 *   data/canonical-manifest.json               canonical ids, exam status, alias ids, MCQ keys
 *   data/held-questions.json                   one held question (9701-2025-s-42-q5: the official MS lacks 5(c))
 *   data/crop-revisions.json                   empty at 7023841 (asserted)
 *   data/paper-facts.json                      totals and durations from the syllabus assessment overview; Paper 1
 *                                              was 60 minutes in 2020-2021 and 75 from 2022 (duration_minutes_by_era)
 *   data/source-manifest.json + acquisition-manifest.json   kept, identity-checked source files
 *   data/classification/blind-results/*.json   blind-pass transcriptions, used as accessible text
 *
 * Chemistry specifics carried into the rows:
 *   - 2020-2021 Paper 1 items 31-40 (Section B, multiple completion): the first question crop is the shared Section B
 *     key box (`shared_stimulus`), so it renders above the item. Asserted for exactly those 120 items.
 *   - w25 Papers 21/22 Q1: Cambridge withdrew Q1(c)(iii); the row keeps its printed marks and lists `removedParts`.
 *   - A Level topics 23-37 that reuse an AS topic's title (e.g. "Chemical energetics") get " (A Level)" so every topic
 *     label is unique; the app keys topics by label.
 *
 * Multiple-choice rows carry the official key, read two independent ways in the source (mark-scheme text and
 * rendered view; both must agree), as `answer` with official `answerProvenance`, the release-runtime contract
 * that src/lib/mcq-answer-letters.ts serves only with an authorized answer.
 *
 * Writes src/data/production/a-level-chemistry-9701.json, src/data/private-index/a-level-chemistry-9701.json,
 * src/data/a-level-chemistry-9701-taxonomy.json and the bank's alias ids in src/data/question-id-aliases.json.
 * The runtime stays a candidate until the owner-approved R2 upload is read back and it is finalized.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const BANK = "a-level-chemistry-9701";
export const RIGHTS_STATUS = "user_attested_rights_authorized";
export const CANDIDATE_PUBLICATION_STATUS = "authorized_production_candidate";
export const DEFAULT_SOURCE_ROOT = "/Users/sakshamgoel/Documents/ProjectsInternships/cambridge-a-level-chemistry-9701-topic-practice";
export const SOURCE_COMMIT = "7023841";
export const SOURCE_SHA256 = {
  segmentation: "d5dd1d8d2b34be9e3c49f956cf5772560421a1dfa5f449bf559c04d14df0076b",
  labels: "c186aaffccafaf2e1f4ae470e01d9ae3756277ee52eb25075bc4d88467a8e8c5",
  taxonomy: "ff38a254b79d3d769c41f394c6bcd11f697eba0a39959e4cf32c7dc9a7b09b47",
  canonicalManifest: "fa573d53704bd7fbb162d252d61abca9a4e760670eaa880d717bd63a58792d82",
  paperFacts: "ca28a7babf7378a89a529aa73aef9753bca6bb6ea5128892b7c8b04059e0b585",
  sourceManifest: "2e5c1ff89c944534f35045a72d92cf35be583aa67744560370bad7aeaf1fac36",
  acquisitionManifest: "b089b323c582571a091f0f0ed33af7ff19cd5e24e858c5059445989a39e3ce35",
  heldQuestions: "27c4b5370c9665809eb0474baa697a38f9d9d6180c510bb9bff48e92775e60f6",
  cropRevisions: "79b565a5f352bb0b9a217256377828f206155684595f6b42431b7c81631173de",
  /** SHA-256 over the sorted "<file> <sha256>" lines of every top-level blind-results/*.json file. */
  blindResults: "c9302e4ca72e3d5e8acb380be08e3f9d472dcb1f8e7942300253515399511831",
};
export const HELD = ["9701-2025-s-42-q5"];
export const EXPECTED = {
  rows: 2220, segmented: 2221, papers: 123, aliases: 381, byPaper: { 1: 1720, 2: 201, 4: 299 }, topics: 37, earlierTopics: 9,
  freeRows: 619, notSatRows: 154, years: "2020-2026", sourcePapers: 147, sharedStimulusItems: 120,
  removedParts: { "9701-2025-w-21-q1": ["1(c)(iii)"], "9701-2025-w-22-q1": ["1(c)(iii)"] },
};
export const TAXONOMY_OUTPUT = "src/data/a-level-chemistry-9701-taxonomy.json";
export const ALIASES_OUTPUT = "src/data/question-id-aliases.json";
export const ALIAS_NOTE_9701 = "A Level Chemistry 9701: a variant that reprints another variant of the same series maps to the canonical question, from the source workspace's frozen canonical manifest.";
const SESSION_LABELS = { february_march: "March", may_june: "June", october_november: "November" };
const SERIES_CODES = { february_march: "m", may_june: "s", october_november: "w" };
const PAPERS = new Set([1, 2, 4]);
const COURSE = "Cambridge International AS & A Level Chemistry 9701";
/** Paper 1 Section B (multiple completion, items 31-40) existed until the 2022 revision. */
const isSectionBItem = (question) => question.paper === 1 && question.year <= 2021 && question.number >= 31;

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function sourceRootPath(environment = process.env) {
  return environment.PASTPAPERPREP_A_LEVEL_CHEMISTRY_SOURCE_ROOT?.trim() || DEFAULT_SOURCE_ROOT;
}

async function pinned(sourceRoot, relative, expected) {
  const bytes = await readFile(path.join(sourceRoot, relative));
  const actual = sha256(bytes);
  if (actual !== expected) throw new Error(`9701 source ${relative} SHA-256 ${actual} != pinned ${expected}`);
  return JSON.parse(bytes.toString("utf8"));
}

export async function blindTranscripts(sourceRoot) {
  const directory = path.join(sourceRoot, "data/classification/blind-results");
  const files = (await readdir(directory, { withFileTypes: true })).filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => entry.name).sort();
  const lines = [];
  const transcripts = new Map();
  for (const file of files) {
    const bytes = await readFile(path.join(directory, file));
    lines.push(`${file} ${sha256(bytes)}`);
    for (const row of JSON.parse(bytes.toString("utf8")).rows ?? []) {
      if (typeof row.transcript !== "string" || !row.transcript.trim()) continue;
      if (transcripts.has(row.id)) throw new Error(`9701 ${row.id} has more than one blind transcript`);
      transcripts.set(row.id, row.transcript.trim());
    }
  }
  return { pin: sha256(`${lines.join("\n")}\n`), transcripts };
}

/** Unique student-facing labels: A Level topics that reuse an AS title say so. */
export function topicLabels(source) {
  const asTitles = new Set(source.topics.filter((entry) => entry.level === "AS").map((entry) => entry.title));
  const labels = new Map();
  for (const entry of source.topics) labels.set(entry.code, entry.level === "A Level" && asTitles.has(entry.title) ? `${entry.title} (A Level)` : entry.title);
  for (const entry of source.earlier_syllabus_topics) labels.set(entry.code, entry.title);
  if (new Set(labels.values()).size !== labels.size) throw new Error("9701 topic labels are not unique");
  return labels;
}

/** Student taxonomy: topics 1-37 (with subtopics), then the used earlier-syllabus topics; question counts per topic. */
export function studentTaxonomy(source, used, labels) {
  const topic = (entry, earlier) => ({
    id: entry.id, code: entry.code, label: labels.get(entry.code), syllabusTitle: entry.title, level: entry.level, era: entry.era, earlierSyllabus: earlier, official: true,
    questions: used.get(entry.id) ?? 0,
    subtopics: (entry.subtopics ?? []).map((subtopic) => ({ code: subtopic.code, label: subtopic.title })),
  });
  const earlier = source.earlier_syllabus_topics.filter((entry) => used.has(entry.id));
  const topics = [...source.topics.map((entry) => topic(entry, false)), ...earlier.map((entry) => topic(entry, true))];
  if (source.topics.length !== EXPECTED.topics || earlier.length !== EXPECTED.earlierTopics) throw new Error("9701 taxonomy shape drifted");
  return {
    artifact: "a_level_chemistry_9701_student_taxonomy",
    version: source.version,
    qualification: "9701",
    note: "Topics 1-37 of the 2022 revision in syllabus order (AS 1-22, A Level 23-37; A Level topics that share an AS title say \"(A Level)\"), then the content it removed as named earlier-syllabus topics (2020-2021 papers only; the 3 with no question are left out). Each paper is its own tab; P1/P2 carry AS topics, P4 any topic.",
    sourceTaxonomyPath: "data/taxonomy/taxonomy.json",
    sourceTaxonomySHA256: SOURCE_SHA256.taxonomy,
    topics,
  };
}

function runtimeAsset(kind, asset, paperId) {
  const match = /^assets\/(9701-20\d{2}-[msw]-\d{2})\/(questions|markschemes)\/(q\d+-\d+-\d+(?:\.v\d+)?\.webp)$/.exec(asset.path);
  if (!match || match[2] !== kind || match[1] !== paperId) throw new Error(`Unexpected 9701 ${kind} asset path: ${asset.path}`);
  return `${kind}/${match[1]}/${match[3]}`;
}

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
  const sourceTaxonomy = await pinned(sourceRoot, "data/taxonomy/taxonomy.json", SOURCE_SHA256.taxonomy);
  const canonical = await pinned(sourceRoot, "data/canonical-manifest.json", SOURCE_SHA256.canonicalManifest);
  const paperFacts = await pinned(sourceRoot, "data/paper-facts.json", SOURCE_SHA256.paperFacts);
  await pinned(sourceRoot, "data/source-manifest.json", SOURCE_SHA256.sourceManifest);
  const acquisition = await pinned(sourceRoot, "data/acquisition-manifest.json", SOURCE_SHA256.acquisitionManifest);
  const held = await pinned(sourceRoot, "data/held-questions.json", SOURCE_SHA256.heldQuestions);
  const cropRevisions = await pinned(sourceRoot, "data/crop-revisions.json", SOURCE_SHA256.cropRevisions);
  const blind = await blindTranscripts(sourceRoot);
  if (blind.pin !== SOURCE_SHA256.blindResults) throw new Error(`9701 blind results ${blind.pin} != pinned ${SOURCE_SHA256.blindResults}`);
  if (JSON.stringify(Object.keys(held.questions).sort()) !== JSON.stringify(HELD)) throw new Error("9701 held set drifted");
  if (Object.keys(cropRevisions.revisions).length) throw new Error("9701 crop revisions appeared; review before building");
  if (finalLabels.labels.some((label) => HELD.includes(label.id))) throw new Error("9701 a held question has a final label");

  if (!canonical.frozen || canonical.canonical_questions.length !== EXPECTED.segmented) throw new Error("9701 canonical manifest drifted");
  const canonicalById = new Map(canonical.canonical_questions.map((question) => [question.id, question]));
  const labels = new Map(finalLabels.labels.map((label) => [label.id, label]));
  if (labels.size !== EXPECTED.rows || finalLabels.labels.length !== EXPECTED.rows) throw new Error("9701 labels do not cover the release once each");
  const topicsByCode = new Map([...sourceTaxonomy.topics, ...sourceTaxonomy.earlier_syllabus_topics].map((entry) => [entry.code, entry]));
  const subtopicsByCode = new Map(sourceTaxonomy.topics.flatMap((entry) => entry.subtopics.map((subtopic) => [subtopic.code, { ...subtopic, topic: entry.code }])));
  const labelFor = topicLabels(sourceTaxonomy);

  const sourceQuestions = segmentation.papers.flatMap((paper) => paper.questions.map((question) => ({ paper, question })));
  if (segmentation.papers.length !== EXPECTED.papers || sourceQuestions.length !== EXPECTED.segmented) throw new Error(`9701 segmentation ${sourceQuestions.length} questions in ${segmentation.papers.length} papers`);
  if (JSON.stringify(sourceQuestions.map(({ question }) => question.id).sort()) !== JSON.stringify([...canonicalById.keys()].sort())) throw new Error("9701 segmentation ids differ from the frozen canonical set");

  if (acquisition.pair_count !== EXPECTED.sourcePapers || acquisition.document_count !== EXPECTED.sourcePapers * 2) throw new Error("9701 acquisition manifest drifted");
  const sourceUrl = (paperId, kind) => {
    const url = acquisition.papers[paperId]?.[kind]?.final_url;
    if (typeof url !== "string" || !url.startsWith("https://")) throw new Error(`9701 ${paperId} ${kind} has no kept source file`);
    return url;
  };

  const p1Durations = paperFacts.papers["1"].duration_minutes_by_era;
  if (p1Durations?.["2019-2021"] !== 60 || p1Durations?.["2022+"] !== 75) throw new Error("9701 Paper 1 durations by era drifted");

  const questions = [];
  const used = new Map();
  let sharedStimulusItems = 0;
  for (const { paper, question } of sourceQuestions) {
    if (HELD.includes(question.id)) {
      if (!question.held || labels.has(question.id)) throw new Error(`9701 held question ${question.id} is not held in the source`);
      continue;
    }
    if (question.held || question.excluded_from_practice) throw new Error(`9701 ${question.id} is held or excluded outside the held set`);
    const label = labels.get(question.id);
    const entry = canonicalById.get(question.id);
    if (!label) throw new Error(`9701 ${question.id} has no final label`);
    if (!PAPERS.has(question.paper) || label.paper !== question.paper || entry.paper_number !== question.paper) throw new Error(`9701 ${question.id} paper mismatch`);
    const facts = paperFacts.papers[String(question.paper)];
    if (!facts || paper.printed_total !== facts.total_marks) throw new Error(`9701 ${paper.paper_id} printed total ${paper.printed_total} != syllabus ${facts?.total_marks}`);
    if (entry.printed_marks !== question.marks || !(question.marks > 0)) throw new Error(`9701 ${question.id} marks drifted`);
    const mcq = question.format === "multiple_choice";
    if (mcq !== (question.paper === 1) || label.format !== question.format || entry.format !== question.format) throw new Error(`9701 ${question.id} format ${question.format}`);
    if (mcq && (question.marks !== 1 || !/^[ABCD]$/.test(question.mcq_key ?? "") || question.mcq_key !== question.mcq_key_text || entry.mcq_key !== question.mcq_key)) throw new Error(`9701 ${question.id} MCQ key reads disagree`);
    const expectedRemoved = EXPECTED.removedParts[question.id] ?? [];
    if (JSON.stringify(question.removed_parts) !== JSON.stringify(expectedRemoved)) throw new Error(`9701 ${question.id} removed parts ${JSON.stringify(question.removed_parts)}`);
    if (expectedRemoved.length && question.marks_status !== "official_part_removed") throw new Error(`9701 ${question.id} marks status ${question.marks_status}`);
    const codes = [label.primary, ...label.secondaries];
    if (new Set(codes).size !== codes.length) throw new Error(`9701 ${question.id} repeats a label`);
    const resolved = codes.map((code) => {
      const topic = topicsByCode.get(code);
      if (!topic) throw new Error(`9701 ${question.id} uses unknown topic ${code}`);
      if (topic.era === "2019" && question.year > 2021) throw new Error(`9701 ${question.id} carries an earlier-syllabus topic after 2021`);
      return topic;
    });
    let subtopics = [];
    if (label.primary_subtopic !== null) {
      const subtopic = subtopicsByCode.get(label.primary_subtopic);
      if (!subtopic || subtopic.topic !== label.primary) throw new Error(`9701 ${question.id} subtopic ${label.primary_subtopic} is not under ${label.primary}`);
      subtopics = [subtopic.title];
    } else if (resolved[0].era !== "2019") throw new Error(`9701 ${question.id} has no subtopic under a current topic`);
    const session = SESSION_LABELS[question.session];
    if (!session || SERIES_CODES[question.session] !== entry.series_code) throw new Error(`9701 ${question.id} session ${question.session}`);
    const component = paper.paper_id.split("-")[3];
    if (component !== `${question.paper}${question.variant}` || entry.component !== component) throw new Error(`9701 ${question.id} component ${component}`);
    const notSat = entry.exam_status === "released_not_sat";
    if (notSat !== (question.year === 2020 && question.session === "may_june") || !["sat", "released_not_sat"].includes(entry.exam_status)) throw new Error(`9701 ${question.id} exam status ${entry.exam_status}`);
    for (const alias of entry.alias_ids) if (canonical.aliases[alias]?.canonical_id !== question.id) throw new Error(`9701 alias ${alias} does not resolve to ${question.id}`);
    const transcript = blind.transcripts.get(question.id);
    if (!transcript) throw new Error(`9701 ${question.id} has no blind transcript`);
    // Section B items: the shared key box first, then the item; no other crop is a shared stimulus.
    const stimulus = question.question_images.map((asset) => asset.shared_stimulus ?? null);
    const expectedStimulus = isSectionBItem(question) ? ["section_b_instructions", ...stimulus.slice(1).map(() => null)] : stimulus.map(() => null);
    if (JSON.stringify(stimulus) !== JSON.stringify(expectedStimulus) || (isSectionBItem(question) && stimulus.length < 2)) throw new Error(`9701 ${question.id} shared stimulus ${JSON.stringify(stimulus)}`);
    if (question.markscheme_images.some((asset) => asset.shared_stimulus)) throw new Error(`9701 ${question.id} mark scheme crop marked as shared stimulus`);
    if (isSectionBItem(question)) sharedStimulusItems += 1;
    const questionImages = question.question_images.map((asset) => runtimeAsset("questions", asset, paper.paper_id));
    const markschemeImages = question.markscheme_images.map((asset) => runtimeAsset("markschemes", asset, paper.paper_id));
    if (!questionImages.length || !markschemeImages.length) throw new Error(`9701 ${question.id} is missing crops`);
    for (const topic of resolved) used.set(topic.id, (used.get(topic.id) ?? 0) + 1);
    const [primary, ...secondaries] = resolved;
    const era = question.year <= 2021 ? "2019" : "2022";
    questions.push({
      id: question.id,
      canonicalId: question.id,
      aliasIds: [...entry.alias_ids],
      bankSlug: BANK,
      paperId: paper.paper_id,
      number: question.number,
      paper: question.paper,
      year: question.year,
      session,
      examStatus: entry.exam_status,
      format: question.format,
      zone: `Variant ${question.variant}`,
      component,
      courseEra: era,
      era,
      subject: "Chemistry",
      course: COURSE,
      primaryTopic: labelFor.get(primary.code),
      primaryTopicId: primary.id,
      secondaryTopics: secondaries.map((topic) => labelFor.get(topic.code)),
      secondaryTopicIds: secondaries.map((topic) => topic.id),
      subtopics,
      detailedSubtopics: subtopics,
      secondarySubtopics: [],
      skills: [],
      assessmentObjectives: [],
      marks: question.marks,
      maxMarks: facts.total_marks,
      marksSource: "printed_question_paper",
      ...(expectedRemoved.length ? { removedParts: [...expectedRemoved] } : {}),
      ...(mcq ? { answer: question.mcq_key, answerProvenance: { status: "official", questionId: question.id, keyReads: { markSchemeText: question.mcq_key_text, renderedView: question.mcq_key } } } : {}),
      summary: transcript.slice(0, 220),
      accessibleText: transcript,
      questionImages,
      markschemeImages,
      questionImageHashes: question.question_images.map((asset) => asset.sha256),
      markschemeImageHashes: question.markscheme_images.map((asset) => asset.sha256),
      ...(isSectionBItem(question) ? { sharedStimulusImages: [questionImages[0]] } : {}),
      officialMarkscheme: { images: markschemeImages, imageHashes: question.markscheme_images.map((asset) => asset.sha256) },
      officialCodeRefs: resolved.map((topic) => topic.id),
      sourceQuestionUrl: sourceUrl(paper.paper_id, "question_paper"),
      sourceMarkSchemeUrl: sourceUrl(paper.paper_id, "mark_scheme"),
      sourceType: "actual_past_paper",
      sourceId: question.id,
      publicationStatus: CANDIDATE_PUBLICATION_STATUS,
      classificationReviewStatus: "candidate_not_approved",
      classificationProvenance: {
        selectedSource: "final-labels",
        labelSource: label.source,
        primaryCode: label.primary,
        primarySubtopic: label.primary_subtopic,
        secondaryCodes: [...label.secondaries],
        markAllocation: label.mark_allocation,
        taxonomyPath: TAXONOMY_OUTPUT,
      },
      marks_ready: true,
      rightsStatus: RIGHTS_STATUS,
    });
  }

  if (questions.length !== EXPECTED.rows || new Set(questions.map((question) => question.id)).size !== EXPECTED.rows) throw new Error(`9701 rows ${questions.length}`);
  for (const [paper, count] of Object.entries(EXPECTED.byPaper)) if (questions.filter((question) => question.paper === Number(paper)).length !== count) throw new Error(`9701 Paper ${paper} count drifted`);
  const papers = new Set(questions.map((question) => question.paperId));
  if (papers.size !== EXPECTED.papers) throw new Error(`9701 papers ${papers.size}`);
  const years = questions.map((question) => question.year);
  const yearRange = `${Math.min(...years)}-${Math.max(...years)}`;
  if (yearRange !== EXPECTED.years) throw new Error(`9701 years ${yearRange}`);
  if (questions.filter((question) => question.year <= 2021).length !== EXPECTED.freeRows) throw new Error("9701 free-year count drifted");
  if (questions.filter((question) => question.examStatus === "released_not_sat").length !== EXPECTED.notSatRows) throw new Error("9701 not-sat count drifted");
  if (sharedStimulusItems !== EXPECTED.sharedStimulusItems) throw new Error(`9701 Section B items ${sharedStimulusItems}`);
  if (used.size !== EXPECTED.topics + EXPECTED.earlierTopics) throw new Error(`9701 topics used ${used.size}`);
  const unusedEarlier = sourceTaxonomy.earlier_syllabus_topics.filter((entry) => !used.has(entry.id)).map((entry) => entry.code).sort();
  if (JSON.stringify(unusedEarlier) !== JSON.stringify([...finalLabels.dropped_empty_earlier_syllabus_topics].sort())) throw new Error("9701 unused earlier-syllabus topics differ from the source's dropped list");

  const aliases = Object.fromEntries(questions.flatMap((question) => question.aliasIds.map((alias) => [alias, question.id])).sort(([a], [b]) => a.localeCompare(b)));
  if (Object.keys(aliases).length !== EXPECTED.aliases || Object.keys(aliases).length !== Object.keys(canonical.aliases).length) throw new Error("9701 alias count drifted");

  const taxonomy = studentTaxonomy(sourceTaxonomy, used, labelFor);
  const taxonomySerialized = `${JSON.stringify(taxonomy, null, 2)}\n`;
  const taxonomyFileSha = sha256(taxonomySerialized);

  const artifact = {
    version: `${BANK}-full${questions.length}-v1`,
    releaseStatus: CANDIDATE_PUBLICATION_STATUS,
    rightsStatus: RIGHTS_STATUS,
    sourceType: "actual_past_paper",
    specimenQuestionsIncluded: false,
    liveOnlyUnderReleaseGate: true,
    years: yearRange,
    paperCount: papers.size,
    questionCount: questions.length,
    marks_ready: true,
    paperFacts: Object.fromEntries(Object.entries(paperFacts.papers).map(([paper, facts]) => [paper, {
      name: facts.name, durationMinutes: facts.duration_minutes, totalMarks: facts.total_marks,
      ...(facts.duration_minutes_by_era ? { durationMinutesByEra: { 2019: facts.duration_minutes_by_era["2019-2021"], 2022: facts.duration_minutes_by_era["2022+"] } } : {}),
    }])),
    heldQuestionIds: [...HELD],
    sourceCandidate: { paths: ["data/classification/final-labels.json"], sha256: [SOURCE_SHA256.labels], questionCount: questions.length },
    taxonomy: { path: TAXONOMY_OUTPUT, version: taxonomy.version, sha256: taxonomyFileSha },
    questions,
    publicationStatus: CANDIDATE_PUBLICATION_STATUS,
    assetVerification: "pending_upload",
    runtimeArtifact: {
      schemaVersion: "igcse-production-runtime-v1",
      sourceRepository: "cambridge-a-level-chemistry-9701-topic-practice",
      sourceCommit: SOURCE_COMMIT,
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
      originalCandidateRuntimeSha256: null,
      runtimeSha256: null,
    },
  };
  const seals = seal(artifact);
  return {
    artifact, serialized: `${JSON.stringify(artifact, null, 2)}\n`, seals, taxonomy, taxonomySerialized, aliases,
    report: {
      status: "PASS", bank: BANK, rows: questions.length, papers: papers.size, years: yearRange, aliases: Object.keys(aliases).length,
      byPaper: EXPECTED.byPaper, freeRows: EXPECTED.freeRows, notSatRows: EXPECTED.notSatRows, held: HELD, sharedStimulusItems,
      runtimeAssetRefs: new Set(questions.flatMap((question) => [...question.questionImages, ...question.markschemeImages])).size,
    },
  };
}

export function createPrivateIndex(artifact) {
  return {
    version: 1,
    bank: BANK,
    questions: artifact.questions.map((question) => ({
      id: question.id, number: question.number, paper: question.paper, year: question.year, session: question.session,
      primaryTopic: question.primaryTopic, secondaryTopics: [...question.secondaryTopics], skills: [...question.skills],
      subtopics: [...question.subtopics], subject: question.subject, zone: question.zone, component: question.component, marks: question.marks,
    })),
  };
}

export function withBankAliases(file, aliases) {
  const note = file.note.includes(ALIAS_NOTE_9701) ? file.note : `${file.note} ${ALIAS_NOTE_9701}`;
  return { ...file, note, banks: { ...file.banks, [BANK]: aliases } };
}

export async function writeRuntime({ repo = path.resolve(import.meta.dirname, ".."), sourceRoot = sourceRootPath() } = {}) {
  const built = await buildRuntime({ sourceRoot });
  await writeFile(path.join(repo, TAXONOMY_OUTPUT), built.taxonomySerialized);
  const output = path.join(repo, "src/data/production", `${BANK}.json`);
  await writeFile(output, built.serialized);
  const privateIndex = path.join(repo, "src/data/private-index", `${BANK}.json`);
  await mkdir(path.dirname(privateIndex), { recursive: true });
  await writeFile(privateIndex, `${JSON.stringify(createPrivateIndex(built.artifact))}\n`);
  const aliasPath = path.join(repo, ALIASES_OUTPUT);
  const aliasFile = JSON.parse(await readFile(aliasPath, "utf8"));
  await writeFile(aliasPath, `${JSON.stringify(withBankAliases(aliasFile, built.aliases), null, 1)}\n`);
  return { ...built, output, privateIndex };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  if (process.argv.includes("--print-blind-pin")) {
    console.log((await blindTranscripts(sourceRootPath())).pin);
  } else {
    const result = await writeRuntime();
    console.log(JSON.stringify({ ...result.report, seals: result.seals, output: result.output }, null, 2));
  }
}
