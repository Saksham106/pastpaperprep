#!/usr/bin/env node
/**
 * Build the Cambridge International AS & A Level Biology 9700 candidate runtime from the pinned source workspace
 * (cambridge-a-level-biology-9700-topic-practice, commit 1c68c4d; data as at 314703b plus the reviewed secondary-subtopic overlay). Every input is SHA-256 pinned; any drift fails closed.
 *
 *   data/segmentation/full/segmentation.json   2,684 canonical questions in 141 canonical papers (P1, P2, P4)
 *   data/classification/final-labels.json      2,680 labels: primary topic, primary_subtopic, secondaries
 *   data/taxonomy/taxonomy.json                topics 1-19 (9700:2022:<n>) and 10 earlier-syllabus topics (8 used)
 *   data/canonical-manifest.json               canonical ids, exam status, alias ids, MCQ keys, choice groups
 *   data/held-questions.json                   one held question (9700-2025-s-44-q2: Fig. 2.1 removed for copyright)
 *   data/crop-revisions.json                   empty (asserted)
 *   data/paper-facts.json                      totals and durations from the syllabus assessment overview; Paper 1
 *                                              was 60 minutes in 2020-2021 and 75 from 2022 (duration_minutes_by_era)
 *   data/source-manifest.json + acquisition-manifest.json   kept, identity-checked source files
 *   data/classification/blind-results/*.json   blind-pass transcriptions, used as accessible text
 *   data/classification/transcript-corrections.json   5 transcripts that wrote α/β as "a-"/"b-"; applied here
 *   data/classification/secondary-subtopics.json      reviewed overlay (owner review of PR #499): the subtopic sections
 *                                              each current secondary topic materially assesses, and any further
 *                                              section of the primary topic, with mark evidence
 *
 * Biology specifics carried into the rows:
 *   - Three multiple-choice items Cambridge discounted ("Question discounted", no key) are excluded from practice:
 *     9700-2021-w-13-q7, 9700-2023-w-11-q27, 9700-2023-w-11-q35. They are not rows and not in the upload plan.
 *   - 2020-2021 Paper 4 Section B is an essay choice: Q9 and Q10 (15 marks each), candidates answer one. Both are
 *     served as normal questions and carry `choiceGroup: "section_b_answer_one"` (24 rows, asserted).
 *   - No structured part was withdrawn, so there are no removedParts and no scoreable-marks overlay entries.
 *   - Subtopics: the primary subtopic first, then the reviewed further sections in syllabus order (`subtopics`,
 *     `detailedSubtopics`); the further sections alone are `secondarySubtopics`. Every current secondary topic has at
 *     least one section; earlier-syllabus topics have none.
 *
 * Multiple-choice rows carry the official key, read two independent ways in the source (mark-scheme text and
 * rendered view; both must agree), as `answer` with official `answerProvenance`, the release-runtime contract
 * that src/lib/mcq-answer-letters.ts serves only with an authorized answer.
 *
 * Writes src/data/production/a-level-biology-9700.json, src/data/private-index/a-level-biology-9700.json,
 * src/data/a-level-biology-9700-taxonomy.json and the bank's alias ids in src/data/question-id-aliases.json.
 * The runtime stays a candidate until the owner-approved R2 upload is read back and it is finalized.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const BANK = "a-level-biology-9700";
export const RIGHTS_STATUS = "user_attested_rights_authorized";
export const CANDIDATE_PUBLICATION_STATUS = "authorized_production_candidate";
export const DEFAULT_SOURCE_ROOT = "/Users/sakshamgoel/Documents/ProjectsInternships/cambridge-a-level-biology-9700-topic-practice";
export const SOURCE_COMMIT = "1c68c4d";
export const SOURCE_SHA256 = {
  segmentation: "5fd427d072629603e3b340b3c98812f9b25e994120b607a17775fdaea3d8f9b7",
  labels: "e7807343676b4cca97d6ae3e45fc58bacce7556590bd9fc31d08e5e3f567729c",
  taxonomy: "c70fb5b1c91aebff826fee62b7d9630c2f8ebf2429cd89258040c07947aea3a4",
  canonicalManifest: "d5ffbdd09adc041f53eeea3dc4026f05aad86c4ab56ad226742ff637b3bc564b",
  paperFacts: "3e1d04286a1a30a63e7f6c025a73df667986d42133c9e35ccef6034d731ac825",
  sourceManifest: "e58afcc8963e0efb11220faa01a4ea1d3997b8e5d645e99e7baceed6c1599f43",
  acquisitionManifest: "c8dff241fc7e32c9d54fcce824856773959b097941ab186f8f9997a9055fe6c4",
  heldQuestions: "730e7e21e8892d7f712a6dccfff468455e0c7fbceb05c78fa5b807fddf7be407",
  cropRevisions: "06a2c300f9be42b1a9602180c547a9a0598f82c531da87bbcebe34c0b19c48f5",
  transcriptCorrections: "b66821cfb32c03e876475b3bc16195f2583f308392b9e98b051a843af195adc8",
  secondarySubtopics: "2057e9bf6273a7f536befc296f7ca798de15cbfbf49906b786356aabb86f0cda",
  /** SHA-256 over the sorted "<file> <sha256>" lines of every top-level blind-results/*.json file. */
  blindResults: "5c0681cd6fe56ba20b06bae86de49560c9320bc0f7e2758840a1e6c233ff0d25",
};
export const HELD = ["9700-2025-s-44-q2"];
export const EXCLUDED = ["9700-2021-w-13-q7", "9700-2023-w-11-q27", "9700-2023-w-11-q35"];
export const CHOICE_GROUP = "section_b_answer_one";
export const EXPECTED = {
  rows: 2680, segmented: 2684, papers: 141, aliases: 60, byPaper: { 1: 1957, 2: 294, 4: 429 }, topics: 19, earlierTopics: 8,
  freeRows: 763, notSatRows: 168, years: "2020-2026", sourcePapers: 147, choiceGroupRows: 24, transcriptCorrections: 5,
};
export const TAXONOMY_OUTPUT = "src/data/a-level-biology-9700-taxonomy.json";
export const ALIASES_OUTPUT = "src/data/question-id-aliases.json";
export const ALIAS_NOTE_9700 = "A Level Biology 9700: a variant that reprints another variant of the same series maps to the canonical question, from the source workspace's frozen canonical manifest.";
const SESSION_LABELS = { february_march: "March", may_june: "June", october_november: "November" };
const SERIES_CODES = { february_march: "m", may_june: "s", october_november: "w" };
const PAPERS = new Set([1, 2, 4]);
const COURSE = "Cambridge International AS & A Level Biology 9700";
const GREEK = { a: "α", b: "β" };
/** 2020-2021 Paper 4 Section B: Q9 or Q10, one 15-mark essay answered. */
const isSectionBChoice = (question) => question.paper === 4 && question.year <= 2021 && (question.number === 9 || question.number === 10);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function sourceRootPath(environment = process.env) {
  return environment.PASTPAPERPREP_A_LEVEL_BIOLOGY_SOURCE_ROOT?.trim() || DEFAULT_SOURCE_ROOT;
}

async function pinned(sourceRoot, relative, expected) {
  const bytes = await readFile(path.join(sourceRoot, relative));
  const actual = sha256(bytes);
  if (actual !== expected) throw new Error(`9700 source ${relative} SHA-256 ${actual} != pinned ${expected}`);
  return JSON.parse(bytes.toString("utf8"));
}

export async function blindTranscripts(sourceRoot) {
  const directory = path.join(sourceRoot, "data/classification/blind-results");
  const files = (await readdir(directory, { withFileTypes: true })).filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => entry.name).sort();
  const lines = [];
  const fileShas = {};
  const transcripts = new Map();
  for (const file of files) {
    const bytes = await readFile(path.join(directory, file));
    fileShas[file] = sha256(bytes);
    lines.push(`${file} ${fileShas[file]}`);
    for (const row of JSON.parse(bytes.toString("utf8")).rows ?? []) {
      if (typeof row.transcript !== "string" || !row.transcript.trim()) continue;
      if (transcripts.has(row.id)) throw new Error(`9700 ${row.id} has more than one blind transcript`);
      transcripts.set(row.id, row.transcript.trim());
    }
  }
  return { pin: sha256(`${lines.join("\n")}\n`), fileShas, transcripts };
}

/**
 * Apply the source's reviewed transcript corrections: each listed "a-"/"b-" hyphenation becomes α-/β-, in order,
 * and the result must equal the corrected transcript the source recorded. Fails closed on any difference.
 */
export function correctedTranscripts(blind, corrections) {
  if (JSON.stringify(corrections.blind_results_sha256) !== JSON.stringify(blind.fileShas)) throw new Error("9700 transcript corrections were made against different blind results");
  const transcripts = new Map(blind.transcripts);
  for (const [id, row] of Object.entries(corrections.rows)) {
    const original = transcripts.get(id);
    if (!original || !row.replacements.length) throw new Error(`9700 transcript correction ${id} has no blind transcript`);
    let corrected = original;
    for (const replacement of row.replacements) {
      if (!/^[ab]-/.test(replacement) || !corrected.includes(replacement)) throw new Error(`9700 ${id} correction ${replacement} not found`);
      corrected = corrected.replace(replacement, `${GREEK[replacement[0]]}${replacement.slice(1)}`);
    }
    if (corrected !== row.transcript.trim()) throw new Error(`9700 ${id} corrected transcript differs from the source's`);
    transcripts.set(id, corrected);
  }
  return transcripts;
}

/** Unique student-facing labels: an A Level topic that reused an AS title would say so (none does in 9700). */
export function topicLabels(source) {
  const asTitles = new Set(source.topics.filter((entry) => entry.level === "AS").map((entry) => entry.title));
  const labels = new Map();
  for (const entry of source.topics) labels.set(entry.code, entry.level === "A Level" && asTitles.has(entry.title) ? `${entry.title} (A Level)` : entry.title);
  for (const entry of source.earlier_syllabus_topics) labels.set(entry.code, entry.title);
  if (new Set(labels.values()).size !== labels.size) throw new Error("9700 topic labels are not unique");
  return labels;
}

/** Student taxonomy: topics 1-19 (with subtopics), then the used earlier-syllabus topics; question counts per topic. */
export function studentTaxonomy(source, used, labels) {
  const topic = (entry, earlier) => ({
    id: entry.id, code: entry.code, label: labels.get(entry.code), syllabusTitle: entry.title, level: entry.level, era: entry.era, earlierSyllabus: earlier, official: true,
    questions: used.get(entry.id) ?? 0,
    subtopics: (entry.subtopics ?? []).map((subtopic) => ({ code: subtopic.code, label: subtopic.title })),
  });
  const earlier = source.earlier_syllabus_topics.filter((entry) => used.has(entry.id));
  const topics = [...source.topics.map((entry) => topic(entry, false)), ...earlier.map((entry) => topic(entry, true))];
  if (source.topics.length !== EXPECTED.topics || earlier.length !== EXPECTED.earlierTopics) throw new Error("9700 taxonomy shape drifted");
  return {
    artifact: "a_level_biology_9700_student_taxonomy",
    version: source.version,
    qualification: "9700",
    note: "Topics 1-19 of the 2022 revision in syllabus order (AS 1-11, A Level 12-19), then the content it removed as named earlier-syllabus topics (2020-2021 papers only; the 2 with no question are left out). Each paper is its own tab; P1/P2 carry AS topics, P4 any topic.",
    sourceTaxonomyPath: "data/taxonomy/taxonomy.json",
    sourceTaxonomySHA256: SOURCE_SHA256.taxonomy,
    topics,
  };
}

function runtimeAsset(kind, asset, paperId) {
  const match = /^assets\/(9700-20\d{2}-[msw]-\d{2})\/(questions|markschemes)\/(q\d+-\d+-\d+(?:\.v\d+)?\.webp)$/.exec(asset.path);
  if (!match || match[2] !== kind || match[1] !== paperId) throw new Error(`Unexpected 9700 ${kind} asset path: ${asset.path}`);
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

/**
 * The reviewed further sections of one question, in syllabus order: at least one for every current secondary topic,
 * optionally more of the primary topic (never its primary subtopic again), none for earlier-syllabus topics, and only
 * under the question's own topics. Fails closed on any other shape.
 */
export function furtherSections(id, label, entry, subtopicsByCode, topicsByCode) {
  const allowed = new Set([label.primary, ...label.secondaries]);
  for (const code of Object.keys(entry)) if (!allowed.has(code)) throw new Error(`9700 ${id} overlay names topic ${code}, which is not its primary or a secondary`);
  const codes = [];
  for (const code of [label.primary, ...label.secondaries]) {
    const topic = topicsByCode.get(code);
    const sections = entry[code]?.subtopics;
    if (topic.era === "2019") {
      if (sections !== undefined) throw new Error(`9700 ${id} overlay gives sections to earlier-syllabus topic ${code}`);
      continue;
    }
    if (sections === undefined) {
      if (code !== label.primary) throw new Error(`9700 ${id} secondary topic ${code} has no reviewed section`);
      continue;
    }
    if (!Array.isArray(sections) || !sections.length || new Set(sections).size !== sections.length || typeof entry[code].evidence !== "string" || !entry[code].evidence.trim()) throw new Error(`9700 ${id} overlay entry for ${code} is malformed`);
    for (const section of sections) {
      if (subtopicsByCode.get(section)?.topic !== code) throw new Error(`9700 ${id} section ${section} is not under topic ${code}`);
      if (code === label.primary && section === label.primary_subtopic) throw new Error(`9700 ${id} overlay repeats the primary subtopic ${section}`);
    }
    codes.push(...sections);
  }
  const order = [...subtopicsByCode.keys()];
  return [...new Set(codes)].sort((a, b) => order.indexOf(a) - order.indexOf(b));
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
  const corrections = await pinned(sourceRoot, "data/classification/transcript-corrections.json", SOURCE_SHA256.transcriptCorrections);
  const sectionOverlay = await pinned(sourceRoot, "data/classification/secondary-subtopics.json", SOURCE_SHA256.secondarySubtopics);
  const blind = await blindTranscripts(sourceRoot);
  if (blind.pin !== SOURCE_SHA256.blindResults) throw new Error(`9700 blind results ${blind.pin} != pinned ${SOURCE_SHA256.blindResults}`);
  if (Object.keys(corrections.rows).length !== EXPECTED.transcriptCorrections) throw new Error("9700 transcript corrections drifted");
  const transcripts = correctedTranscripts(blind, corrections);
  if (JSON.stringify(Object.keys(held.questions).sort()) !== JSON.stringify(HELD)) throw new Error("9700 held set drifted");
  if (Object.keys(cropRevisions.revisions).length) throw new Error("9700 crop revisions appeared; review before building");
  if (finalLabels.labels.some((label) => HELD.includes(label.id) || EXCLUDED.includes(label.id))) throw new Error("9700 a held or excluded question has a final label");

  if (!canonical.frozen || canonical.canonical_questions.length !== EXPECTED.segmented) throw new Error("9700 canonical manifest drifted");
  const canonicalById = new Map(canonical.canonical_questions.map((question) => [question.id, question]));
  const labels = new Map(finalLabels.labels.map((label) => [label.id, label]));
  if (labels.size !== EXPECTED.rows || finalLabels.labels.length !== EXPECTED.rows) throw new Error("9700 labels do not cover the release once each");
  const topicsByCode = new Map([...sourceTaxonomy.topics, ...sourceTaxonomy.earlier_syllabus_topics].map((entry) => [entry.code, entry]));
  const subtopicsByCode = new Map(sourceTaxonomy.topics.flatMap((entry) => entry.subtopics.map((subtopic) => [subtopic.code, { ...subtopic, topic: entry.code }])));
  const labelFor = topicLabels(sourceTaxonomy);

  const sourceQuestions = segmentation.papers.flatMap((paper) => paper.questions.map((question) => ({ paper, question })));
  if (segmentation.papers.length !== EXPECTED.papers || sourceQuestions.length !== EXPECTED.segmented) throw new Error(`9700 segmentation ${sourceQuestions.length} questions in ${segmentation.papers.length} papers`);
  if (JSON.stringify(sourceQuestions.map(({ question }) => question.id).sort()) !== JSON.stringify([...canonicalById.keys()].sort())) throw new Error("9700 segmentation ids differ from the frozen canonical set");

  if (acquisition.pair_count !== EXPECTED.sourcePapers || acquisition.document_count !== EXPECTED.sourcePapers * 2) throw new Error("9700 acquisition manifest drifted");
  const sourceUrl = (paperId, kind) => {
    const url = acquisition.papers[paperId]?.[kind]?.final_url;
    if (typeof url !== "string" || !url.startsWith("https://")) throw new Error(`9700 ${paperId} ${kind} has no kept source file`);
    return url;
  };

  const p1Durations = paperFacts.papers["1"].duration_minutes_by_era;
  if (p1Durations?.["2019-2021"] !== 60 || p1Durations?.["2022+"] !== 75) throw new Error("9700 Paper 1 durations by era drifted");

  const questions = [];
  const used = new Map();
  const skipped = [];
  const overlayRowsUsed = new Set();
  let choiceGroupRows = 0;
  for (const { paper, question } of sourceQuestions) {
    const entry = canonicalById.get(question.id);
    if (HELD.includes(question.id)) {
      if (!question.held || question.marks_status !== "official_qp_figure_removed" || labels.has(question.id)) throw new Error(`9700 held question ${question.id} is not held in the source`);
      skipped.push(question.id);
      continue;
    }
    if (EXCLUDED.includes(question.id)) {
      if (!question.excluded_from_practice || !entry.excluded_from_practice || question.marks_status !== "official_question_removed" || question.mcq_key !== null || labels.has(question.id)) throw new Error(`9700 excluded question ${question.id} is not a discounted item in the source`);
      skipped.push(question.id);
      continue;
    }
    if (question.held || question.excluded_from_practice || entry.excluded_from_practice) throw new Error(`9700 ${question.id} is held or excluded outside the expected sets`);
    if (!["reconciled", "reconciled_ms_cell_blank_reviewed"].includes(question.marks_status)) throw new Error(`9700 ${question.id} marks status ${question.marks_status}`);
    const label = labels.get(question.id);
    if (!label) throw new Error(`9700 ${question.id} has no final label`);
    if (!PAPERS.has(question.paper) || label.paper !== question.paper || entry.paper_number !== question.paper) throw new Error(`9700 ${question.id} paper mismatch`);
    const facts = paperFacts.papers[String(question.paper)];
    if (!facts || paper.printed_total !== facts.total_marks) throw new Error(`9700 ${paper.paper_id} printed total ${paper.printed_total} != syllabus ${facts?.total_marks}`);
    if (entry.printed_marks !== question.marks || !(question.marks > 0)) throw new Error(`9700 ${question.id} marks drifted`);
    const mcq = question.format === "multiple_choice";
    if (mcq !== (question.paper === 1) || label.format !== question.format || entry.format !== question.format) throw new Error(`9700 ${question.id} format ${question.format}`);
    if (mcq && (question.marks !== 1 || !/^[ABCD]$/.test(question.mcq_key ?? "") || question.mcq_key !== question.mcq_key_text || entry.mcq_key !== question.mcq_key)) throw new Error(`9700 ${question.id} MCQ key reads disagree`);
    if (question.removed_parts.length) throw new Error(`9700 ${question.id} removed parts ${JSON.stringify(question.removed_parts)}`);
    const choice = isSectionBChoice(question);
    if ((question.choice_group ?? null) !== (choice ? CHOICE_GROUP : null) || (entry.choice_group ?? null) !== (question.choice_group ?? null) || (choice && question.marks !== 15)) throw new Error(`9700 ${question.id} choice group ${question.choice_group}`);
    if (choice) choiceGroupRows += 1;
    const codes = [label.primary, ...label.secondaries];
    if (new Set(codes).size !== codes.length) throw new Error(`9700 ${question.id} repeats a label`);
    const resolved = codes.map((code) => {
      const topic = topicsByCode.get(code);
      if (!topic) throw new Error(`9700 ${question.id} uses unknown topic ${code}`);
      if (topic.era === "2019" && question.year > 2021) throw new Error(`9700 ${question.id} carries an earlier-syllabus topic after 2021`);
      return topic;
    });
    let primarySubtopic = [];
    if (label.primary_subtopic !== null) {
      const subtopic = subtopicsByCode.get(label.primary_subtopic);
      if (!subtopic || subtopic.topic !== label.primary) throw new Error(`9700 ${question.id} subtopic ${label.primary_subtopic} is not under ${label.primary}`);
      primarySubtopic = [subtopic.title];
    } else if (resolved[0].era !== "2019") throw new Error(`9700 ${question.id} has no subtopic under a current topic`);
    const furtherCodes = furtherSections(question.id, label, sectionOverlay.rows[question.id] ?? {}, subtopicsByCode, topicsByCode);
    overlayRowsUsed.add(question.id);
    const furtherSubtopics = furtherCodes.map((code) => subtopicsByCode.get(code).title).filter((title) => !primarySubtopic.includes(title));
    const subtopics = [...primarySubtopic, ...furtherSubtopics];
    const session = SESSION_LABELS[question.session];
    if (!session || SERIES_CODES[question.session] !== entry.series_code) throw new Error(`9700 ${question.id} session ${question.session}`);
    const component = paper.paper_id.split("-")[3];
    if (component !== `${question.paper}${question.variant}` || entry.component !== component) throw new Error(`9700 ${question.id} component ${component}`);
    const notSat = entry.exam_status === "released_not_sat";
    if (notSat !== (question.year === 2020 && question.session === "may_june") || !["sat", "released_not_sat"].includes(entry.exam_status)) throw new Error(`9700 ${question.id} exam status ${entry.exam_status}`);
    for (const alias of entry.alias_ids) if (canonical.aliases[alias]?.canonical_id !== question.id) throw new Error(`9700 alias ${alias} does not resolve to ${question.id}`);
    const transcript = transcripts.get(question.id);
    if (!transcript) throw new Error(`9700 ${question.id} has no blind transcript`);
    if ([...question.question_images, ...question.markscheme_images].some((asset) => asset.shared_stimulus)) throw new Error(`9700 ${question.id} has a shared-stimulus crop`);
    const questionImages = question.question_images.map((asset) => runtimeAsset("questions", asset, paper.paper_id));
    const markschemeImages = question.markscheme_images.map((asset) => runtimeAsset("markschemes", asset, paper.paper_id));
    if (!questionImages.length || !markschemeImages.length) throw new Error(`9700 ${question.id} is missing crops`);
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
      subject: "Biology",
      course: COURSE,
      primaryTopic: labelFor.get(primary.code),
      primaryTopicId: primary.id,
      secondaryTopics: secondaries.map((topic) => labelFor.get(topic.code)),
      secondaryTopicIds: secondaries.map((topic) => topic.id),
      subtopics,
      detailedSubtopics: subtopics,
      secondarySubtopics: furtherSubtopics,
      skills: [],
      assessmentObjectives: [],
      marks: question.marks,
      maxMarks: facts.total_marks,
      marksSource: "printed_question_paper",
      ...(choice ? { choiceGroup: CHOICE_GROUP } : {}),
      ...(mcq ? { answer: question.mcq_key, answerProvenance: { status: "official", questionId: question.id, keyReads: { markSchemeText: question.mcq_key_text, renderedView: question.mcq_key } } } : {}),
      summary: transcript.slice(0, 220),
      accessibleText: transcript,
      questionImages,
      markschemeImages,
      questionImageHashes: question.question_images.map((asset) => asset.sha256),
      markschemeImageHashes: question.markscheme_images.map((asset) => asset.sha256),
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
        furtherSubtopicCodes: furtherCodes,
        markAllocation: label.mark_allocation,
        taxonomyPath: TAXONOMY_OUTPUT,
      },
      marks_ready: true,
      rightsStatus: RIGHTS_STATUS,
    });
  }

  const strayOverlayRows = Object.keys(sectionOverlay.rows).filter((id) => !overlayRowsUsed.has(id));
  if (strayOverlayRows.length) throw new Error(`9700 secondary-subtopic overlay rows for questions not in the release: ${strayOverlayRows.join(", ")}`);
  if (JSON.stringify(skipped.sort()) !== JSON.stringify([...HELD, ...EXCLUDED].sort())) throw new Error(`9700 skipped ${skipped.join(", ")}`);
  if (questions.length !== EXPECTED.rows || new Set(questions.map((question) => question.id)).size !== EXPECTED.rows) throw new Error(`9700 rows ${questions.length}`);
  for (const [paper, count] of Object.entries(EXPECTED.byPaper)) if (questions.filter((question) => question.paper === Number(paper)).length !== count) throw new Error(`9700 Paper ${paper} count drifted`);
  const papers = new Set(questions.map((question) => question.paperId));
  if (papers.size !== EXPECTED.papers) throw new Error(`9700 papers ${papers.size}`);
  const years = questions.map((question) => question.year);
  const yearRange = `${Math.min(...years)}-${Math.max(...years)}`;
  if (yearRange !== EXPECTED.years) throw new Error(`9700 years ${yearRange}`);
  if (questions.filter((question) => question.year <= 2021).length !== EXPECTED.freeRows) throw new Error("9700 free-year count drifted");
  if (questions.filter((question) => question.examStatus === "released_not_sat").length !== EXPECTED.notSatRows) throw new Error("9700 not-sat count drifted");
  if (choiceGroupRows !== EXPECTED.choiceGroupRows) throw new Error(`9700 Section B choice rows ${choiceGroupRows}`);
  if (used.size !== EXPECTED.topics + EXPECTED.earlierTopics) throw new Error(`9700 topics used ${used.size}`);
  const unusedEarlier = sourceTaxonomy.earlier_syllabus_topics.filter((entry) => !used.has(entry.id)).map((entry) => entry.code).sort();
  if (JSON.stringify(unusedEarlier) !== JSON.stringify([...finalLabels.dropped_empty_earlier_syllabus_topics].sort())) throw new Error("9700 unused earlier-syllabus topics differ from the source's dropped list");

  const aliases = Object.fromEntries(questions.flatMap((question) => question.aliasIds.map((alias) => [alias, question.id])).sort(([a], [b]) => a.localeCompare(b)));
  if (Object.keys(aliases).length !== EXPECTED.aliases || Object.keys(aliases).length !== Object.keys(canonical.aliases).length) throw new Error("9700 alias count drifted");

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
    excludedQuestionIds: [...EXCLUDED],
    sourceCandidate: { paths: ["data/classification/final-labels.json"], sha256: [SOURCE_SHA256.labels], questionCount: questions.length },
    taxonomy: { path: TAXONOMY_OUTPUT, version: taxonomy.version, sha256: taxonomyFileSha },
    questions,
    publicationStatus: CANDIDATE_PUBLICATION_STATUS,
    assetVerification: "pending_upload",
    runtimeArtifact: {
      schemaVersion: "igcse-production-runtime-v1",
      sourceRepository: "cambridge-a-level-biology-9700-topic-practice",
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
      byPaper: EXPECTED.byPaper, freeRows: EXPECTED.freeRows, notSatRows: EXPECTED.notSatRows, held: HELD, excluded: EXCLUDED, choiceGroupRows,
      transcriptCorrections: Object.keys(corrections.rows).length,
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
  const note = file.note.includes(ALIAS_NOTE_9700) ? file.note : `${file.note} ${ALIAS_NOTE_9700}`;
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
