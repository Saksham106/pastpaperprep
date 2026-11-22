#!/usr/bin/env node
/**
 * Build the Cambridge International AS & A Level Computer Science 9618 candidate runtime from the pinned source workspace
 * (cambridge-a-level-computer-science-9618-topic-practice, commit df9a1d6, built with ../ppp-ingestion-toolkit; coverage
 * receipt PASS, every gate passing with none waived). Every input is SHA-256 pinned; any drift fails closed.
 *
 *   data/segmentation/full/segmentation.json   750 canonical questions in 85 canonical papers (Papers 1, 2 and 3)
 *   data/classification/final-labels.json      750 labels: primary section, primary subsection, secondary sections
 *   data/taxonomy/taxonomy.json                sections 1-20 (9618:2021:<n>; AS 1-12, A Level 13-20), 44 subsections
 *   data/canonical-manifest.json               canonical ids, exam status, alias ids (13 alias papers, 124 alias questions)
 *   data/held-questions.json                   empty (asserted): no content removed, no withdrawn parts
 *   data/review/full-marks-notes-reviewed.json the two "all candidates were awarded full marks" notes, both served at their
 *                                              printed marks (owner, 2026-11-21: "Serve them")
 *   data/review/ms-marks-reviewed.json         the one question whose MS total differs from the QP's printed brackets
 *   data/source-manifest.json + acquisition-manifest.json   kept, identity-checked source files
 *   data/extras/9618-syllabus-2026.pdf         paper facts (assessment overview, p. 11)
 *   data/classification/blind-results/*.json   blind-pass transcriptions, used as accessible text
 *   data/classification/secondary-subtopics.json      reviewed overlay: the subsections each secondary section materially
 *                                              assesses, and any further subsection of the primary section, with mark evidence
 *
 * Computer Science specifics carried into the rows:
 *   - Three written papers, every question structured: Paper 1 Theory Fundamentals (sections 1-8), Paper 2 Fundamental
 *     Problem-solving and Programming Skills (9-12), Paper 3 Advanced Theory (13-20). Paper 4 (practical) is not in scope.
 *   - One syllabus era: the 2021-2023, 2024-2025 and 2026 syllabuses share sections 1-20; every paper is 75 marks.
 *   - Labels: A Level section 16 reuses AS section 5's title ("System Software") and subsection 19.1 reuses 9.2's
 *     ("Algorithms"); the A Level ones say "(A Level)" so every topic and subtopic label names one syllabus entry.
 *   - Subtopics: the primary subsection first, then the reviewed further subsections in syllabus order (`subtopics`,
 *     `detailedSubtopics`); the further subsections alone are `secondarySubtopics`.
 *
 * Writes src/data/production/a-level-computer-science-9618.json, src/data/private-index/a-level-computer-science-9618.json,
 * src/data/a-level-computer-science-9618-taxonomy.json and the bank's alias ids in src/data/question-id-aliases.json.
 * The runtime stays a candidate until the owner-approved R2 upload is read back and it is finalized.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const BANK = "a-level-computer-science-9618";
export const RIGHTS_STATUS = "user_attested_rights_authorized";
export const CANDIDATE_PUBLICATION_STATUS = "authorized_production_candidate";
export const DEFAULT_SOURCE_ROOT = "/Users/sakshamgoel/Documents/ProjectsInternships/cambridge-a-level-computer-science-9618-topic-practice";
export const SOURCE_COMMIT = "df9a1d6";
export const SOURCE_SHA256 = {
  segmentation: "46bab5316557c80e2636bd6db4889cbb2c7eed2b2fac6cace0d7016318557c74",
  labels: "1ca2d64666e956a2609cab7ceb7fdc0b8e818713718b7bd31c4f78997f1b2637",
  taxonomy: "cfea97415eefba158be26acbd24bc6346c847426b4c95c2bbb28a5dee71660e8",
  canonicalManifest: "21c6e6fd06611cb2a714f3e73eb0dcb6095a09411b053d6692a74fc5e10e12f9",
  sourceManifest: "39cdedc8d732324cb65ef0c126bbc82f91f3372a0fc66daaf96d25c825d3aa0f",
  acquisitionManifest: "10f032a78ba1ef51ec2044454bceeaee11ecff9cff648d67c2e8538a4dd3b5a4",
  heldQuestions: "fed54a270decfc511314f1e904360f710877d65768039290778480baffa5d669",
  fullMarksNotes: "13145ab403de8e9482235a49f085587895cb9040007a36227ea462b784b88b31",
  fullMarksNotesReviewed: "46b564cff16160647b9fa8adf19efc67261749897f15d985b5852c9dc25d38c2",
  msMarksReviewed: "e14b7f2f996701a3bcc13b7ea27b95350eba2dcdc245138fb4b35fa5320fde4f",
  secondarySubtopics: "0e0146303a28184ef940a7d49a7d3e6e13bfca4b3fa0c71e1728cc6c85be4fbf",
  syllabus2026: "bf1b77a2b765d10eb4b005ecae0412add35cf6113ba3218a517893abfc9f2470",
  coverageReceipt: "4532e6685a2afe0d1df28ceda0a616ff1bd47b0cffa8c9acf58fef961ef434d1",
  /** SHA-256 over the sorted "<file> <sha256>" lines of every top-level blind-results/*.json file. */
  blindResults: "e79743ffcb8ce78c38827fcf20eccf7eb31ce3d22dc4f30613f1cb2f87934e69",
};
/**
 * Paper facts: the 2026 syllabus assessment overview, p. 11 (the same in the 2021-2023 and 2024-2025 syllabuses). Every
 * question paper and mark scheme in scope prints 75 as its total (asserted below).
 */
export const PAPER_FACTS = {
  1: { name: "Theory Fundamentals", durationMinutes: 90, totalMarks: 75, sections: [1, 8] },
  2: { name: "Fundamental Problem-solving and Programming Skills", durationMinutes: 120, totalMarks: 75, sections: [9, 12] },
  3: { name: "Advanced Theory", durationMinutes: 90, totalMarks: 75, sections: [13, 20] },
};
/**
 * Mark schemes that say "all candidates were awarded full marks" for some parts. The parts are printed in the QP and the MS
 * still prints their answers, so students can score them: served at the printed marks (owner, 2026-11-21: "Serve them").
 */
export const FULL_MARKS_NOTES = {
  "9618-2025-s-22": { question: "9618-2025-s-22-q1", parts: ["1(a)(ii)", "1(b)(ii)"], marks: 14 },
  "9618-2026-s-32": { question: "9618-2026-s-32-q10", parts: ["10(a)"], marks: 9 },
};
/** The one MS whose total differs from the QP: a blank Marks cell for 7(b)(ii) [1]. The QP's printed brackets are served. */
export const MS_MARKS_REVIEWED = { "9618-2025-s-12-q7": { qpMarks: 8, msMarks: 7 } };
export const EXPECTED = {
  labels: 750, rows: 750, papers: 85, aliases: 124, aliasPapers: 13, byPaper: { 1: 254, 2: 238, 3: 258 }, topics: 20, subtopics: 44,
  freeRows: 218, years: "2021-2026", sourcePapers: 98, crops: 2397,
};
export const FREE_YEARS = [2021, 2022];
export const TAXONOMY_OUTPUT = "src/data/a-level-computer-science-9618-taxonomy.json";
export const ALIASES_OUTPUT = "src/data/question-id-aliases.json";
export const ALIAS_NOTE_9618 = "A Level Computer Science 9618: a variant that reprints another variant of the same series maps to the canonical question, from the source workspace's frozen canonical manifest.";
const SESSION_LABELS = { may_june: "June", october_november: "November" };
const SERIES_CODES = { may_june: "s", october_november: "w" };
const PAPERS = new Set([1, 2, 3]);
const ERA = "2021";
const COURSE = "Cambridge International AS & A Level Computer Science 9618";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function sourceRootPath(environment = process.env) {
  return environment.PASTPAPERPREP_A_LEVEL_COMPUTER_SCIENCE_SOURCE_ROOT?.trim() || DEFAULT_SOURCE_ROOT;
}

async function pinnedBytes(sourceRoot, relative, expected) {
  const bytes = await readFile(path.join(sourceRoot, relative));
  const actual = sha256(bytes);
  if (actual !== expected) throw new Error(`9618 source ${relative} SHA-256 ${actual} != pinned ${expected}`);
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
      if (transcripts.has(row.id)) throw new Error(`9618 ${row.id} has more than one blind transcript`);
      transcripts.set(row.id, row.transcript.trim());
    }
  }
  return { pin: sha256(`${lines.join("\n")}\n`), transcripts };
}

/** Unique student-facing labels: an A Level entry that reuses an AS title says "(A Level)" (section 16, subsection 19.1). */
export function topicLabels(source) {
  const asTitles = new Set(source.topics.filter((entry) => entry.level === "AS").map((entry) => entry.title));
  const labels = new Map(source.topics.map((entry) => [entry.code, entry.level === "A Level" && asTitles.has(entry.title) ? `${entry.title} (A Level)` : entry.title]));
  if (new Set(labels.values()).size !== labels.size) throw new Error("9618 topic labels are not unique");
  return labels;
}

export function subtopicLabels(source) {
  const asTitles = new Set(source.topics.filter((entry) => entry.level === "AS").flatMap((entry) => entry.subtopics.map((subtopic) => subtopic.title)));
  const labels = new Map();
  for (const entry of source.topics) for (const subtopic of entry.subtopics) labels.set(subtopic.code, entry.level === "A Level" && asTitles.has(subtopic.title) ? `${subtopic.title} (A Level)` : subtopic.title);
  if (new Set(labels.values()).size !== labels.size) throw new Error("9618 subtopic labels are not unique");
  return labels;
}

/** Student taxonomy: sections 1-20 in syllabus order, with their subsections and question counts. */
export function studentTaxonomy(source, used, labels, sectionLabels) {
  const topics = source.topics.map((entry) => ({
    id: entry.id, code: entry.code, label: labels.get(entry.code), syllabusTitle: entry.title, level: entry.level, era: entry.era, earlierSyllabus: false, official: true,
    questions: used.get(entry.id) ?? 0,
    subtopics: entry.subtopics.map((subtopic) => ({ code: subtopic.code, label: sectionLabels.get(subtopic.code), syllabusTitle: subtopic.title })),
  }));
  if (topics.length !== EXPECTED.topics || topics.flatMap((topic) => topic.subtopics).length !== EXPECTED.subtopics || source.earlier_syllabus_topics.length) throw new Error("9618 taxonomy shape drifted");
  return {
    artifact: "a_level_computer_science_9618_student_taxonomy",
    version: source.version,
    qualification: "9618",
    note: "Sections 1-20 of the syllabus in order (AS 1-12, A Level 13-20; the A Level section and subsection that share an AS title say \"(A Level)\"). Each paper is its own tab: Paper 1 assesses sections 1-8, Paper 2 sections 9-12 and Paper 3 sections 13-20.",
    sourceTaxonomyPath: "data/taxonomy/taxonomy.json",
    sourceTaxonomySHA256: SOURCE_SHA256.taxonomy,
    topics,
  };
}

function runtimeAsset(kind, asset, paperId) {
  const match = /^assets\/(9618-20\d{2}-[sw]-\d{2})\/(questions|markschemes)\/(q\d+-\d+-\d+\.webp)$/.exec(asset.path);
  if (!match || match[2] !== kind || match[1] !== paperId) throw new Error(`Unexpected 9618 ${kind} asset path: ${asset.path}`);
  if (!/^[0-9a-f]{64}$/.test(asset.sha256 ?? "")) throw new Error(`9618 ${asset.path} has no SHA-256`);
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
 * The reviewed further subsections of one question, in syllabus order: at least one for every secondary section, optionally
 * more of the primary section (never its primary subsection again), and only under the question's own sections. Fails
 * closed on any other shape.
 */
export function furtherSections(id, label, entry, subtopicsByCode) {
  const allowed = new Set([label.primary, ...label.secondaries]);
  for (const code of Object.keys(entry)) if (!allowed.has(code)) throw new Error(`9618 ${id} overlay names section ${code}, which is not its primary or a secondary`);
  const codes = [];
  for (const code of [label.primary, ...label.secondaries]) {
    const sections = entry[code]?.subtopics;
    if (sections === undefined) {
      if (code !== label.primary) throw new Error(`9618 ${id} secondary section ${code} has no reviewed subsection`);
      continue;
    }
    if (!Array.isArray(sections) || !sections.length || new Set(sections).size !== sections.length || typeof entry[code].evidence !== "string" || !entry[code].evidence.trim()) throw new Error(`9618 ${id} overlay entry for ${code} is malformed`);
    for (const section of sections) {
      if (subtopicsByCode.get(section)?.topic !== code) throw new Error(`9618 ${id} subsection ${section} is not under section ${code}`);
      if (code === label.primary && section === label.primary_subtopic) throw new Error(`9618 ${id} overlay repeats the primary subsection ${section}`);
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
  await pinned(sourceRoot, "data/source-manifest.json", SOURCE_SHA256.sourceManifest);
  const acquisition = await pinned(sourceRoot, "data/acquisition-manifest.json", SOURCE_SHA256.acquisitionManifest);
  const held = await pinned(sourceRoot, "data/held-questions.json", SOURCE_SHA256.heldQuestions);
  const fullMarksNotes = await pinned(sourceRoot, "data/review/full-marks-notes.json", SOURCE_SHA256.fullMarksNotes);
  const fullMarksReviewed = await pinned(sourceRoot, "data/review/full-marks-notes-reviewed.json", SOURCE_SHA256.fullMarksNotesReviewed);
  const msMarksReviewed = await pinned(sourceRoot, "data/review/ms-marks-reviewed.json", SOURCE_SHA256.msMarksReviewed);
  const sectionOverlay = await pinned(sourceRoot, "data/classification/secondary-subtopics.json", SOURCE_SHA256.secondarySubtopics);
  await pinnedBytes(sourceRoot, "data/extras/9618-syllabus-2026.pdf", SOURCE_SHA256.syllabus2026);
  const coverage = await pinned(sourceRoot, "data/coverage-receipt.json", SOURCE_SHA256.coverageReceipt);
  if (sectionOverlay.inputs?.final_labels_sha256 !== SOURCE_SHA256.labels || sectionOverlay.inputs?.taxonomy_sha256 !== SOURCE_SHA256.taxonomy || sectionOverlay.inputs?.segmentation_sha256 !== SOURCE_SHA256.segmentation) throw new Error("9618 secondary-subtopic overlay was made against different inputs");
  const blind = await blindTranscripts(sourceRoot);
  if (blind.pin !== SOURCE_SHA256.blindResults) throw new Error(`9618 blind results ${blind.pin} != pinned ${SOURCE_SHA256.blindResults}`);
  if (Object.keys(held.questions).length || finalLabels.held.length) throw new Error("9618 held questions appeared; review before building");
  if (finalLabels.review_overlays?.length || finalLabels.review_corrections?.length) throw new Error("9618 final labels carry review overlays; review before building");
  if (finalLabels.dropped_empty_earlier_syllabus_topics.length) throw new Error("9618 final labels name earlier-syllabus topics");
  if (coverage.verdict !== "PASS" || coverage.crop_assets_verified !== EXPECTED.crops) throw new Error("9618 coverage receipt is not PASS");

  // Full-marks notes: exactly the two reviewed papers, both served.
  if (JSON.stringify(Object.keys(fullMarksNotes.papers).sort()) !== JSON.stringify(Object.keys(FULL_MARKS_NOTES))) throw new Error("9618 full-marks notes drifted");
  for (const [paperId, expected] of Object.entries(FULL_MARKS_NOTES)) {
    const decided = fullMarksReviewed.cases[paperId];
    if (!decided || decided.decision !== "serve" || JSON.stringify(decided.parts) !== JSON.stringify(expected.parts) || JSON.stringify(fullMarksNotes.papers[paperId].parts) !== JSON.stringify(expected.parts)) throw new Error(`9618 ${paperId} full-marks decision is not the reviewed "serve"`);
  }
  if (JSON.stringify(Object.keys(fullMarksReviewed.cases).sort()) !== JSON.stringify(Object.keys(FULL_MARKS_NOTES))) throw new Error("9618 full-marks decisions drifted");
  if (JSON.stringify(Object.keys(msMarksReviewed.questions)) !== JSON.stringify(Object.keys(MS_MARKS_REVIEWED))) throw new Error("9618 reviewed MS-mark cases drifted");

  if (!canonical.frozen || canonical.canonical_questions.length !== EXPECTED.rows) throw new Error("9618 canonical manifest drifted");
  if (canonical.counts.alias_papers !== EXPECTED.aliasPapers || Object.keys(canonical.aliases).length !== EXPECTED.aliases) throw new Error("9618 alias set drifted");
  const canonicalById = new Map(canonical.canonical_questions.map((question) => [question.id, question]));
  const labels = new Map(finalLabels.labels.map((label) => [label.id, label]));
  if (labels.size !== EXPECTED.labels || finalLabels.labels.length !== EXPECTED.labels) throw new Error("9618 labels do not cover the release once each");
  const topicsByCode = new Map(sourceTaxonomy.topics.map((entry) => [entry.code, entry]));
  const subtopicsByCode = new Map(sourceTaxonomy.topics.flatMap((entry) => entry.subtopics.map((subtopic) => [subtopic.code, { ...subtopic, topic: entry.code }])));
  const labelFor = topicLabels(sourceTaxonomy);
  const sectionLabelFor = subtopicLabels(sourceTaxonomy);

  const sourceQuestions = segmentation.papers.flatMap((paper) => paper.questions.map((question) => ({ paper, question })));
  if (segmentation.papers.length !== EXPECTED.papers || sourceQuestions.length !== EXPECTED.rows || segmentation.summary.failed.length || segmentation.summary.pairs_with_issues.length || !segmentation.summary.canonical_id_set_matches_frozen_manifest) throw new Error(`9618 segmentation ${sourceQuestions.length} questions in ${segmentation.papers.length} papers`);
  if (JSON.stringify(sourceQuestions.map(({ question }) => question.id).sort()) !== JSON.stringify([...canonicalById.keys()].sort())) throw new Error("9618 segmentation ids differ from the frozen canonical set");

  if (acquisition.pair_count !== EXPECTED.sourcePapers || acquisition.document_count !== EXPECTED.sourcePapers * 2) throw new Error("9618 acquisition manifest drifted");
  const sourceUrl = (paperId, kind) => {
    const url = acquisition.papers[paperId]?.[kind]?.final_url;
    if (typeof url !== "string" || !url.startsWith("https://")) throw new Error(`9618 ${paperId} ${kind} has no kept source file`);
    return url;
  };

  const questions = [];
  const used = new Map();
  const overlayRowsUsed = new Set();
  let crops = 0;
  for (const { paper, question } of sourceQuestions) {
    const entry = canonicalById.get(question.id);
    const facts = PAPER_FACTS[question.paper];
    if (question.held || question.excluded_from_practice || entry.excluded_from_practice) throw new Error(`9618 ${question.id} is held or excluded`);
    const reviewedMs = MS_MARKS_REVIEWED[question.id];
    const expectedStatus = reviewedMs ? "reconciled_ms_cell_blank_reviewed" : "reconciled";
    if (question.marks_status !== expectedStatus || entry.marks_status !== question.marks_status) throw new Error(`9618 ${question.id} marks status ${question.marks_status}`);
    if (reviewedMs ? question.marks !== reviewedMs.qpMarks || question.ms_marks !== reviewedMs.msMarks || msMarksReviewed.questions[question.id].qp_marks !== reviewedMs.qpMarks : question.ms_marks !== question.marks) throw new Error(`9618 ${question.id} MS marks ${question.ms_marks} != QP ${question.marks}`);
    const label = labels.get(question.id);
    if (!label) throw new Error(`9618 ${question.id} has no final label`);
    if (!PAPERS.has(question.paper) || label.paper !== question.paper || entry.paper_number !== question.paper) throw new Error(`9618 ${question.id} paper mismatch`);
    if (paper.printed_total !== facts.totalMarks || paper.ms_maximum !== facts.totalMarks) throw new Error(`9618 ${paper.paper_id} total ${paper.printed_total}/${paper.ms_maximum} != syllabus ${facts.totalMarks}`);
    if (paper.issues.length || paper.source_exceptions.length) throw new Error(`9618 ${paper.paper_id} has unreviewed issues`);
    if (entry.printed_marks !== question.marks || !(question.marks > 0)) throw new Error(`9618 ${question.id} marks drifted`);
    if (question.format !== "structured" || label.format !== question.format || entry.format !== question.format) throw new Error(`9618 ${question.id} format ${question.format}`);
    if (question.removed_parts.length) throw new Error(`9618 ${question.id} removed parts ${JSON.stringify(question.removed_parts)}`);
    if (question.mcq_key !== null || entry.mcq_key !== null || question.choice_group !== null || question.choice_required !== null || question.section !== null) throw new Error(`9618 ${question.id} has an MCQ key, choice group or section`);
    if (question.levels_tables_from !== null || question.levels_text) throw new Error(`9618 ${question.id} has a levels table`);
    const fullMarks = FULL_MARKS_NOTES[paper.paper_id];
    if (fullMarks?.question === question.id && question.marks !== fullMarks.marks) throw new Error(`9618 ${question.id} is not served at its printed ${fullMarks.marks} marks`);

    const codes = [label.primary, ...label.secondaries];
    if (new Set(codes).size !== codes.length) throw new Error(`9618 ${question.id} repeats a label`);
    const [low, high] = facts.sections;
    const resolved = codes.map((code) => {
      const topic = topicsByCode.get(code);
      if (!topic) throw new Error(`9618 ${question.id} uses unknown section ${code}`);
      // Each paper assesses its own syllabus sections only (assessment overview).
      if (Number(code) < low || Number(code) > high) throw new Error(`9618 ${question.id} section ${code} is outside Paper ${question.paper}'s ${low}-${high}`);
      return topic;
    });
    const subtopic = subtopicsByCode.get(label.primary_subtopic);
    if (!subtopic || subtopic.topic !== label.primary) throw new Error(`9618 ${question.id} subsection ${label.primary_subtopic} is not under ${label.primary}`);
    const primarySubtopic = [sectionLabelFor.get(subtopic.code)];
    const furtherCodes = furtherSections(question.id, label, sectionOverlay.rows[question.id] ?? {}, subtopicsByCode);
    if (sectionOverlay.rows[question.id]) overlayRowsUsed.add(question.id);
    const furtherSubtopics = furtherCodes.map((code) => sectionLabelFor.get(code));
    const subtopics = [...primarySubtopic, ...furtherSubtopics];
    const session = SESSION_LABELS[question.session];
    if (!session || SERIES_CODES[question.session] !== entry.series_code) throw new Error(`9618 ${question.id} session ${question.session}`);
    const component = paper.paper_id.split("-")[3];
    if (component !== `${question.paper}${question.variant}` || entry.component !== component) throw new Error(`9618 ${question.id} component ${component}`);
    if (entry.exam_status !== "sat") throw new Error(`9618 ${question.id} exam status ${entry.exam_status}`);
    for (const alias of entry.alias_ids) if (canonical.aliases[alias]?.canonical_id !== question.id) throw new Error(`9618 alias ${alias} does not resolve to ${question.id}`);
    const transcript = blind.transcripts.get(question.id);
    if (!transcript) throw new Error(`9618 ${question.id} has no blind transcript`);
    const questionImages = question.question_images.map((asset) => runtimeAsset("questions", asset, paper.paper_id));
    const markschemeImages = question.markscheme_images.map((asset) => runtimeAsset("markschemes", asset, paper.paper_id));
    if (!questionImages.length || !markschemeImages.length) throw new Error(`9618 ${question.id} is missing crops`);
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
      paper: question.paper,
      year: question.year,
      session,
      examStatus: entry.exam_status,
      format: question.format,
      zone: `Variant ${question.variant}`,
      component,
      courseEra: ERA,
      era: ERA,
      subject: "Computer Science",
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
      maxMarks: facts.totalMarks,
      marksSource: "printed_question_paper",
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
  if (strayOverlayRows.length) throw new Error(`9618 secondary-subtopic overlay rows for questions not in the release: ${strayOverlayRows.join(", ")}`);
  if (questions.length !== EXPECTED.rows || new Set(questions.map((question) => question.id)).size !== EXPECTED.rows) throw new Error(`9618 rows ${questions.length}`);
  for (const [paper, count] of Object.entries(EXPECTED.byPaper)) if (questions.filter((question) => question.paper === Number(paper)).length !== count) throw new Error(`9618 Paper ${paper} count drifted`);
  const papers = new Set(questions.map((question) => question.paperId));
  if (papers.size !== EXPECTED.papers) throw new Error(`9618 papers ${papers.size}`);
  const years = questions.map((question) => question.year);
  const yearRange = `${Math.min(...years)}-${Math.max(...years)}`;
  if (yearRange !== EXPECTED.years) throw new Error(`9618 years ${yearRange}`);
  if (questions.filter((question) => FREE_YEARS.includes(question.year)).length !== EXPECTED.freeRows) throw new Error("9618 free-year count drifted");
  if (crops !== EXPECTED.crops) throw new Error(`9618 crops ${crops}`);
  if (used.size !== EXPECTED.topics) throw new Error(`9618 sections used ${used.size}`);

  const aliases = Object.fromEntries(questions.flatMap((question) => question.aliasIds.map((alias) => [alias, question.id])).sort(([a], [b]) => a.localeCompare(b)));
  if (Object.keys(aliases).length !== EXPECTED.aliases) throw new Error("9618 alias count drifted");

  const taxonomy = studentTaxonomy(sourceTaxonomy, used, labelFor, sectionLabelFor);
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
    paperFacts: Object.fromEntries(Object.entries(PAPER_FACTS).map(([paper, facts]) => [paper, { name: facts.name, durationMinutes: facts.durationMinutes, totalMarks: facts.totalMarks }])),
    heldQuestionIds: [],
    excludedQuestionIds: [],
    fullMarksAwardedNotes: Object.entries(FULL_MARKS_NOTES).map(([paperId, note]) => ({ paperId, questionId: note.question, parts: note.parts, decision: "served_at_printed_marks" })),
    sourceCandidate: { paths: ["data/classification/final-labels.json"], sha256: [SOURCE_SHA256.labels], questionCount: questions.length },
    taxonomy: { path: TAXONOMY_OUTPUT, version: taxonomy.version, sha256: taxonomyFileSha },
    questions,
    publicationStatus: CANDIDATE_PUBLICATION_STATUS,
    assetVerification: "pending_upload",
    runtimeArtifact: {
      schemaVersion: "igcse-production-runtime-v1",
      sourceRepository: "cambridge-a-level-computer-science-9618-topic-practice",
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
      byPaper: EXPECTED.byPaper, freeRows: EXPECTED.freeRows, crops, blindPin: blind.pin,
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
  const note = file.note.includes(ALIAS_NOTE_9618) ? file.note : `${file.note} ${ALIAS_NOTE_9618}`;
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
  } else if (process.argv.includes("--check")) {
    const built = await buildRuntime();
    console.log(JSON.stringify({ ...built.report, seals: built.seals }, null, 2));
  } else {
    const result = await writeRuntime();
    console.log(JSON.stringify({ ...result.report, seals: result.seals, output: result.output }, null, 2));
  }
}
