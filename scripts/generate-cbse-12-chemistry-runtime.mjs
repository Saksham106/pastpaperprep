#!/usr/bin/env node
/**
 * Build the CBSE Class 12 Chemistry (043) candidate runtime from the pinned source workspace
 * (cbse-12-chemistry-topic-practice, commit 33bc420, built with ../ppp-ingestion-toolkit 411e001; coverage receipt PASS).
 * Every input is SHA-256 pinned; any drift fails closed.
 *
 *   data/canonical-manifest.json               1,849 canonical questions (75 sets, 2023-2026 main + compartment) and 1,001
 *                                              alias questions: a question printed again in another set maps to its canonical
 *   data/segmentation/full/segmentation.json   every set's questions, crops (path + SHA-256), marks, MCQ keys, scheme notices
 *   data/classification/final-labels.json      1,844 labels: primary chapter, primary subtopic, secondary chapters
 *   data/classification/secondary-subtopics.json   reviewed overlay: the subtopics each secondary chapter (and any further
 *                                              subtopic of the primary chapter) earns marks for, with evidence
 *   data/classification/blind-results/*.json   blind-pass transcripts, used as accessible text (one per labelled question)
 *   data/taxonomy/taxonomy.json                10 chapters (cbse12c:2023:<n>) and 74 subtopics, CBSE curriculum 2025-26
 *   data/held-questions.json                   5 held, never served (no official scheme answer; 4 scheme render defects)
 *   data/review/ms-row-reviews.json            7 reviewed marking-scheme totals that differ from the printed marks: all served
 *                                              at the question paper's printed marks
 *   data/source-manifest.json                  the official cbse.gov.in zip each set came from
 *   data/coverage-receipt.json                 PASS
 *
 * CBSE specifics carried into the rows:
 *   - One theory paper (70 marks, 3 hours). `paper` is 1; the printed set code ("56/1/1") is `zone` and `component`;
 *     `session` is "Main" (February-March) or "Compartment" (July).
 *   - "OR" alternatives are separate rows with the printed number; the row's `label` reads "20 (OR)".
 *   - Multiple choice: CBSE's official key is `answer` with official provenance; a settled two-letter key adds
 *     `acceptedAnswers`. Six items whose scheme awards the mark for any option (printing errors) are served with
 *     `excludedFromSelfMarking: true` and no letter, so students see the scheme's own words instead of a key.
 *
 * Writes src/data/production/cbse-12-chemistry.json, src/data/private-index/cbse-12-chemistry.json,
 * src/data/cbse-12-chemistry-taxonomy.json and the bank's alias ids in src/data/question-id-aliases.json.
 * The runtime stays a candidate until the owner-approved R2 upload is read back and it is finalized.
 *
 *   node scripts/generate-cbse-12-chemistry-runtime.mjs          write the outputs
 *   node scripts/generate-cbse-12-chemistry-runtime.mjs --check  rebuild and compare with the committed outputs
 */
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const BANK = "cbse-12-chemistry";
export const RIGHTS_STATUS = "user_attested_rights_authorized";
export const CANDIDATE_PUBLICATION_STATUS = "authorized_production_candidate";
export const DEFAULT_SOURCE_ROOT = "/Users/sakshamgoel/Documents/ProjectsInternships/cbse-12-chemistry-topic-practice";
export const SOURCE_COMMIT = "33bc420";
export const TOOLKIT_COMMIT = "411e001";
export const SOURCE_SHA256 = {
  canonicalManifest: "101ce00d5888691ffc078278707b99d7cde9af89524b163a8f0ebdb426d3f42e",
  labels: "f7102a180f32b0d27e024a2fc47f770ef103796515f91eeb2fe40bbf125205b7",
  secondarySubtopics: "eb074643bf2ffce327b525d8a2542b85c16243c33c7b2db8b8072432ef4f1dff",
  segmentation: "5421570c479edfba3350088af798e8f4b485a37ab928fcb3279a0e6c185b3cf1",
  heldQuestions: "b23b5bfbc71a3fa03ed154659de81d4ac56d7738d0caf708e221cc8f693c7ffb",
  taxonomy: "e186036140c4433457f01b7f8ed8bcaa2d31bdf03dc01c8a35fe69ec00ee499b",
  coverageReceipt: "b3bceeb54b016ab08febdaa0162897775d4b5a955faa1e22a06ac2c3e4f88655",
  msRowReviews: "44d1935789b603b69b85ca07a0c9fd50f0f0af6d5679fc149e9bae7e948aa147",
  sourceManifest: "f26eab45f1aac71da98b5700cce587b9b754fe7bba86f2f92edad54f4359ce92",
  /** SHA-256 over the sorted "<file> <sha256>" lines of every top-level blind-results/*.json file. */
  blindResults: "6e8e9c7a7940b408dbd441afff914e1fe5335d214d9660fbedf680c94eed1c7f",
};
/** The CBSE Chemistry (043) theory paper: 70 marks, 3 hours (curriculum 2025-26 assessment scheme; every set prints it). */
export const PAPER_FACTS = { 1: { name: "Chemistry (Theory)", durationMinutes: 180, totalMarks: 70 } };
/** Scheme-notice items (full marks for any option, printing errors): served without a key and never self-marked. */
export const EXCLUDED_FROM_SELF_MARKING = [
  "cbse12c-2023-m-111-q13", "cbse12c-2023-m-111-q6", "cbse12c-2023-m-112-q4", "cbse12c-2023-m-133-q9", "cbse12c-2024-m-112-q4", "cbse12c-2025-c-1s2-q14",
];
/** Settled two-letter official keys (mcq-key-settlements.json): either letter scores. */
export const TWO_LETTER_KEYS = {
  "cbse12c-2023-m-151-q16": ["A", "B"], "cbse12c-2024-m-151-q14": ["A", "B"], "cbse12c-2024-m-152-q15": ["A", "B"], "cbse12c-2024-m-153-q13": ["A", "B"], "cbse12c-2026-m-121-q14": ["A", "B"],
};
export const EXPECTED = {
  canonical: 1849, aliasesInManifest: 1001, held: 5, rows: 1844, servedAliases: 997, sets: 75, topics: 10, subtopics: 74,
  freeRows: 448, multipleChoice: 933, structured: 911, crops: 4072, years: "2023-2026",
};
const EXPECTED_EXCLUDED = EXCLUDED_FROM_SELF_MARKING;
export const FREE_YEARS = [2023];
export const TAXONOMY_OUTPUT = "src/data/cbse-12-chemistry-taxonomy.json";
export const RUNTIME_OUTPUT = "src/data/production/cbse-12-chemistry.json";
export const PRIVATE_INDEX_OUTPUT = "src/data/private-index/cbse-12-chemistry.json";
export const ALIASES_OUTPUT = "src/data/question-id-aliases.json";
export const ALIAS_NOTE = "CBSE Class 12 Chemistry: a question printed again in another set maps to its canonical question, from the source workspace's frozen canonical manifest.";
const SESSIONS = { main: { label: "Main", series: "m" }, compartment: { label: "Compartment", series: "c" } };
const ERA = "2023";
const COURSE = "CBSE Class 12 Chemistry (043)";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function sourceRootPath(environment = process.env) {
  return environment.PASTPAPERPREP_CBSE_12_CHEMISTRY_SOURCE_ROOT?.trim() || DEFAULT_SOURCE_ROOT;
}

async function pinnedBytes(sourceRoot, relative, expected) {
  const bytes = await readFile(path.join(sourceRoot, relative));
  const actual = sha256(bytes);
  if (actual !== expected) throw new Error(`CBSE Chemistry source ${relative} SHA-256 ${actual} != pinned ${expected}`);
  return bytes;
}
async function pinned(sourceRoot, relative, expected) {
  return JSON.parse((await pinnedBytes(sourceRoot, relative, expected)).toString("utf8"));
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
      if (transcripts.has(row.id)) throw new Error(`CBSE Chemistry ${row.id} has more than one blind transcript`);
      transcripts.set(row.id, row.transcript.trim());
    }
  }
  return { pin: sha256(`${lines.join("\n")}\n`), transcripts };
}

/**
 * Subtopic labels by code: the curriculum's clause title, qualified with its chapter where several chapters share a title
 * ("Classification" and "Nomenclature" open the haloalkane, alcohol and amine chapters), because the subtopic filter
 * matches labels. Fails closed unless the result is unique.
 */
export function subtopicLabels(source) {
  const count = new Map();
  for (const entry of source.topics) for (const subtopic of entry.subtopics) count.set(subtopic.title, (count.get(subtopic.title) ?? 0) + 1);
  const labels = new Map();
  for (const entry of source.topics) for (const subtopic of entry.subtopics) labels.set(subtopic.code, count.get(subtopic.title) > 1 ? `${subtopic.title} (${entry.title})` : subtopic.title);
  if (new Set(labels.values()).size !== labels.size) throw new Error("CBSE Chemistry subtopic labels are not unique");
  return labels;
}

/** Student taxonomy: the 10 chapters in curriculum order, each with its subtopics. */
export function studentTaxonomy(source, used, subtopicLabelFor) {
  const chapters = source.topics.map((entry) => ({
    id: entry.id, code: entry.code, label: entry.title, era: entry.era, official: true, questions: used.get(entry.id) ?? 0,
    subtopics: entry.subtopics.map((subtopic) => ({ code: subtopic.code, label: subtopicLabelFor.get(subtopic.code), curriculumTitle: subtopic.title })),
  }));
  if (chapters.length !== EXPECTED.topics || chapters.flatMap((chapter) => chapter.subtopics).length !== EXPECTED.subtopics || source.earlier_syllabus_topics.length) throw new Error("CBSE Chemistry taxonomy shape drifted");
  return {
    artifact: "cbse_12_chemistry_student_taxonomy",
    version: source.version,
    qualification: "CBSE Class 12 Chemistry (043)",
    era: ERA,
    note: "Topics are the curriculum's ten chapters (units), in curriculum order; subtopics are its content clauses. One theory paper; no earlier-syllabus topics.",
    sourceTaxonomyPath: "data/taxonomy/taxonomy.json",
    sourceTaxonomySHA256: SOURCE_SHA256.taxonomy,
    chapters,
  };
}

function runtimeAsset(kind, asset, paperId) {
  const match = /^assets\/(cbse12c-20\d{2}-[mc]-1[0-9a-z]{2})\/(questions|markschemes)\/(q\d+(?:-or)?-\d+-\d+\.webp)$/.exec(asset.path);
  if (!match || match[2] !== kind || match[1] !== paperId) throw new Error(`Unexpected CBSE Chemistry ${kind} asset path: ${asset.path}`);
  if (!/^[0-9a-f]{64}$/.test(asset.sha256 ?? "")) throw new Error(`CBSE Chemistry ${asset.path} has no SHA-256`);
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
 * The reviewed further subtopics of one question, in curriculum order: at least one for every secondary chapter, optionally
 * more of the primary chapter (never its primary subtopic again), and only under the question's own chapters.
 */
export function furtherSubtopics(id, label, entry, subtopicsByCode) {
  const allowed = new Set([label.primary, ...label.secondaries]);
  for (const code of Object.keys(entry)) if (!allowed.has(code)) throw new Error(`CBSE Chemistry ${id} overlay names chapter ${code}, which is not its primary or a secondary`);
  const codes = [];
  for (const code of [label.primary, ...label.secondaries]) {
    const subtopics = entry[code]?.subtopics;
    if (subtopics === undefined) {
      if (code !== label.primary) throw new Error(`CBSE Chemistry ${id} secondary chapter ${code} has no reviewed subtopic`);
      continue;
    }
    if (!Array.isArray(subtopics) || !subtopics.length || new Set(subtopics).size !== subtopics.length || typeof entry[code].evidence !== "string" || !entry[code].evidence.trim()) throw new Error(`CBSE Chemistry ${id} overlay entry for ${code} is malformed`);
    for (const subtopic of subtopics) {
      if (subtopicsByCode.get(subtopic)?.topic !== code) throw new Error(`CBSE Chemistry ${id} subtopic ${subtopic} is not under chapter ${code}`);
      if (code === label.primary && subtopic === label.primary_subtopic) throw new Error(`CBSE Chemistry ${id} overlay repeats the primary subtopic ${subtopic}`);
    }
    codes.push(...subtopics);
  }
  const order = [...subtopicsByCode.keys()];
  return [...new Set(codes)].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

/** Multiple-choice answer fields: the official key with provenance, a settled two-letter key, or none for a notice item. */
function mcqFields(question, entry) {
  if (question.format !== "multiple_choice") {
    if (question.mcq_key !== null || entry.mcq_key !== null || question.mcq_keys?.length) throw new Error(`CBSE Chemistry ${question.id} is structured but has an MCQ key`);
    return {};
  }
  if (question.marks !== 1) throw new Error(`CBSE Chemistry ${question.id} MCQ is not one mark`);
  const excluded = EXCLUDED_FROM_SELF_MARKING.includes(question.id);
  if (excluded !== (entry.excluded_from_self_marking === true) || excluded !== (question.excluded_from_self_marking === true)) throw new Error(`CBSE Chemistry ${question.id} self-marking exclusion drifted`);
  if (excluded) {
    if (!question.ms_notices?.some((notice) => notice.kind === "full_marks_all")) throw new Error(`CBSE Chemistry ${question.id} is excluded without a full-marks notice`);
    if (entry.key_note !== undefined) throw new Error(`CBSE Chemistry ${question.id} carries a key_note, which needs an owner decision and app review`);
    return { excludedFromSelfMarking: true };
  }
  const keys = entry.mcq_keys;
  if (!Array.isArray(keys) || JSON.stringify(keys) !== JSON.stringify(question.mcq_keys) || !keys.every((key) => /^[A-D]$/.test(key)) || keys[0] !== entry.mcq_key) throw new Error(`CBSE Chemistry ${question.id} MCQ key ${JSON.stringify(keys)} is not a checked official key`);
  const two = TWO_LETTER_KEYS[question.id];
  if (two ? JSON.stringify(keys) !== JSON.stringify(two) || entry.mcq_key_source !== "settlement" : keys.length !== 1) throw new Error(`CBSE Chemistry ${question.id} key letters drifted`);
  return {
    answer: keys[0],
    ...(two ? { acceptedAnswers: [...two] } : {}),
    answerProvenance: { status: "official", questionId: question.id, source: entry.mcq_key_source },
  };
}

export async function buildRuntime({ sourceRoot = sourceRootPath() } = {}) {
  const canonical = await pinned(sourceRoot, "data/canonical-manifest.json", SOURCE_SHA256.canonicalManifest);
  const finalLabels = await pinned(sourceRoot, "data/classification/final-labels.json", SOURCE_SHA256.labels);
  const overlay = await pinned(sourceRoot, "data/classification/secondary-subtopics.json", SOURCE_SHA256.secondarySubtopics);
  const segmentation = await pinned(sourceRoot, "data/segmentation/full/segmentation.json", SOURCE_SHA256.segmentation);
  const held = await pinned(sourceRoot, "data/held-questions.json", SOURCE_SHA256.heldQuestions);
  const sourceTaxonomy = await pinned(sourceRoot, "data/taxonomy/taxonomy.json", SOURCE_SHA256.taxonomy);
  const coverage = await pinned(sourceRoot, "data/coverage-receipt.json", SOURCE_SHA256.coverageReceipt);
  const msReviews = await pinned(sourceRoot, "data/review/ms-row-reviews.json", SOURCE_SHA256.msRowReviews);
  const sources = await pinned(sourceRoot, "data/source-manifest.json", SOURCE_SHA256.sourceManifest);
  const blind = await blindTranscripts(sourceRoot);
  if (blind.pin !== SOURCE_SHA256.blindResults) throw new Error(`CBSE Chemistry blind results ${blind.pin} != pinned ${SOURCE_SHA256.blindResults}`);

  // Inputs made against each other.
  if (finalLabels.inputs?.taxonomy_sha256 !== SOURCE_SHA256.taxonomy) throw new Error("CBSE Chemistry final labels were made against a different taxonomy");
  if (overlay.inputs?.final_labels_sha256 !== SOURCE_SHA256.labels || overlay.inputs?.taxonomy_sha256 !== SOURCE_SHA256.taxonomy || overlay.inputs?.segmentation_sha256 !== SOURCE_SHA256.segmentation) throw new Error("CBSE Chemistry secondary-subtopic overlay was made against different inputs");
  if (coverage.verdict !== "PASS" || coverage.problems.length) throw new Error("CBSE Chemistry coverage receipt is not PASS");
  const totals = coverage.totals;
  if (totals.canonical_questions !== EXPECTED.canonical || totals.labelled_questions !== EXPECTED.rows || totals.served_alias_questions !== EXPECTED.servedAliases || totals.held_questions !== EXPECTED.held || totals.excluded_questions !== 0 || totals.universe_papers !== EXPECTED.sets) throw new Error(`CBSE Chemistry coverage totals drifted: ${JSON.stringify(totals)}`);
  if (finalLabels.held.length || finalLabels.review_corrections?.length || finalLabels.dropped_empty_earlier_syllabus_topics.length) throw new Error("CBSE Chemistry final labels carry held rows, corrections or earlier-syllabus topics; review before building");

  if (!canonical.frozen || canonical.canonical_questions.length !== EXPECTED.canonical || Object.keys(canonical.aliases).length !== EXPECTED.aliasesInManifest) throw new Error("CBSE Chemistry canonical manifest drifted");
  const heldIds = Object.keys(held.questions).sort();
  if (heldIds.length !== EXPECTED.held) throw new Error(`CBSE Chemistry held ${heldIds.length}`);
  const labels = new Map(finalLabels.labels.map((label) => [label.id, label]));
  if (labels.size !== EXPECTED.rows || finalLabels.labels.length !== EXPECTED.rows) throw new Error("CBSE Chemistry labels do not cover the release once each");
  const topicsByCode = new Map(sourceTaxonomy.topics.map((entry) => [entry.code, entry]));
  const subtopicsByCode = new Map(sourceTaxonomy.topics.flatMap((entry) => entry.subtopics.map((subtopic) => [subtopic.code, { ...subtopic, topic: entry.code }])));
  const subtopicLabelFor = subtopicLabels(sourceTaxonomy);

  const segmented = new Map(segmentation.papers.flatMap((paper) => paper.questions.map((question) => [question.id, { paper, question }])));
  if (segmentation.papers.length !== EXPECTED.sets || segmentation.summary.papers_with_issues.length) throw new Error("CBSE Chemistry segmentation drifted");
  for (const paper of segmentation.papers) if (paper.max_marks !== PAPER_FACTS[1].totalMarks || paper.printed_total !== PAPER_FACTS[1].totalMarks || paper.issues.length) throw new Error(`CBSE Chemistry ${paper.paper_id} total ${paper.printed_total}/${paper.max_marks}`);
  const sourceUrl = (paperId, kind) => {
    const url = sources.papers[paperId]?.[kind]?.url;
    if (typeof url !== "string" || !url.startsWith("https://www.cbse.gov.in/")) throw new Error(`CBSE Chemistry ${paperId} ${kind} has no official source`);
    return url;
  };
  const reviewedMs = msReviews.items;

  const questions = [];
  const used = new Map();
  const overlayRowsUsed = new Set();
  let crops = 0;
  for (const entry of canonical.canonical_questions) {
    if (heldIds.includes(entry.id)) {
      if (labels.has(entry.id)) throw new Error(`CBSE Chemistry held ${entry.id} has a label`);
      continue;
    }
    const found = segmented.get(entry.id);
    if (!found) throw new Error(`CBSE Chemistry ${entry.id} is not segmented`);
    const { paper, question } = found;
    if (question.held || question.excluded_from_practice || entry.excluded_from_practice || question.removed_parts.length) throw new Error(`CBSE Chemistry ${question.id} is held, excluded or has removed parts`);
    if (question.paper !== 1 || entry.paper_number !== 1 || question.level !== null || entry.levels.length) throw new Error(`CBSE Chemistry ${question.id} paper or level drifted`);
    const session = SESSIONS[question.session];
    if (!session || session.series !== entry.series_code || question.year !== entry.year || question.set_code !== entry.set_code || paper.set_code !== question.set_code) throw new Error(`CBSE Chemistry ${question.id} session or set drifted`);
    if (entry.exam_status !== "sat") throw new Error(`CBSE Chemistry ${question.id} exam status ${entry.exam_status}`);
    // Marks: the question paper's printed marks; a scheme total that differs is served only with a reviewed "serve".
    if (entry.printed_marks !== question.marks || !(question.marks > 0)) throw new Error(`CBSE Chemistry ${question.id} marks drifted`);
    if (question.marks_status === "ms_marks_differ") {
      const review = reviewedMs[question.id] ?? reviewedMs[question.id.replace(/-or$/, "")];
      if (review?.decision !== "serve" || review.served_marks !== question.marks) throw new Error(`CBSE Chemistry ${question.id} scheme total differs without a reviewed serve`);
    } else if (question.marks_status !== "reconciled" || question.ms_marks !== question.marks) throw new Error(`CBSE Chemistry ${question.id} marks status ${question.marks_status}`);
    const label = labels.get(question.id);
    if (!label) throw new Error(`CBSE Chemistry ${question.id} has no final label`);
    if (label.format !== question.format || entry.format !== question.format) throw new Error(`CBSE Chemistry ${question.id} format drifted`);
    const mcq = mcqFields(question, entry);

    const codes = [label.primary, ...label.secondaries];
    if (new Set(codes).size !== codes.length) throw new Error(`CBSE Chemistry ${question.id} repeats a chapter`);
    const resolved = codes.map((code) => topicsByCode.get(code) ?? (() => { throw new Error(`CBSE Chemistry ${question.id} uses unknown chapter ${code}`); })());
    const primarySubtopic = subtopicsByCode.get(label.primary_subtopic);
    if (!primarySubtopic || primarySubtopic.topic !== label.primary) throw new Error(`CBSE Chemistry ${question.id} subtopic ${label.primary_subtopic} is not under ${label.primary}`);
    const furtherCodes = furtherSubtopics(question.id, label, overlay.rows[question.id] ?? {}, subtopicsByCode);
    if (overlay.rows[question.id]) overlayRowsUsed.add(question.id);
    const further = furtherCodes.map((code) => subtopicLabelFor.get(code));
    const subtopics = [subtopicLabelFor.get(primarySubtopic.code), ...further];

    for (const alias of entry.alias_ids) if (canonical.aliases[alias]?.canonical_id !== question.id) throw new Error(`CBSE Chemistry alias ${alias} does not resolve to ${question.id}`);
    const transcript = blind.transcripts.get(question.id);
    if (!transcript) throw new Error(`CBSE Chemistry ${question.id} has no blind transcript`);
    const questionImages = question.question_images.map((asset) => runtimeAsset("questions", asset, paper.paper_id));
    const markschemeImages = question.markscheme_images.map((asset) => runtimeAsset("markschemes", asset, paper.paper_id));
    if (!questionImages.length || !markschemeImages.length) throw new Error(`CBSE Chemistry ${question.id} is missing crops`);
    crops += questionImages.length + markschemeImages.length;
    for (const topic of resolved) used.set(topic.id, (used.get(topic.id) ?? 0) + 1);
    const [primary, ...secondaries] = resolved;
    questions.push({
      id: question.id,
      canonicalId: question.id,
      aliasIds: [...entry.alias_ids],
      bankSlug: BANK,
      paperId: paper.paper_id,
      number: question.number,
      label: question.label,
      paper: 1,
      year: question.year,
      session: session.label,
      examStatus: entry.exam_status,
      format: question.format,
      section: question.section,
      zone: question.set_code,
      component: question.set_code,
      setCodes: [...entry.set_codes],
      courseEra: ERA,
      era: ERA,
      subject: "Chemistry",
      course: COURSE,
      primaryTopic: primary.title,
      primaryTopicId: primary.id,
      secondaryTopics: secondaries.map((topic) => topic.title),
      secondaryTopicIds: secondaries.map((topic) => topic.id),
      subtopics,
      detailedSubtopics: subtopics,
      secondarySubtopics: further,
      skills: [],
      assessmentObjectives: [],
      marks: question.marks,
      maxMarks: PAPER_FACTS[1].totalMarks,
      marksSource: "printed_question_paper",
      ...mcq,
      summary: `${question.alternative === "or" ? "(OR) " : ""}${transcript}`.slice(0, 220),
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

  const stray = Object.keys(overlay.rows).filter((id) => !overlayRowsUsed.has(id));
  if (stray.length) throw new Error(`CBSE Chemistry overlay rows for questions not in the release: ${stray.join(", ")}`);
  if (questions.length !== EXPECTED.rows || new Set(questions.map((question) => question.id)).size !== EXPECTED.rows) throw new Error(`CBSE Chemistry rows ${questions.length}`);
  if (questions.filter((question) => question.format === "multiple_choice").length !== EXPECTED.multipleChoice || questions.filter((question) => question.format === "structured").length !== EXPECTED.structured) throw new Error("CBSE Chemistry format counts drifted");
  if (questions.filter((question) => FREE_YEARS.includes(question.year)).length !== EXPECTED.freeRows) throw new Error("CBSE Chemistry free-year count drifted");
  if (questions.filter((question) => question.excludedFromSelfMarking).length !== EXPECTED_EXCLUDED.length) throw new Error("CBSE Chemistry exclusion count drifted");
  if (crops !== EXPECTED.crops) throw new Error(`CBSE Chemistry crops ${crops}`);
  if (used.size !== EXPECTED.topics) throw new Error(`CBSE Chemistry chapters used ${used.size}`);
  const years = questions.map((question) => question.year);
  const yearRange = `${Math.min(...years)}-${Math.max(...years)}`;
  if (yearRange !== EXPECTED.years) throw new Error(`CBSE Chemistry years ${yearRange}`);
  const papers = new Set(questions.map((question) => question.paperId));

  // Aliases of served questions only (a held canonical's aliases are not served either).
  const aliases = Object.fromEntries(questions.flatMap((question) => question.aliasIds.map((alias) => [alias, question.id])).sort(([a], [b]) => a.localeCompare(b)));
  if (Object.keys(aliases).length !== EXPECTED.servedAliases) throw new Error(`CBSE Chemistry served aliases ${Object.keys(aliases).length}`);

  const taxonomy = studentTaxonomy(sourceTaxonomy, used, subtopicLabelFor);
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
    setCount: EXPECTED.sets,
    questionCount: questions.length,
    marks_ready: true,
    paperFacts: { 1: { ...PAPER_FACTS[1] } },
    heldQuestionIds: heldIds,
    excludedQuestionIds: [],
    excludedFromSelfMarkingIds: [...EXPECTED_EXCLUDED],
    sourceCandidate: { paths: ["data/classification/final-labels.json"], sha256: [SOURCE_SHA256.labels], questionCount: questions.length },
    taxonomy: { path: TAXONOMY_OUTPUT, version: taxonomy.version, sha256: taxonomyFileSha },
    questions,
    publicationStatus: CANDIDATE_PUBLICATION_STATUS,
    assetVerification: "pending_upload",
    runtimeArtifact: {
      schemaVersion: "igcse-production-runtime-v1",
      sourceRepository: "cbse-12-chemistry-topic-practice",
      sourceCommit: SOURCE_COMMIT,
      toolkitCommit: TOOLKIT_COMMIT,
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
    report: { status: "PASS", bank: BANK, rows: questions.length, papers: papers.size, years: yearRange, aliases: Object.keys(aliases).length, crops, freeRows: EXPECTED.freeRows, blindPin: blind.pin, candidate: seals.candidate },
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
  const note = file.note.includes(ALIAS_NOTE) ? file.note : `${file.note} ${ALIAS_NOTE}`;
  return { ...file, note, banks: { ...file.banks, [BANK]: aliases } };
}

async function main() {
  const check = process.argv.includes("--check");
  const repo = path.resolve(import.meta.dirname, "..");
  const built = await buildRuntime();
  const aliasFile = JSON.parse(await readFile(path.join(repo, ALIASES_OUTPUT), "utf8"));
  const outputs = {
    [RUNTIME_OUTPUT]: built.serialized,
    [PRIVATE_INDEX_OUTPUT]: `${JSON.stringify(createPrivateIndex(built.artifact))}\n`,
    [TAXONOMY_OUTPUT]: built.taxonomySerialized,
    [ALIASES_OUTPUT]: `${JSON.stringify(withBankAliases(aliasFile, built.aliases), null, 1)}\n`,
  };
  const differs = [];
  for (const [relative, text] of Object.entries(outputs)) {
    const target = path.join(repo, relative);
    if (check) { if ((await readFile(target, "utf8").catch(() => "")) !== text) differs.push(relative); }
    else await writeFile(target, text);
  }
  console.log(JSON.stringify({ ...built.report, ...(check ? { check: differs.length ? "DIFFERS" : "MATCHES", differs } : {}) }));
  if (differs.length) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
