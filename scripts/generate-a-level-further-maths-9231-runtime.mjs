#!/usr/bin/env node
/**
 * Build the Cambridge International AS & A Level Further Mathematics 9231 candidate runtime from the pinned source
 * workspace (cambridge-a-level-further-mathematics-9231-topic-practice, commit f750b6f, built with ../ppp-ingestion-toolkit;
 * coverage receipt PASS, every gate passing with none waived). Every input is SHA-256 pinned; any drift fails closed.
 *
 *   data/segmentation/full/segmentation.json   813 canonical questions in 116 canonical papers (Papers 1-4)
 *   data/classification/final-labels.json      813 labels: primary section, primary learning outcome, secondary sections
 *   data/taxonomy/taxonomy.json                24 sections 1.1-4.5 (9231:2020:<code>), one set per paper, 84 learning outcomes
 *   data/canonical-manifest.json               canonical ids, exam status (sat / released_not_sat), alias ids (52 alias papers)
 *   data/held-questions.json                   empty (asserted): no content removed, no withdrawn parts
 *   data/review/full-marks-notes-reviewed.json the three Oct/Nov 2023 "all candidates were awarded full marks" notes, all served
 *                                              at their printed marks (owner, 2026-11-21: "Serve them")
 *   data/review/ms-marks-reviewed.json         the one question whose MS leaves a part-total cell blank
 *   data/source-manifest.json + acquisition-manifest.json   kept, identity-checked source files (May/June 2026: Cambridge's
 *                                              originals from Exam Easy, 32 evidenced host exceptions)
 *   data/extras/9231-syllabus-2026-2027.pdf    paper facts (assessment overview, p. 11)
 *   data/extras/9231-mf19.pdf                  the formula list (MF19, shared with 9709), pinned as the reference the app links
 *   data/classification/blind-results/*.json   blind-pass linear maths transcriptions, used as accessible text
 *   data/classification/secondary-subtopics.json      reviewed overlay: the learning outcomes each secondary section
 *                                              materially assesses, and any further outcome of the primary section, with mark evidence
 *
 * Further Mathematics specifics carried into the rows:
 *   - Four written papers, every question structured: Paper 1 Further Pure Mathematics 1 (sections 1.1-1.7), Paper 2 Further
 *     Pure Mathematics 2 (2.1-2.6), Paper 3 Further Mechanics (3.1-3.6), Paper 4 Further Probability & Statistics (4.1-4.5).
 *     Each question carries sections of its own paper only (asserted), as in 9709.
 *   - One syllabus era: the 2020-2022, 2023-2025 and 2026-2027 syllabuses share the 24 sections. Topic labels are the section
 *     titles, as in 9709: 1.4 and 2.2 are both "Matrices", so the "All papers" tab lists one Matrices topic whose learning
 *     outcomes come from both papers; a paper tab lists only its own.
 *   - Subtopics: the primary learning outcome first, then the reviewed further outcomes in syllabus order (`subtopics`,
 *     `detailedSubtopics`); the further outcomes alone are `secondarySubtopics`. 3.6.1 reads "Restitution: definitions"
 *     (the source's app note: it is recall of e and Newton's law; impacts that use e are 3.6.2).
 *   - May/June 2020 was published but not sat (Covid); those rows carry examStatus "released_not_sat".
 *
 * Writes src/data/production/a-level-further-maths-9231.json, src/data/private-index/a-level-further-maths-9231.json,
 * src/data/a-level-further-maths-9231-taxonomy.json and the bank's alias ids in src/data/question-id-aliases.json.
 * The runtime stays a candidate until the owner-approved R2 upload is read back and it is finalized.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const BANK = "a-level-further-maths-9231";
export const RIGHTS_STATUS = "user_attested_rights_authorized";
export const CANDIDATE_PUBLICATION_STATUS = "authorized_production_candidate";
export const DEFAULT_SOURCE_ROOT = "/Users/sakshamgoel/Documents/ProjectsInternships/cambridge-a-level-further-mathematics-9231-topic-practice";
export const SOURCE_COMMIT = "f750b6f";
export const SOURCE_SHA256 = {
  segmentation: "62a99b2028937d17ee2a12ea61b0272e24d51219e00c4671f1476ee3406a8f32",
  labels: "c1b91c2d6b2dfddb54e41965d8d2b47e993fb3ac5715fb5715fe90212d214f55",
  taxonomy: "b867755a074b40659c247b6d7e726e1c50a5229526e7058a3ca003deed5a249a",
  canonicalManifest: "665b0510335f6e2236bf35d04dbca2f247b9303cc135d46bf78f8d8e97154bc4",
  sourceManifest: "3b63674fc611be00fefb8f7e5a7d5807a45b16a3229f930f61beb4724e518724",
  acquisitionManifest: "ad26a98d606f57417d25065200267476aff127f71da0198328ff987fbfd8f092",
  heldQuestions: "fed54a270decfc511314f1e904360f710877d65768039290778480baffa5d669",
  fullMarksNotes: "44a355df58ec692f487bd155efc8a3202a1e4b4b1a90681daa299efba3135175",
  fullMarksNotesReviewed: "e8f1e4208719850f9fed27992b4a8fb28b01c17d8c28b7dba5a9163dd7b20bfc",
  msMarksReviewed: "a9cbb2f853adeabc9505b7be9c9ba165b23323f061d1986115cfda001aeb0e5f",
  secondarySubtopics: "86b81cc8292258b1f19f4c7a5e31a2b9df6031822d85b20f6b24bc2785c0b923",
  syllabus2026: "65599e6aea802cf8f1cd424989a0b95050ce1d161e4c3f7a577b9397471523b6",
  mf19: "c075388ec7227fea086358f4332592a395a3c8d9c82b75890346f84cfc749d90",
  coverageReceipt: "4be718ebe26f9a184e00cd9f65ab1a17ddbcc7d6dfb911ec56049a4b7d0b229e",
  /** SHA-256 over the sorted "<file> <sha256>" lines of every top-level blind-results/*.json file. */
  blindResults: "ea7f2e38afb0d2b7523919f4bc08c909cca83e807a2bb20216d2232a7f2a5846",
};
/**
 * Paper facts: the 2026-2027 syllabus assessment overview, p. 11 (the same table in the 2020-2022 and 2023-2025 syllabuses).
 * Every question paper and mark scheme in scope prints these totals (asserted below).
 */
export const PAPER_FACTS = {
  1: { name: "Further Pure Mathematics 1", durationMinutes: 120, totalMarks: 75, sections: "1" },
  2: { name: "Further Pure Mathematics 2", durationMinutes: 120, totalMarks: 75, sections: "2" },
  3: { name: "Further Mechanics", durationMinutes: 90, totalMarks: 50, sections: "3" },
  4: { name: "Further Probability & Statistics", durationMinutes: 90, totalMarks: 50, sections: "4" },
};
/**
 * Mark schemes that say "all candidates were awarded full marks" for some questions or parts (Oct/Nov 2023). The QP prints
 * them and the MS still prints every mark point, so students can score them: served at the printed marks (owner, 2026-11-21:
 * "Serve them").
 */
export const FULL_MARKS_NOTES = {
  "9231-2023-w-22": { parts: ["6"], questions: { "9231-2023-w-22-q6": 10 } },
  "9231-2023-w-32": { parts: ["1", "2"], questions: { "9231-2023-w-32-q1": 4, "9231-2023-w-32-q2": 6 } },
  "9231-2023-w-42": { parts: ["5(b)"], questions: { "9231-2023-w-42-q5": 16 } },
};
/** The one MS that prints a part-total cell blank (5(c), [3]); the QP's printed brackets are served. */
export const MS_MARKS_REVIEWED = { "9231-2022-w-41-q5": { qpMarks: 10, msMarks: 7 } };
/**
 * MS totals that differ from the QP only through the scheme's layout (an "Alternative method" block repeats a part total, or a
 * split "M1" reads as a stray "1"). All were in the source's visual review; the QP's printed brackets are served.
 */
export const MS_LAYOUT_DIFFERS = {
  "9231-2020-s-13-q5": { qpMarks: 11, msMarks: 20 },
  "9231-2020-w-22-q5": { qpMarks: 8, msMarks: 13 },
  "9231-2021-s-43-q6": { qpMarks: 11, msMarks: 16 },
  "9231-2023-s-41-q6": { qpMarks: 11, msMarks: 12 },
  "9231-2024-w-32-q3": { qpMarks: 7, msMarks: 9 },
  "9231-2024-w-32-q6": { qpMarks: 10, msMarks: 16 },
  "9231-2025-s-43-q6": { qpMarks: 11, msMarks: 7 },
};
/** Student-facing outcome labels that differ from the source's short label (source app note, classification receipt). */
export const SUBTOPIC_LABEL_OVERRIDES = { "3.6.1": "Restitution: definitions" };
export const EXPECTED = {
  labels: 813, rows: 813, papers: 116, aliases: 365, aliasPapers: 52, byPaper: { 1: 203, 2: 233, 3: 202, 4: 175 }, topics: 24, topicLabels: 23,
  subtopics: 84, freeRows: 225, notSatRows: 56, years: "2020-2026", sourcePapers: 168, crops: 2728, marks: 7250,
};
export const FREE_YEARS = [2020, 2021];
export const TAXONOMY_OUTPUT = "src/data/a-level-further-maths-9231-taxonomy.json";
export const ALIASES_OUTPUT = "src/data/question-id-aliases.json";
export const ALIAS_NOTE_9231 = "A Level Further Mathematics 9231: a variant that reprints another variant of the same series maps to the canonical question, from the source workspace's frozen canonical manifest.";
const SESSION_LABELS = { may_june: "June", october_november: "November" };
const SERIES_CODES = { may_june: "s", october_november: "w" };
const ERA = "2020";
const COURSE = "Cambridge International AS & A Level Further Mathematics 9231";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function sourceRootPath(environment = process.env) {
  return environment.PASTPAPERPREP_A_LEVEL_FURTHER_MATHS_SOURCE_ROOT?.trim() || DEFAULT_SOURCE_ROOT;
}

async function pinnedBytes(sourceRoot, relative, expected) {
  const bytes = await readFile(path.join(sourceRoot, relative));
  const actual = sha256(bytes);
  if (actual !== expected) throw new Error(`9231 source ${relative} SHA-256 ${actual} != pinned ${expected}`);
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
      if (transcripts.has(row.id)) throw new Error(`9231 ${row.id} has more than one blind transcript`);
      transcripts.set(row.id, row.transcript.trim());
    }
  }
  return { pin: sha256(`${lines.join("\n")}\n`), transcripts };
}

/** Learning-outcome labels: the source's reviewed short labels, unique across the bank, with the reviewed overrides. */
export function subtopicLabels(source) {
  const labels = new Map();
  for (const entry of source.topics) for (const subtopic of entry.subtopics) labels.set(subtopic.code, SUBTOPIC_LABEL_OVERRIDES[subtopic.code] ?? subtopic.title);
  if (new Set(labels.values()).size !== labels.size) throw new Error("9231 subtopic labels are not unique");
  for (const code of Object.keys(SUBTOPIC_LABEL_OVERRIDES)) if (!labels.has(code)) throw new Error(`9231 label override ${code} names no outcome`);
  return labels;
}

/** Student taxonomy: Papers 1-4 in order, each with its sections in syllabus order and their learning outcomes. */
export function studentTaxonomy(source, used, outcomeLabels) {
  const papers = Object.entries(PAPER_FACTS).map(([paper, facts]) => ({
    paper: Number(paper),
    title: facts.name,
    sections: source.topics.filter((entry) => entry.paper === Number(paper)).map((entry) => {
      if (!entry.code.startsWith(`${facts.sections}.`)) throw new Error(`9231 section ${entry.code} is not on Paper ${paper}`);
      return {
        id: entry.id, code: entry.code, label: entry.title, level: entry.level, era: entry.era, official: true, questions: used.get(entry.id) ?? 0,
        subtopics: entry.subtopics.map((subtopic) => ({ code: subtopic.code, label: outcomeLabels.get(subtopic.code), syllabusTitle: subtopic.title })),
      };
    }),
  }));
  const sections = papers.flatMap((paper) => paper.sections);
  if (sections.length !== EXPECTED.topics || source.topics.length !== EXPECTED.topics || sections.flatMap((section) => section.subtopics).length !== EXPECTED.subtopics || source.earlier_syllabus_topics.length) throw new Error("9231 taxonomy shape drifted");
  if (new Set(sections.map((section) => section.label)).size !== EXPECTED.topicLabels) throw new Error("9231 section titles drifted (only 1.4 and 2.2 share one)");
  return {
    artifact: "a_level_further_maths_9231_student_taxonomy",
    version: source.version,
    qualification: "9231",
    era: ERA,
    note: "Topics are the official syllabus sections, one set per paper (Paper 1: 1.1-1.7, Paper 2: 2.1-2.6, Paper 3: 3.1-3.6, Paper 4: 4.1-4.5); subtopics are the learning outcomes. Each paper is its own tab, and a question carries sections of its own paper only. 1.4 and 2.2 are both \"Matrices\", as 9709 shares section titles across papers.",
    sourceTaxonomyPath: "data/taxonomy/taxonomy.json",
    sourceTaxonomySHA256: SOURCE_SHA256.taxonomy,
    papers,
  };
}

function runtimeAsset(kind, asset, paperId) {
  const match = /^assets\/(9231-20\d{2}-[sw]-\d{2})\/(questions|markschemes)\/(q\d+-\d+-\d+\.webp)$/.exec(asset.path);
  if (!match || match[2] !== kind || match[1] !== paperId) throw new Error(`Unexpected 9231 ${kind} asset path: ${asset.path}`);
  if (!/^[0-9a-f]{64}$/.test(asset.sha256 ?? "")) throw new Error(`9231 ${asset.path} has no SHA-256`);
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
 * The reviewed further learning outcomes of one question, in syllabus order: at least one for every secondary section,
 * optionally more of the primary section (never its primary outcome again), and only under the question's own sections.
 * Fails closed on any other shape.
 */
export function furtherOutcomes(id, label, entry, subtopicsByCode) {
  const allowed = new Set([label.primary, ...label.secondaries]);
  for (const code of Object.keys(entry)) if (!allowed.has(code)) throw new Error(`9231 ${id} overlay names section ${code}, which is not its primary or a secondary`);
  const codes = [];
  for (const code of [label.primary, ...label.secondaries]) {
    const outcomes = entry[code]?.subtopics;
    if (outcomes === undefined) {
      if (code !== label.primary) throw new Error(`9231 ${id} secondary section ${code} has no reviewed outcome`);
      continue;
    }
    if (!Array.isArray(outcomes) || !outcomes.length || new Set(outcomes).size !== outcomes.length || typeof entry[code].evidence !== "string" || !entry[code].evidence.trim()) throw new Error(`9231 ${id} overlay entry for ${code} is malformed`);
    for (const outcome of outcomes) {
      if (subtopicsByCode.get(outcome)?.topic !== code) throw new Error(`9231 ${id} outcome ${outcome} is not under section ${code}`);
      if (code === label.primary && outcome === label.primary_subtopic) throw new Error(`9231 ${id} overlay repeats the primary outcome ${outcome}`);
    }
    codes.push(...outcomes);
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
  const outcomeOverlay = await pinned(sourceRoot, "data/classification/secondary-subtopics.json", SOURCE_SHA256.secondarySubtopics);
  await pinnedBytes(sourceRoot, "data/extras/9231-syllabus-2026-2027.pdf", SOURCE_SHA256.syllabus2026);
  await pinnedBytes(sourceRoot, "data/extras/9231-mf19.pdf", SOURCE_SHA256.mf19);
  const coverage = await pinned(sourceRoot, "data/coverage-receipt.json", SOURCE_SHA256.coverageReceipt);
  if (outcomeOverlay.inputs?.final_labels_sha256 !== SOURCE_SHA256.labels || outcomeOverlay.inputs?.taxonomy_sha256 !== SOURCE_SHA256.taxonomy || outcomeOverlay.inputs?.segmentation_sha256 !== SOURCE_SHA256.segmentation) throw new Error("9231 secondary-subtopic overlay was made against different inputs");
  if (finalLabels.inputs?.taxonomy_sha256 !== SOURCE_SHA256.taxonomy) throw new Error("9231 final labels were made against a different taxonomy");
  const blind = await blindTranscripts(sourceRoot);
  if (blind.pin !== SOURCE_SHA256.blindResults) throw new Error(`9231 blind results ${blind.pin} != pinned ${SOURCE_SHA256.blindResults}`);
  if (Object.keys(held.questions).length || finalLabels.held.length) throw new Error("9231 held questions appeared; review before building");
  if (finalLabels.review_overlays?.length || finalLabels.review_corrections?.length) throw new Error("9231 final labels carry review overlays; review before building");
  if (finalLabels.dropped_empty_earlier_syllabus_topics.length) throw new Error("9231 final labels name earlier-syllabus topics");
  if (coverage.verdict !== "PASS" || coverage.problems.length || coverage.crop_assets_verified !== EXPECTED.crops || coverage.totals.marks !== EXPECTED.marks || coverage.totals.held_questions || coverage.totals.excluded_questions) throw new Error("9231 coverage receipt is not PASS");

  // Full-marks notes: exactly the three reviewed papers, all served.
  if (JSON.stringify(Object.keys(fullMarksNotes.papers).sort()) !== JSON.stringify(Object.keys(FULL_MARKS_NOTES))) throw new Error("9231 full-marks notes drifted");
  for (const [paperId, expected] of Object.entries(FULL_MARKS_NOTES)) {
    const decided = fullMarksReviewed.cases[paperId];
    if (!decided || decided.decision !== "serve" || JSON.stringify(decided.parts) !== JSON.stringify(expected.parts) || JSON.stringify(fullMarksNotes.papers[paperId].parts) !== JSON.stringify(expected.parts)) throw new Error(`9231 ${paperId} full-marks decision is not the reviewed "serve"`);
  }
  if (JSON.stringify(Object.keys(fullMarksReviewed.cases).sort()) !== JSON.stringify(Object.keys(FULL_MARKS_NOTES))) throw new Error("9231 full-marks decisions drifted");
  const fullMarksQuestions = Object.fromEntries(Object.values(FULL_MARKS_NOTES).flatMap((note) => Object.entries(note.questions)));
  if (JSON.stringify(Object.keys(msMarksReviewed.questions)) !== JSON.stringify(Object.keys(MS_MARKS_REVIEWED))) throw new Error("9231 reviewed MS-mark cases drifted");
  const layoutDiffers = [...segmentation.summary.ms_marks_differ].sort();
  if (JSON.stringify(layoutDiffers) !== JSON.stringify([...Object.keys(MS_LAYOUT_DIFFERS), ...Object.keys(MS_MARKS_REVIEWED)].sort())) throw new Error("9231 MS-total differences drifted");

  if (!canonical.frozen || canonical.canonical_questions.length !== EXPECTED.rows) throw new Error("9231 canonical manifest drifted");
  if (canonical.counts.alias_papers !== EXPECTED.aliasPapers || canonical.counts.partial_alias_papers !== 0 || Object.keys(canonical.aliases).length !== EXPECTED.aliases) throw new Error("9231 alias set drifted");
  const canonicalById = new Map(canonical.canonical_questions.map((question) => [question.id, question]));
  const labels = new Map(finalLabels.labels.map((label) => [label.id, label]));
  if (labels.size !== EXPECTED.labels || finalLabels.labels.length !== EXPECTED.labels) throw new Error("9231 labels do not cover the release once each");
  const topicsByCode = new Map(sourceTaxonomy.topics.map((entry) => [entry.code, entry]));
  const subtopicsByCode = new Map(sourceTaxonomy.topics.flatMap((entry) => entry.subtopics.map((subtopic) => [subtopic.code, { ...subtopic, topic: entry.code }])));
  const outcomeLabelFor = subtopicLabels(sourceTaxonomy);

  const sourceQuestions = segmentation.papers.flatMap((paper) => paper.questions.map((question) => ({ paper, question })));
  if (segmentation.papers.length !== EXPECTED.papers || sourceQuestions.length !== EXPECTED.rows || segmentation.summary.failed.length || segmentation.summary.pairs_with_issues.length || !segmentation.summary.canonical_id_set_matches_frozen_manifest) throw new Error(`9231 segmentation ${sourceQuestions.length} questions in ${segmentation.papers.length} papers`);
  if (JSON.stringify(sourceQuestions.map(({ question }) => question.id).sort()) !== JSON.stringify([...canonicalById.keys()].sort())) throw new Error("9231 segmentation ids differ from the frozen canonical set");

  if (acquisition.pair_count !== EXPECTED.sourcePapers || acquisition.document_count !== EXPECTED.sourcePapers * 2) throw new Error("9231 acquisition manifest drifted");
  const sourceUrl = (paperId, kind) => {
    const url = acquisition.papers[paperId]?.[kind]?.final_url;
    if (typeof url !== "string" || !url.startsWith("https://")) throw new Error(`9231 ${paperId} ${kind} has no kept source file`);
    return url;
  };

  const questions = [];
  const used = new Map();
  const overlayRowsUsed = new Set();
  const paperMarks = new Map();
  let crops = 0;
  for (const { paper, question } of sourceQuestions) {
    const entry = canonicalById.get(question.id);
    const facts = PAPER_FACTS[question.paper];
    if (!facts) throw new Error(`9231 ${question.id} is on unknown Paper ${question.paper}`);
    if (question.held || question.excluded_from_practice || entry.excluded_from_practice) throw new Error(`9231 ${question.id} is held or excluded`);
    const reviewedMs = MS_MARKS_REVIEWED[question.id];
    const layoutMs = MS_LAYOUT_DIFFERS[question.id];
    const expectedStatus = reviewedMs ? "reconciled_ms_cell_blank_reviewed" : layoutMs ? "ms_marks_differ" : "reconciled";
    if (question.marks_status !== expectedStatus || entry.marks_status !== question.marks_status) throw new Error(`9231 ${question.id} marks status ${question.marks_status}`);
    const differs = reviewedMs ?? layoutMs;
    if (differs ? question.marks !== differs.qpMarks || question.ms_marks !== differs.msMarks : question.ms_marks !== question.marks) throw new Error(`9231 ${question.id} MS marks ${question.ms_marks} != QP ${question.marks}`);
    if (reviewedMs && msMarksReviewed.questions[question.id].qp_marks !== reviewedMs.qpMarks) throw new Error(`9231 ${question.id} reviewed MS marks drifted`);
    if (question.qp_mark_source !== "brackets" || question.qp_mark_brackets.reduce((sum, value) => sum + value, 0) !== question.marks) throw new Error(`9231 ${question.id} marks are not the QP's printed brackets`);
    const label = labels.get(question.id);
    if (!label) throw new Error(`9231 ${question.id} has no final label`);
    if (label.paper !== question.paper || entry.paper_number !== question.paper) throw new Error(`9231 ${question.id} paper mismatch`);
    if (paper.printed_total !== facts.totalMarks || paper.ms_maximum !== facts.totalMarks) throw new Error(`9231 ${paper.paper_id} total ${paper.printed_total}/${paper.ms_maximum} != syllabus ${facts.totalMarks}`);
    if (paper.issues.length || paper.source_exceptions.length) throw new Error(`9231 ${paper.paper_id} has unreviewed issues`);
    if (entry.printed_marks !== question.marks || !(question.marks > 0)) throw new Error(`9231 ${question.id} marks drifted`);
    if (question.format !== "structured" || label.format !== question.format || entry.format !== question.format) throw new Error(`9231 ${question.id} format ${question.format}`);
    if (question.removed_parts.length) throw new Error(`9231 ${question.id} removed parts ${JSON.stringify(question.removed_parts)}`);
    if (question.mcq_key !== null || entry.mcq_key !== null || question.choice_group !== null || question.choice_required !== null || question.section !== null) throw new Error(`9231 ${question.id} has an MCQ key, choice group or section`);
    if (question.levels_tables_from != null || question.levels_text) throw new Error(`9231 ${question.id} has a levels table`);
    if (fullMarksQuestions[question.id] !== undefined && question.marks !== fullMarksQuestions[question.id]) throw new Error(`9231 ${question.id} is not served at its printed ${fullMarksQuestions[question.id]} marks`);
    paperMarks.set(paper.paper_id, (paperMarks.get(paper.paper_id) ?? 0) + question.marks);

    const codes = [label.primary, ...label.secondaries];
    if (new Set(codes).size !== codes.length) throw new Error(`9231 ${question.id} repeats a label`);
    const resolved = codes.map((code) => {
      const topic = topicsByCode.get(code);
      if (!topic) throw new Error(`9231 ${question.id} uses unknown section ${code}`);
      // Each paper assesses its own syllabus sections only (assessment overview; 9709's rule).
      if (topic.paper !== question.paper || !code.startsWith(`${facts.sections}.`)) throw new Error(`9231 ${question.id} carries ${code} from another paper`);
      return topic;
    });
    const subtopic = subtopicsByCode.get(label.primary_subtopic);
    if (!subtopic || subtopic.topic !== label.primary) throw new Error(`9231 ${question.id} outcome ${label.primary_subtopic} is not under ${label.primary}`);
    const furtherCodes = furtherOutcomes(question.id, label, outcomeOverlay.rows[question.id] ?? {}, subtopicsByCode);
    if (outcomeOverlay.rows[question.id]) overlayRowsUsed.add(question.id);
    const furtherSubtopics = furtherCodes.map((code) => outcomeLabelFor.get(code));
    const subtopics = [outcomeLabelFor.get(subtopic.code), ...furtherSubtopics];
    const session = SESSION_LABELS[question.session];
    if (!session || SERIES_CODES[question.session] !== entry.series_code) throw new Error(`9231 ${question.id} session ${question.session}`);
    const component = paper.paper_id.split("-")[3];
    if (component !== `${question.paper}${question.variant}` || entry.component !== component) throw new Error(`9231 ${question.id} component ${component}`);
    const notSat = entry.exam_status === "released_not_sat";
    if (notSat !== (question.year === 2020 && question.session === "may_june") || !["sat", "released_not_sat"].includes(entry.exam_status)) throw new Error(`9231 ${question.id} exam status ${entry.exam_status}`);
    if (acquisition.papers[paper.paper_id]?.exam_status !== entry.exam_status) throw new Error(`9231 ${paper.paper_id} acquisition exam status differs`);
    for (const alias of entry.alias_ids) if (canonical.aliases[alias]?.canonical_id !== question.id) throw new Error(`9231 alias ${alias} does not resolve to ${question.id}`);
    const transcript = blind.transcripts.get(question.id);
    if (!transcript) throw new Error(`9231 ${question.id} has no blind transcript`);
    const questionImages = question.question_images.map((asset) => runtimeAsset("questions", asset, paper.paper_id));
    const markschemeImages = question.markscheme_images.map((asset) => runtimeAsset("markschemes", asset, paper.paper_id));
    if (!questionImages.length || !markschemeImages.length) throw new Error(`9231 ${question.id} is missing crops`);
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
      subject: "Further Mathematics",
      course: COURSE,
      primaryTopic: primary.title,
      primaryTopicId: primary.id,
      secondaryTopics: secondaries.map((topic) => topic.title),
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

  const strayOverlayRows = Object.keys(outcomeOverlay.rows).filter((id) => !overlayRowsUsed.has(id));
  if (strayOverlayRows.length) throw new Error(`9231 secondary-subtopic overlay rows for questions not in the release: ${strayOverlayRows.join(", ")}`);
  for (const { paper } of sourceQuestions) if (paperMarks.get(paper.paper_id) !== paper.printed_total) throw new Error(`9231 ${paper.paper_id} questions sum to ${paperMarks.get(paper.paper_id)}, not its printed ${paper.printed_total}`);
  if (questions.length !== EXPECTED.rows || new Set(questions.map((question) => question.id)).size !== EXPECTED.rows) throw new Error(`9231 rows ${questions.length}`);
  for (const [paper, count] of Object.entries(EXPECTED.byPaper)) if (questions.filter((question) => question.paper === Number(paper)).length !== count) throw new Error(`9231 Paper ${paper} count drifted`);
  if (questions.reduce((sum, question) => sum + question.marks, 0) !== EXPECTED.marks) throw new Error("9231 total marks drifted");
  const papers = new Set(questions.map((question) => question.paperId));
  if (papers.size !== EXPECTED.papers) throw new Error(`9231 papers ${papers.size}`);
  const years = questions.map((question) => question.year);
  const yearRange = `${Math.min(...years)}-${Math.max(...years)}`;
  if (yearRange !== EXPECTED.years) throw new Error(`9231 years ${yearRange}`);
  if (questions.filter((question) => FREE_YEARS.includes(question.year)).length !== EXPECTED.freeRows) throw new Error("9231 free-year count drifted");
  if (questions.filter((question) => question.examStatus === "released_not_sat").length !== EXPECTED.notSatRows) throw new Error("9231 not-sat count drifted");
  if (crops !== EXPECTED.crops) throw new Error(`9231 crops ${crops}`);
  if (used.size !== EXPECTED.topics) throw new Error(`9231 sections used ${used.size}`);

  const aliases = Object.fromEntries(questions.flatMap((question) => question.aliasIds.map((alias) => [alias, question.id])).sort(([a], [b]) => a.localeCompare(b)));
  if (Object.keys(aliases).length !== EXPECTED.aliases) throw new Error("9231 alias count drifted");

  const taxonomy = studentTaxonomy(sourceTaxonomy, used, outcomeLabelFor);
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
    fullMarksAwardedNotes: Object.entries(FULL_MARKS_NOTES).map(([paperId, note]) => ({ paperId, questionIds: Object.keys(note.questions), parts: note.parts, decision: "served_at_printed_marks" })),
    sourceCandidate: { paths: ["data/classification/final-labels.json"], sha256: [SOURCE_SHA256.labels], questionCount: questions.length },
    taxonomy: { path: TAXONOMY_OUTPUT, version: taxonomy.version, sha256: taxonomyFileSha },
    questions,
    publicationStatus: CANDIDATE_PUBLICATION_STATUS,
    assetVerification: "pending_upload",
    runtimeArtifact: {
      schemaVersion: "igcse-production-runtime-v1",
      sourceRepository: "cambridge-a-level-further-mathematics-9231-topic-practice",
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
      byPaper: EXPECTED.byPaper, freeRows: EXPECTED.freeRows, notSatRows: EXPECTED.notSatRows, crops, blindPin: blind.pin,
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
  const note = file.note.includes(ALIAS_NOTE_9231) ? file.note : `${file.note} ${ALIAS_NOTE_9231}`;
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
