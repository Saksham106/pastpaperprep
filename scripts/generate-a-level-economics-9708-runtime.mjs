#!/usr/bin/env node
/**
 * Build the Cambridge International AS & A Level Economics 9708 candidate runtime from the pinned source workspace
 * (cambridge-a-level-economics-9708-topic-practice, commit bbd10f4: the e6d88fe data plus the reviewed secondary-subtopic
 * overlay). Every input is SHA-256 pinned; any drift fails closed.
 *
 *   data/segmentation/full/segmentation.json   3,230 canonical questions in 183 canonical papers (P1, P2, P3, P4)
 *   data/classification/final-labels.json      3,208 labels: primary topic, primary_subtopic, secondaries
 *   data/taxonomy/taxonomy.json                topics 1-11 (9708:2023:<n>, AS 1-6, A Level 7-11) and 4 earlier-syllabus topics
 *   data/canonical-manifest.json               canonical ids, exam status, alias ids, MCQ keys, essay choice groups
 *   data/held-questions.json                   16 held: 14 data-response Q1s whose published QP has content removed for
 *                                              copyright, and 2 MCQ items (an item misprint and a disputed key)
 *   data/crop-revisions.json                   empty (asserted)
 *   data/paper-facts.json                      totals and durations per syllabus era from the assessment overviews:
 *                                              2020-2022 (P2 40 marks / 90 min, P4 70 / 135) and 2023+ (both 60 / 120)
 *   data/review/mcq-key-corrections.json       one key served from Cambridge's examiner report (2020-w-12 Q25: MS B, ER C)
 *   data/source-manifest.json + acquisition-manifest.json   kept, identity-checked source files
 *   data/classification/blind-results/*.json   blind-pass transcriptions, used as accessible text
 *   data/classification/secondary-subtopics.json      reviewed overlay (the #499 review fix): the subtopic sections each
 *                                              current secondary topic materially assesses, and any further section of the
 *                                              primary topic, with mark evidence
 *
 * Economics specifics carried into the rows:
 *   - Six multiple-choice items Cambridge removed from the paper ("Question discounted"/withdrawn, no key) are
 *     excluded from practice. They are not rows and not in the upload plan.
 *   - Essays are choices. Every essay row carries `choiceGroup` and `choiceRequired` from the source:
 *     2020-2022 Paper 2 Section B (one of three), 2020-2022 Paper 4 Section B (two of six), and 2023+ Papers 2 and 4
 *     Sections B and C (one of two each). Section A data response is compulsory and has no group.
 *   - Mark schemes keep their levels tables: 2023+ essay MS crops end with the generic Table A/Table B crops
 *     (`q<n>-levels-<page>-<k>.webp`). Three mark schemes print them only in a sibling variant; those crops are copies
 *     taken from that variant and stored under the question's own paper.
 *   - Topic labels: five A Level topics reuse an AS title (7-11 vs 2-6), so the A Level ones say "(A Level)".
 *   - Subtopics: the primary subtopic first, then the reviewed further sections in syllabus order (`subtopics`,
 *     `detailedSubtopics`); the further sections alone are `secondarySubtopics`. Every current secondary topic has at
 *     least one section; earlier-syllabus topics have none. Two A Level sections reuse an AS section's title and say
 *     "(A Level)" too, so every subtopic label names one syllabus section.
 *
 * Multiple-choice rows carry the official key as `answer` with official `answerProvenance`. Each key was read two
 * independent ways in the source (mark-scheme text and rendered view; both must agree) and a third time from the
 * examiner reports' key tables (1,467/1,468 agree). The one disagreement, 9708-2020-w-12-q25, is served from the
 * examiner report (C), as the source's reviewed correction records; its mark-scheme crop still shows the printed B.
 *
 * Writes src/data/production/a-level-economics-9708.json, src/data/private-index/a-level-economics-9708.json,
 * src/data/a-level-economics-9708-taxonomy.json and the bank's alias ids in src/data/question-id-aliases.json.
 * The runtime stays a candidate until the owner-approved R2 upload is read back and it is finalized.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const BANK = "a-level-economics-9708";
export const RIGHTS_STATUS = "user_attested_rights_authorized";
export const CANDIDATE_PUBLICATION_STATUS = "authorized_production_candidate";
export const DEFAULT_SOURCE_ROOT = "/Users/sakshamgoel/Documents/ProjectsInternships/cambridge-a-level-economics-9708-topic-practice";
export const SOURCE_COMMIT = "bbd10f4";
export const SOURCE_SHA256 = {
  segmentation: "dca6685ec88b40dcfff7aecd7f3628a115e4bcc5e2dfb4308259cdc9553f6543",
  labels: "700a60e458a14c2fe3bd4607744d354807c06113695dc0530bb1e4363040d466",
  taxonomy: "72b902b9dd24f2245ff09dde34952427ad82e765cf98e71bb1f8b01738c5de50",
  canonicalManifest: "d765e40e0ebf70ef89d48863e7402bb9d35582f5cec02e914181f28276d73c12",
  paperFacts: "4303170610563702d7aa6b22dd132452940cf009b03bdad4773618f88bd9bd15",
  sourceManifest: "bb713e7d9251dbe916002c63ab7dadf56a8ffe0e0308293299131ef8bf797fc7",
  acquisitionManifest: "ead8f7c4565b27aca41a5a914a76bf3b21edab69f27170d8bbfa0f6c3a9a9070",
  heldQuestions: "dae4ad81ad8aef90c8c47880970778b5467af57b33d3f7098ecdea3c61d1cfc8",
  cropRevisions: "06a2c300f9be42b1a9602180c547a9a0598f82c531da87bbcebe34c0b19c48f5",
  mcqKeyCorrections: "33055812662956aa8fcecdcd305a96889aba8b3f7f8e771aa0da73a09426a9d1",
  secondarySubtopics: "a7b4a90cbd4ecdd8c1affb37c27d95a29c0d8c9f5b4c271e506564c722540b6e",
  /** SHA-256 over the sorted "<file> <sha256>" lines of every top-level blind-results/*.json file. */
  blindResults: "6e2d8ac9bb23d4568fcfb9ef54572dbf0c938516cf31e171ae22854736f89fd1",
};
export const HELD = [
  "9708-2020-w-42-q1", "9708-2021-m-22-q1", "9708-2022-w-42-q1", "9708-2023-m-22-q1", "9708-2023-w-13-q24", "9708-2023-w-42-q1",
  "9708-2025-m-42-q1", "9708-2025-s-21-q1", "9708-2025-s-24-q1", "9708-2025-s-41-q1", "9708-2025-s-42-q1", "9708-2025-w-13-q17",
  "9708-2025-w-22-q1", "9708-2025-w-23-q1", "9708-2026-s-22-q1", "9708-2026-s-23-q1",
];
/** Held for a reason other than content removed for copyright: an item misprint and a key with no official confirmation. */
export const HELD_MCQ = { "9708-2023-w-13-q24": "official_item_misprint", "9708-2025-w-13-q17": "official_key_disputed" };
export const EXCLUDED = ["9708-2023-s-11-q22", "9708-2023-s-11-q30", "9708-2024-s-12-q4", "9708-2024-s-12-q6", "9708-2024-s-12-q8", "9708-2025-s-14-q2"];
/** The one alias whose canonical question is held: 9708-2025-s-43 reprints 9708-2025-s-41. */
export const HELD_ALIASES = ["9708-2025-s-43-q1"];
/** May/June 2023 Papers 2 and 4: the MS cover still prints the 2020-2022 maximum; the QP total is the syllabus's (source exception). */
export const STALE_MS_MAXIMUM = { "9708-2023-s-21": 40, "9708-2023-s-22": 40, "9708-2023-s-23": 40, "9708-2023-s-41": 70, "9708-2023-s-42": 70 };
export const KEY_CORRECTIONS ={ "9708-2020-w-12-q25": { markScheme: "B", served: "C" } };
export const EXPECTED = {
  rows: 3208, segmented: 3230, papers: 183, aliases: 250, byPaper: { 1: 1492, 2: 216, 3: 1260, 4: 240 }, topics: 11, earlierTopics: 4,
  freeRows: 918, notSatRows: 176, years: "2020-2026", sourcePapers: 197, choiceRows: 379, levelsTableCrops: 420,
};
export const TAXONOMY_OUTPUT = "src/data/a-level-economics-9708-taxonomy.json";
export const ALIASES_OUTPUT = "src/data/question-id-aliases.json";
export const ALIAS_NOTE_9708 = "A Level Economics 9708: a variant that reprints another variant of the same series maps to the canonical question, from the source workspace's frozen canonical manifest (the alias of a held question is left out).";
const SESSION_LABELS = { february_march: "March", may_june: "June", october_november: "November" };
const SERIES_CODES = { february_march: "m", may_june: "s", october_november: "w" };
const PAPERS = new Set([1, 2, 3, 4]);
const MCQ_PAPERS = new Set([1, 3]);
const COURSE = "Cambridge International AS & A Level Economics 9708";
/** The syllabus era a question was set under: 2020-2022 papers follow the 2019-2021/2022 syllabuses, 2023+ the revision. */
const eraOf = (year) => (year <= 2022 ? "2019" : "2023");
/** Source group + how many answers it wants -> the served choice group. */
const CHOICE_GROUPS = {
  "2:2019:section_b:1": "section_b_answer_one",
  "4:2019:section_b:2": "section_b_answer_two",
  "2:2023:section_b:1": "section_b_answer_one",
  "2:2023:section_c:1": "section_c_answer_one",
  "4:2023:section_b:1": "section_b_answer_one",
  "4:2023:section_c:1": "section_c_answer_one",
};

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function sourceRootPath(environment = process.env) {
  return environment.PASTPAPERPREP_A_LEVEL_ECONOMICS_SOURCE_ROOT?.trim() || DEFAULT_SOURCE_ROOT;
}

async function pinned(sourceRoot, relative, expected) {
  const bytes = await readFile(path.join(sourceRoot, relative));
  const actual = sha256(bytes);
  if (actual !== expected) throw new Error(`9708 source ${relative} SHA-256 ${actual} != pinned ${expected}`);
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
      if (transcripts.has(row.id)) throw new Error(`9708 ${row.id} has more than one blind transcript`);
      transcripts.set(row.id, row.transcript.trim());
    }
  }
  return { pin: sha256(`${lines.join("\n")}\n`), transcripts };
}

/** Unique student-facing labels: an A Level topic that reuses an AS title says "(A Level)" (topics 7-11 in 9708). */
export function topicLabels(source) {
  const asTitles = new Set(source.topics.filter((entry) => entry.level === "AS").map((entry) => entry.title));
  const labels = new Map();
  for (const entry of source.topics) labels.set(entry.code, entry.level === "A Level" && asTitles.has(entry.title) ? `${entry.title} (A Level)` : entry.title);
  for (const entry of source.earlier_syllabus_topics) labels.set(entry.code, entry.title);
  if (new Set(labels.values()).size !== labels.size) throw new Error("9708 topic labels are not unique");
  return labels;
}

/**
 * Unique subtopic labels: an A Level section that reuses an AS section's title says "(A Level)" ("Exchange rates" is
 * 6.4 and 11.2; "Government macroeconomic policy objectives" is 5.1 and 10.1), so a subtopic filter never mixes them.
 */
export function subtopicLabels(source) {
  const asTitles = new Set(source.topics.filter((entry) => entry.level === "AS").flatMap((entry) => entry.subtopics.map((subtopic) => subtopic.title)));
  const labels = new Map();
  for (const entry of source.topics) for (const subtopic of entry.subtopics) labels.set(subtopic.code, entry.level === "A Level" && asTitles.has(subtopic.title) ? `${subtopic.title} (A Level)` : subtopic.title);
  if (new Set(labels.values()).size !== labels.size) throw new Error("9708 subtopic labels are not unique");
  return labels;
}

/** Student taxonomy: topics 1-11 (with subtopics), then the used earlier-syllabus topics; question counts per topic. */
export function studentTaxonomy(source, used, labels, sectionLabels) {
  const topic = (entry, earlier) => ({
    id: entry.id, code: entry.code, label: labels.get(entry.code), syllabusTitle: entry.title, level: entry.level, era: entry.era, earlierSyllabus: earlier, official: true,
    questions: used.get(entry.id) ?? 0,
    subtopics: (entry.subtopics ?? []).map((subtopic) => ({ code: subtopic.code, label: sectionLabels.get(subtopic.code), syllabusTitle: subtopic.title })),
  });
  const earlier = source.earlier_syllabus_topics.filter((entry) => used.has(entry.id));
  const topics = [...source.topics.map((entry) => topic(entry, false)), ...earlier.map((entry) => topic(entry, true))];
  if (source.topics.length !== EXPECTED.topics || earlier.length !== EXPECTED.earlierTopics) throw new Error("9708 taxonomy shape drifted");
  return {
    artifact: "a_level_economics_9708_student_taxonomy",
    version: source.version,
    qualification: "9708",
    note: "Topics 1-11 of the 2023 revision in syllabus order (AS 1-6, A Level 7-11; the five A Level topics that share an AS title say \"(A Level)\"), then content the revision removed as named earlier-syllabus topics (2020-2022 papers only). Each paper is its own tab; P1/P2 test AS content, P3/P4 A Level content with AS assumed.",
    sourceTaxonomyPath: "data/taxonomy/taxonomy.json",
    sourceTaxonomySHA256: SOURCE_SHA256.taxonomy,
    topics,
  };
}

function runtimeAsset(kind, asset, paperId) {
  const match = /^assets\/(9708-20\d{2}-[msw]-\d{2})\/(questions|markschemes)\/(q\d+-(?:levels-)?\d+-\d+\.webp)$/.exec(asset.path);
  if (!match || match[2] !== kind || match[1] !== paperId) throw new Error(`Unexpected 9708 ${kind} asset path: ${asset.path}`);
  if (Boolean(asset.levels_table) !== match[3].includes("-levels-") || (asset.levels_table && kind !== "markschemes")) throw new Error(`9708 levels-table flag disagrees with ${asset.path}`);
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
  for (const code of Object.keys(entry)) if (!allowed.has(code)) throw new Error(`9708 ${id} overlay names topic ${code}, which is not its primary or a secondary`);
  const codes = [];
  for (const code of [label.primary, ...label.secondaries]) {
    const topic = topicsByCode.get(code);
    const sections = entry[code]?.subtopics;
    if (topic.era === "2019") {
      if (sections !== undefined) throw new Error(`9708 ${id} overlay gives sections to earlier-syllabus topic ${code}`);
      continue;
    }
    if (sections === undefined) {
      if (code !== label.primary) throw new Error(`9708 ${id} secondary topic ${code} has no reviewed section`);
      continue;
    }
    if (!Array.isArray(sections) || !sections.length || new Set(sections).size !== sections.length || typeof entry[code].evidence !== "string" || !entry[code].evidence.trim()) throw new Error(`9708 ${id} overlay entry for ${code} is malformed`);
    for (const section of sections) {
      if (subtopicsByCode.get(section)?.topic !== code) throw new Error(`9708 ${id} section ${section} is not under topic ${code}`);
      if (code === label.primary && section === label.primary_subtopic) throw new Error(`9708 ${id} overlay repeats the primary subtopic ${section}`);
    }
    codes.push(...sections);
  }
  const order = [...subtopicsByCode.keys()];
  return [...new Set(codes)].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

/** The served multiple-choice key and its provenance: two equal reads, or the reviewed examiner-report correction. */
export function mcqKey(question, entry, corrections) {
  if (question.marks !== 1 || !/^[ABCD]$/.test(question.mcq_key ?? "") || question.mcq_key !== question.mcq_key_text || entry.mcq_key !== question.mcq_key) throw new Error(`9708 ${question.id} MCQ key reads disagree`);
  const keyReads = { markSchemeText: question.mcq_key_text, renderedView: question.mcq_key };
  const correction = corrections[question.id];
  const expected = KEY_CORRECTIONS[question.id];
  if (Boolean(correction) !== Boolean(expected)) throw new Error(`9708 ${question.id} key correction drifted`);
  if (!correction) return { answer: question.mcq_key, answerProvenance: { status: "official", questionId: question.id, keyReads } };
  if (correction.ms_key !== question.mcq_key || correction.ms_key !== expected.markScheme || correction.served_key !== expected.served || !/examiner report|_er\.pdf/i.test(correction.source)) throw new Error(`9708 ${question.id} key correction does not match the reviewed one`);
  return {
    answer: correction.served_key,
    answerProvenance: { status: "official", questionId: question.id, keyReads: { ...keyReads, examinerReport: correction.served_key }, servedFrom: "examiner_report_key_table", source: correction.source },
  };
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
  const keyCorrections = await pinned(sourceRoot, "data/review/mcq-key-corrections.json", SOURCE_SHA256.mcqKeyCorrections);
  const sectionOverlay = await pinned(sourceRoot, "data/classification/secondary-subtopics.json", SOURCE_SHA256.secondarySubtopics);
  if (sectionOverlay.inputs?.final_labels_sha256 !== SOURCE_SHA256.labels || sectionOverlay.inputs?.taxonomy_sha256 !== SOURCE_SHA256.taxonomy || sectionOverlay.inputs?.segmentation_sha256 !== SOURCE_SHA256.segmentation) throw new Error("9708 secondary-subtopic overlay was made against different inputs");
  const blind = await blindTranscripts(sourceRoot);
  if (blind.pin !== SOURCE_SHA256.blindResults) throw new Error(`9708 blind results ${blind.pin} != pinned ${SOURCE_SHA256.blindResults}`);
  if (JSON.stringify(Object.keys(held.questions).sort()) !== JSON.stringify(HELD)) throw new Error("9708 held set drifted");
  if (Object.keys(cropRevisions.revisions).length) throw new Error("9708 crop revisions appeared; review before building");
  if (JSON.stringify(Object.keys(keyCorrections.corrections)) !== JSON.stringify(Object.keys(KEY_CORRECTIONS))) throw new Error("9708 MCQ key corrections drifted");
  if (finalLabels.labels.some((label) => HELD.includes(label.id) || EXCLUDED.includes(label.id))) throw new Error("9708 a held or excluded question has a final label");
  if (finalLabels.review_overlays?.length || finalLabels.review_corrections?.length) throw new Error("9708 final labels carry review overlays; review before building");

  if (!canonical.frozen || canonical.canonical_questions.length !== EXPECTED.segmented) throw new Error("9708 canonical manifest drifted");
  const canonicalById = new Map(canonical.canonical_questions.map((question) => [question.id, question]));
  const labels = new Map(finalLabels.labels.map((label) => [label.id, label]));
  if (labels.size !== EXPECTED.rows || finalLabels.labels.length !== EXPECTED.rows) throw new Error("9708 labels do not cover the release once each");
  const topicsByCode = new Map([...sourceTaxonomy.topics, ...sourceTaxonomy.earlier_syllabus_topics].map((entry) => [entry.code, entry]));
  const subtopicsByCode = new Map(sourceTaxonomy.topics.flatMap((entry) => entry.subtopics.map((subtopic) => [subtopic.code, { ...subtopic, topic: entry.code }])));
  const labelFor = topicLabels(sourceTaxonomy);
  const sectionLabelFor = subtopicLabels(sourceTaxonomy);

  const sourceQuestions = segmentation.papers.flatMap((paper) => paper.questions.map((question) => ({ paper, question })));
  if (segmentation.papers.length !== EXPECTED.papers || sourceQuestions.length !== EXPECTED.segmented) throw new Error(`9708 segmentation ${sourceQuestions.length} questions in ${segmentation.papers.length} papers`);
  if (JSON.stringify(sourceQuestions.map(({ question }) => question.id).sort()) !== JSON.stringify([...canonicalById.keys()].sort())) throw new Error("9708 segmentation ids differ from the frozen canonical set");

  if (acquisition.pair_count !== EXPECTED.sourcePapers || acquisition.document_count !== EXPECTED.sourcePapers * 2) throw new Error("9708 acquisition manifest drifted");
  const sourceUrl = (paperId, kind) => {
    const url = acquisition.papers[paperId]?.[kind]?.final_url;
    if (typeof url !== "string" || !url.startsWith("https://")) throw new Error(`9708 ${paperId} ${kind} has no kept source file`);
    return url;
  };

  const factsFor = (paperNumber, year) => {
    const facts = paperFacts.papers[String(paperNumber)]?.by_era?.[eraOf(year)];
    if (!facts || !(facts.total_marks > 0) || !(facts.duration_minutes > 0)) throw new Error(`9708 Paper ${paperNumber} has no facts for ${year}`);
    return facts;
  };

  const questions = [];
  const used = new Map();
  const skipped = [];
  let choiceRows = 0;
  let levelsTableCrops = 0;
  const overlayRowsUsed = new Set();
  for (const { paper, question } of sourceQuestions) {
    const entry = canonicalById.get(question.id);
    if (HELD.includes(question.id)) {
      const reason = HELD_MCQ[question.id] ?? "official_qp_content_removed";
      if (!question.held || question.marks_status !== reason || held.questions[question.id].reason !== reason || labels.has(question.id)) throw new Error(`9708 held question ${question.id} is not held in the source for ${reason}`);
      if (!HELD_MCQ[question.id] && (question.number !== 1 || question.format !== "data_response")) throw new Error(`9708 held ${question.id} is not a data-response Q1`);
      skipped.push(question.id);
      continue;
    }
    if (EXCLUDED.includes(question.id)) {
      if (!question.excluded_from_practice || !entry.excluded_from_practice || question.marks_status !== "official_question_removed" || question.mcq_key !== null || labels.has(question.id)) throw new Error(`9708 excluded question ${question.id} is not a removed item in the source`);
      skipped.push(question.id);
      continue;
    }
    if (question.held || question.excluded_from_practice || entry.excluded_from_practice) throw new Error(`9708 ${question.id} is held or excluded outside the expected sets`);
    if (!["reconciled", "reconciled_ao_split", "reconciled_ms_cell_blank_reviewed"].includes(question.marks_status) || entry.marks_status !== question.marks_status) throw new Error(`9708 ${question.id} marks status ${question.marks_status}`);
    const label = labels.get(question.id);
    if (!label) throw new Error(`9708 ${question.id} has no final label`);
    if (!PAPERS.has(question.paper) || label.paper !== question.paper || entry.paper_number !== question.paper) throw new Error(`9708 ${question.id} paper mismatch`);
    const era = eraOf(question.year);
    const facts = factsFor(question.paper, question.year);
    if (paper.printed_total !== facts.total_marks) throw new Error(`9708 ${paper.paper_id} printed total ${paper.printed_total} != syllabus ${facts.total_marks}`);
    if (paper.ms_maximum !== facts.total_marks) {
      const stale = STALE_MS_MAXIMUM[paper.paper_id];
      if (paper.ms_maximum !== stale || !paper.source_exceptions.some((note) => note.includes(`Maximum Mark ${stale} (old template)`))) throw new Error(`9708 ${paper.paper_id} MS maximum ${paper.ms_maximum} != syllabus ${facts.total_marks}`);
    }
    if (entry.printed_marks !== question.marks || !(question.marks > 0)) throw new Error(`9708 ${question.id} marks drifted`);
    const mcq = question.format === "multiple_choice";
    if (mcq !== MCQ_PAPERS.has(question.paper) || label.format !== question.format || entry.format !== question.format) throw new Error(`9708 ${question.id} format ${question.format}`);
    if (!mcq && !["data_response", "essay"].includes(question.format)) throw new Error(`9708 ${question.id} format ${question.format}`);
    if (question.removed_parts.length) throw new Error(`9708 ${question.id} removed parts ${JSON.stringify(question.removed_parts)}`);
    const key = mcq ? mcqKey(question, entry, keyCorrections.corrections) : null;
    if (!mcq && (question.mcq_key !== null || entry.mcq_key !== null)) throw new Error(`9708 ${question.id} written question has a key`);

    // Essay choice groups: every essay is in one, data response never is; the group must match the syllabus section.
    if ((entry.choice_group ?? null) !== (question.choice_group ?? null) || (entry.choice_required ?? null) !== (question.choice_required ?? null)) throw new Error(`9708 ${question.id} choice group differs from the canonical manifest`);
    let choiceGroup = null;
    if (question.format === "essay") {
      choiceGroup = CHOICE_GROUPS[`${question.paper}:${era}:${question.choice_group}:${question.choice_required}`];
      const section = facts.sections?.[question.section];
      if (!choiceGroup || !section || section.choose !== question.choice_required || section.marks_each !== question.marks || question.choice_group !== `section_${question.section.toLowerCase()}`) throw new Error(`9708 ${question.id} essay choice ${question.choice_group}/${question.choice_required} in ${question.section}`);
      choiceRows += 1;
    } else if (question.choice_group !== null || question.choice_required !== null) throw new Error(`9708 ${question.id} ${question.format} has a choice group`);
    if (question.format === "data_response" && (question.section !== "A" || question.number !== 1 || question.marks !== facts.sections.A.marks)) throw new Error(`9708 ${question.id} data response is not Section A Q1`);

    const codes = [label.primary, ...label.secondaries];
    if (new Set(codes).size !== codes.length) throw new Error(`9708 ${question.id} repeats a label`);
    const resolved = codes.map((code) => {
      const topic = topicsByCode.get(code);
      if (!topic) throw new Error(`9708 ${question.id} uses unknown topic ${code}`);
      if (topic.era === "2019" && era !== "2019") throw new Error(`9708 ${question.id} carries an earlier-syllabus topic after 2022`);
      return topic;
    });
    let primarySubtopic = [];
    if (label.primary_subtopic !== null) {
      const subtopic = subtopicsByCode.get(label.primary_subtopic);
      if (!subtopic || subtopic.topic !== label.primary) throw new Error(`9708 ${question.id} subtopic ${label.primary_subtopic} is not under ${label.primary}`);
      primarySubtopic = [sectionLabelFor.get(subtopic.code)];
    } else if (resolved[0].era !== "2019") throw new Error(`9708 ${question.id} has no subtopic under a current topic`);
    const furtherCodes = furtherSections(question.id, label, sectionOverlay.rows[question.id] ?? {}, subtopicsByCode, topicsByCode);
    overlayRowsUsed.add(question.id);
    const furtherSubtopics = furtherCodes.map((code) => sectionLabelFor.get(code)).filter((title) => !primarySubtopic.includes(title));
    const subtopics = [...primarySubtopic, ...furtherSubtopics];
    const session = SESSION_LABELS[question.session];
    if (!session || SERIES_CODES[question.session] !== entry.series_code) throw new Error(`9708 ${question.id} session ${question.session}`);
    const component = paper.paper_id.split("-")[3];
    if (component !== `${question.paper}${question.variant}` || entry.component !== component) throw new Error(`9708 ${question.id} component ${component}`);
    const notSat = entry.exam_status === "released_not_sat";
    if (notSat !== (question.year === 2020 && question.session === "may_june") || !["sat", "released_not_sat"].includes(entry.exam_status)) throw new Error(`9708 ${question.id} exam status ${entry.exam_status}`);
    for (const alias of entry.alias_ids) if (canonical.aliases[alias]?.canonical_id !== question.id) throw new Error(`9708 alias ${alias} does not resolve to ${question.id}`);
    const transcript = blind.transcripts.get(question.id);
    if (!transcript) throw new Error(`9708 ${question.id} has no blind transcript`);
    if ([...question.question_images, ...question.markscheme_images].some((asset) => asset.shared_stimulus)) throw new Error(`9708 ${question.id} has a shared-stimulus crop`);
    const questionImages = question.question_images.map((asset) => runtimeAsset("questions", asset, paper.paper_id));
    const markschemeImages = question.markscheme_images.map((asset) => runtimeAsset("markschemes", asset, paper.paper_id));
    if (!questionImages.length || !markschemeImages.length) throw new Error(`9708 ${question.id} is missing crops`);
    const levels = question.markscheme_images.filter((asset) => asset.levels_table);
    if (levels.length && (question.format !== "essay" || era !== "2023")) throw new Error(`9708 ${question.id} has a levels table outside a 2023+ essay`);
    if (question.format === "essay" && era === "2023" && !levels.length) throw new Error(`9708 ${question.id} 2023+ essay has no levels table`);
    const firstLevels = question.markscheme_images.findIndex((asset) => asset.levels_table);
    if (firstLevels !== -1 && question.markscheme_images.slice(firstLevels).some((asset) => !asset.levels_table)) throw new Error(`9708 ${question.id} levels table is not at the end of its mark scheme`);
    for (const asset of levels) if (asset.source_paper && (asset.source_paper === paper.paper_id || question.levels_tables_from !== asset.source_paper)) throw new Error(`9708 ${question.id} borrowed levels table ${asset.path} disagrees with levels_tables_from`);
    levelsTableCrops += levels.length;
    for (const topic of resolved) used.set(topic.id, (used.get(topic.id) ?? 0) + 1);
    const [primary, ...secondaries] = resolved;
    questions.push({
      id: question.id,
      canonicalId: question.id,
      aliasIds: entry.alias_ids.filter((alias) => !HELD_ALIASES.includes(alias)),
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
      subject: "Economics",
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
      ...(question.section ? { section: question.section } : {}),
      ...(choiceGroup ? { choiceGroup, choiceRequired: question.choice_required } : {}),
      ...(key ?? {}),
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
  if (strayOverlayRows.length) throw new Error(`9708 secondary-subtopic overlay rows for questions not in the release: ${strayOverlayRows.join(", ")}`);
  if (JSON.stringify(skipped.sort()) !== JSON.stringify([...HELD, ...EXCLUDED].sort())) throw new Error(`9708 skipped ${skipped.join(", ")}`);
  if (questions.length !== EXPECTED.rows || new Set(questions.map((question) => question.id)).size !== EXPECTED.rows) throw new Error(`9708 rows ${questions.length}`);
  for (const [paper, count] of Object.entries(EXPECTED.byPaper)) if (questions.filter((question) => question.paper === Number(paper)).length !== count) throw new Error(`9708 Paper ${paper} count drifted`);
  const papers = new Set(questions.map((question) => question.paperId));
  if (papers.size !== EXPECTED.papers) throw new Error(`9708 papers ${papers.size}`);
  const years = questions.map((question) => question.year);
  const yearRange = `${Math.min(...years)}-${Math.max(...years)}`;
  if (yearRange !== EXPECTED.years) throw new Error(`9708 years ${yearRange}`);
  if (questions.filter((question) => question.year <= 2021).length !== EXPECTED.freeRows) throw new Error("9708 free-year count drifted");
  if (questions.filter((question) => question.examStatus === "released_not_sat").length !== EXPECTED.notSatRows) throw new Error("9708 not-sat count drifted");
  if (choiceRows !== EXPECTED.choiceRows) throw new Error(`9708 essay choice rows ${choiceRows}`);
  if (levelsTableCrops !== EXPECTED.levelsTableCrops) throw new Error(`9708 levels-table crops ${levelsTableCrops}`);
  if (used.size !== EXPECTED.topics + EXPECTED.earlierTopics) throw new Error(`9708 topics used ${used.size}`);
  const unusedEarlier = sourceTaxonomy.earlier_syllabus_topics.filter((entry) => !used.has(entry.id)).map((entry) => entry.code).sort();
  if (JSON.stringify(unusedEarlier) !== JSON.stringify([...finalLabels.dropped_empty_earlier_syllabus_topics].sort())) throw new Error("9708 unused earlier-syllabus topics differ from the source's dropped list");

  const aliases = Object.fromEntries(questions.flatMap((question) => question.aliasIds.map((alias) => [alias, question.id])).sort(([a], [b]) => a.localeCompare(b)));
  const heldAliases = Object.keys(canonical.aliases).filter((alias) => HELD.includes(canonical.aliases[alias].canonical_id)).sort();
  if (JSON.stringify(heldAliases) !== JSON.stringify(HELD_ALIASES)) throw new Error(`9708 aliases of held questions ${heldAliases.join(", ")}`);
  if (Object.keys(aliases).length !== EXPECTED.aliases || Object.keys(aliases).length !== Object.keys(canonical.aliases).length - HELD_ALIASES.length) throw new Error("9708 alias count drifted");

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
    // Current-syllabus facts first; the 2020-2022 era where Papers 2 and 4 differed.
    paperFacts: Object.fromEntries(Object.entries(paperFacts.papers).map(([paper, facts]) => [paper, {
      name: facts.name, durationMinutes: facts.by_era["2023"].duration_minutes, totalMarks: facts.by_era["2023"].total_marks,
      durationMinutesByEra: { 2019: facts.by_era["2019"].duration_minutes, 2023: facts.by_era["2023"].duration_minutes },
      totalMarksByEra: { 2019: facts.by_era["2019"].total_marks, 2023: facts.by_era["2023"].total_marks },
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
      sourceRepository: "cambridge-a-level-economics-9708-topic-practice",
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
      byPaper: EXPECTED.byPaper, freeRows: EXPECTED.freeRows, notSatRows: EXPECTED.notSatRows, held: HELD.length, excluded: EXCLUDED.length, choiceRows, levelsTableCrops,
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
  const note = file.note.includes(ALIAS_NOTE_9708) ? file.note : `${file.note} ${ALIAS_NOTE_9708}`;
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
