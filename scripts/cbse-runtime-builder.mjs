/**
 * Shared CBSE runtime builder. Each bank's generator (scripts/generate-cbse-<…>-runtime.mjs) holds its pinned source and
 * reviewed decisions in a config; this module reads the toolkit's outputs, checks them fail-closed, and writes the
 * candidate runtime, private index, student taxonomy and alias block. Deterministic: the same pins give the same bytes.
 *
 * Toolkit inputs read from the source workspace (every one SHA-256 pinned in the config):
 *   data/canonical-manifest.json, data/segmentation/full/segmentation.json, data/classification/final-labels.json,
 *   data/classification/secondary-subtopics.json, data/classification/blind-results/*.json (accessible text),
 *   data/taxonomy/taxonomy.json, data/held-questions.json, data/source-manifest.json, data/coverage-receipt.json,
 *   and, where the bank has them, data/review/ms-row-reviews.json and data/gate-waivers.json.
 */
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const RIGHTS_STATUS = "user_attested_rights_authorized";
export const CANDIDATE_PUBLICATION_STATUS = "authorized_production_candidate";
export const ALIASES_OUTPUT = "src/data/question-id-aliases.json";
const SESSION_LABELS = { main: { label: "Main", series: "m" }, compartment: { label: "Compartment", series: "c" }, second_exam: { label: "Second exam", series: "e" } };
const ERA = "2023";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export const outputsFor = (bank) => ({
  runtime: `src/data/production/${bank}.json`,
  privateIndex: `src/data/private-index/${bank}.json`,
  taxonomy: `src/data/${bank}-taxonomy.json`,
});

export function sourceRootPath(config, environment = process.env) {
  return environment[config.sourceRootEnv]?.trim() || config.defaultSourceRoot;
}

function failer(config) {
  return (message) => { throw new Error(`${config.label} ${message}`); };
}

async function pinnedBytes(config, sourceRoot, relative, expected) {
  const bytes = await readFile(path.join(sourceRoot, relative));
  const actual = sha256(bytes);
  if (actual !== expected) throw new Error(`${config.label} source ${relative} SHA-256 ${actual} != pinned ${expected}`);
  return bytes;
}
async function pinned(config, sourceRoot, relative, expected) {
  return JSON.parse((await pinnedBytes(config, sourceRoot, relative, expected)).toString("utf8"));
}

export async function blindTranscripts(config, sourceRoot) {
  const directory = path.join(sourceRoot, "data/classification/blind-results");
  const files = (await readdir(directory, { withFileTypes: true })).filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => entry.name).sort();
  const lines = [];
  const transcripts = new Map();
  for (const file of files) {
    const bytes = await readFile(path.join(directory, file));
    lines.push(`${file} ${sha256(bytes)}`);
    for (const row of JSON.parse(bytes.toString("utf8")).rows ?? []) {
      if (typeof row.transcript !== "string" || !row.transcript.trim()) continue;
      if (transcripts.has(row.id)) throw new Error(`${config.label} ${row.id} has more than one blind transcript`);
      transcripts.set(row.id, row.transcript.trim());
    }
  }
  return { pin: sha256(`${lines.join("\n")}\n`), transcripts };
}

/**
 * Subtopic labels by code: the curriculum title, qualified with its chapter where several chapters share a title
 * ("Classification (Amines)"), because the subtopic filter matches labels. Fails closed unless the result is unique.
 */
export function subtopicLabels(config, source) {
  const count = new Map();
  for (const entry of source.topics) for (const subtopic of entry.subtopics) count.set(subtopic.title, (count.get(subtopic.title) ?? 0) + 1);
  const labels = new Map();
  for (const entry of source.topics) for (const subtopic of entry.subtopics) labels.set(subtopic.code, count.get(subtopic.title) > 1 ? `${subtopic.title} (${entry.title})` : subtopic.title);
  if (new Set(labels.values()).size !== labels.size) throw new Error(`${config.label} subtopic labels are not unique`);
  return labels;
}

/** Student taxonomy: the chapters in curriculum order (with their science, where the bank groups them), each with its subtopics. */
export function studentTaxonomy(config, source, used, subtopicLabelFor) {
  const chapters = source.topics.map((entry) => ({
    id: entry.id, code: entry.code, label: entry.title, ...(config.groupChapters ? { group: entry.group } : {}), era: entry.era, official: true, questions: used.get(entry.id) ?? 0,
    subtopics: entry.subtopics.map((subtopic) => ({ code: subtopic.code, label: subtopicLabelFor.get(subtopic.code), curriculumTitle: subtopic.title })),
  }));
  if (chapters.length !== config.expected.topics || chapters.flatMap((chapter) => chapter.subtopics).length !== config.expected.subtopics || source.earlier_syllabus_topics.length) throw new Error(`${config.label} taxonomy shape drifted`);
  if (config.groupChapters && chapters.some((chapter) => !config.groupChapters.includes(chapter.group))) throw new Error(`${config.label} chapter groups drifted`);
  return {
    artifact: `${config.bank.replaceAll("-", "_")}_student_taxonomy`,
    version: source.version,
    qualification: config.course,
    era: ERA,
    note: config.taxonomyNote,
    sourceTaxonomyPath: "data/taxonomy/taxonomy.json",
    sourceTaxonomySHA256: config.sha256.taxonomy,
    chapters,
  };
}

function runtimeAsset(config, kind, asset, paperId) {
  const match = new RegExp(`^assets\\/(${config.code}-20\\d{2}-[mce]-1[0-9a-z]{2})\\/(questions|markschemes)\\/(q\\d+(?:-or)?-\\d+-\\d+\\.webp)$`).exec(asset.path);
  if (!match || match[2] !== kind || match[1] !== paperId) throw new Error(`Unexpected ${config.label} ${kind} asset path: ${asset.path}`);
  if (!/^[0-9a-f]{64}$/.test(asset.sha256 ?? "")) throw new Error(`${config.label} ${asset.path} has no SHA-256`);
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
export function furtherSubtopics(config, id, label, entry, subtopicsByCode) {
  const fail = failer(config);
  const allowed = new Set([label.primary, ...label.secondaries]);
  for (const code of Object.keys(entry)) if (!allowed.has(code)) fail(`${id} overlay names chapter ${code}, which is not its primary or a secondary`);
  const codes = [];
  for (const code of [label.primary, ...label.secondaries]) {
    const subtopics = entry[code]?.subtopics;
    if (subtopics === undefined) {
      if (code !== label.primary) fail(`${id} secondary chapter ${code} has no reviewed subtopic`);
      continue;
    }
    if (!Array.isArray(subtopics) || !subtopics.length || new Set(subtopics).size !== subtopics.length || typeof entry[code].evidence !== "string" || !entry[code].evidence.trim()) fail(`${id} overlay entry for ${code} is malformed`);
    for (const subtopic of subtopics) {
      if (subtopicsByCode.get(subtopic)?.topic !== code) fail(`${id} subtopic ${subtopic} is not under chapter ${code}`);
      if (code === label.primary && subtopic === label.primary_subtopic) fail(`${id} overlay repeats the primary subtopic ${subtopic}`);
    }
    codes.push(...subtopics);
  }
  const order = [...subtopicsByCode.keys()];
  return [...new Set(codes)].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

/** Multiple-choice answer fields: the official key with provenance, a settled two-letter key, or none for a notice item. */
function mcqFields(config, question, entry, settlements) {
  const fail = failer(config);
  if (question.format !== "multiple_choice") {
    if (question.mcq_key !== null || entry.mcq_key !== null || question.mcq_keys?.length) fail(`${question.id} is structured but has an MCQ key`);
    return {};
  }
  if (question.marks !== 1) fail(`${question.id} MCQ is not one mark`);
  const excluded = config.excludedFromSelfMarking.includes(question.id);
  if (excluded !== (entry.excluded_from_self_marking === true) || excluded !== (question.excluded_from_self_marking === true)) fail(`${question.id} self-marking exclusion drifted`);
  if (excluded) {
    if (!question.ms_notices?.some((notice) => notice.kind === "full_marks_all")) fail(`${question.id} is excluded without a full-marks notice`);
    if (entry.key_note !== undefined) fail(`${question.id} carries a key_note, which needs an owner decision and app review`);
    return { excludedFromSelfMarking: true };
  }
  const keys = entry.mcq_keys;
  const two = config.twoLetterKeys[question.id];
  // A settled two-letter key is applied to the canonical row; the segmentation record may keep the scheme's first letter.
  const segmentationKeys = JSON.stringify(question.mcq_keys);
  if (!Array.isArray(keys) || !keys.every((key) => /^[A-D]$/.test(key)) || keys[0] !== entry.mcq_key || (segmentationKeys !== JSON.stringify(keys) && !(two && segmentationKeys === JSON.stringify([keys[0]])))) fail(`${question.id} MCQ key ${JSON.stringify(keys)} is not a checked official key`);
  if (two ? JSON.stringify(keys) !== JSON.stringify(two) || entry.mcq_key_source !== "settlement" || (settlements && JSON.stringify(settlements.items?.[question.id]?.settled_keys) !== JSON.stringify(two)) : keys.length !== 1) fail(`${question.id} key letters drifted`);
  return {
    answer: keys[0],
    ...(two ? { acceptedAnswers: [...two] } : {}),
    answerProvenance: { status: "official", questionId: question.id, source: entry.mcq_key_source },
  };
}

/** Question ids an issue names: full ids, or "Q31" on that paper (both the question and its OR alternative). */
function issueQuestionIds(config, paperId, issue) {
  const ids = [...issue.matchAll(new RegExp(`${config.code}-20\\d{2}-[mce]-1[0-9a-z]{2}-q\\d+(?:-or)?`, "g"))].map((match) => match[0]);
  for (const match of issue.matchAll(/\bQ(\d+)\b/g)) ids.push(`${paperId}-q${match[1]}`, `${paperId}-q${match[1]}-or`);
  return [...new Set(ids)];
}

/**
 * A paper with segmentation issues is served only when each issue is accounted for: it names only questions that are held
 * or aliases, or the paper is in the recorded gate waiver, whose reviewed decision for every question it names must hold
 * here ("served" questions served, "held" questions held). An issue that names no question needs the waiver.
 */
function checkPaperIssues(config, paper, servedIds, heldIds, waivers) {
  const fail = failer(config);
  const waiver = waivers.get(paper.paper_id);
  if (waiver) for (const decided of waiver.questions) {
    if (decided.decision === "served" ? !servedIds.has(decided.id) : decided.decision !== "held" || !heldIds.has(decided.id)) fail(`${paper.paper_id} waiver decision for ${decided.id} (${decided.decision}) does not hold`);
  }
  for (const issue of paper.issues) {
    const named = issueQuestionIds(config, paper.paper_id, issue);
    if (!named.length && !waiver) fail(`${paper.paper_id} issue "${issue}" names no question and is not waived`);
    for (const id of named) if (servedIds.has(id) && waiver?.questions.find((decided) => decided.id === id)?.decision !== "served") fail(`${paper.paper_id} issue "${issue}" names served ${id} without a reviewed decision`);
  }
  if (paper.printed_total !== config.paperFacts[1].totalMarks && !waiver) fail(`${paper.paper_id} printed total ${paper.printed_total} != ${config.paperFacts[1].totalMarks}`);
}

export async function buildRuntime(config, { sourceRoot = sourceRootPath(config) } = {}) {
  const fail = failer(config);
  const pins = config.sha256;
  const canonical = await pinned(config, sourceRoot, "data/canonical-manifest.json", pins.canonicalManifest);
  const finalLabels = await pinned(config, sourceRoot, "data/classification/final-labels.json", pins.labels);
  const overlay = await pinned(config, sourceRoot, "data/classification/secondary-subtopics.json", pins.secondarySubtopics);
  const segmentation = await pinned(config, sourceRoot, "data/segmentation/full/segmentation.json", pins.segmentation);
  const held = await pinned(config, sourceRoot, "data/held-questions.json", pins.heldQuestions);
  const sourceTaxonomy = await pinned(config, sourceRoot, "data/taxonomy/taxonomy.json", pins.taxonomy);
  const coverage = await pinned(config, sourceRoot, "data/coverage-receipt.json", pins.coverageReceipt);
  const msReviews = pins.msRowReviews ? await pinned(config, sourceRoot, "data/review/ms-row-reviews.json", pins.msRowReviews) : { items: {} };
  // Settled keys: pinned where the bank's canonical rows carry a settlement the segmentation does not.
  const settlements = pins.mcqKeySettlements ? await pinned(config, sourceRoot, "data/review/mcq-key-settlements.json", pins.mcqKeySettlements) : null;
  const gateWaivers = pins.gateWaivers ? await pinned(config, sourceRoot, "data/gate-waivers.json", pins.gateWaivers) : { waivers: [] };
  const sources = await pinned(config, sourceRoot, "data/source-manifest.json", pins.sourceManifest);
  const blind = await blindTranscripts(config, sourceRoot);
  if (blind.pin !== pins.blindResults) fail(`blind results ${blind.pin} != pinned ${pins.blindResults}`);
  const expected = config.expected;

  // Inputs made against each other.
  if (finalLabels.inputs?.taxonomy_sha256 !== pins.taxonomy) fail("final labels were made against a different taxonomy");
  if (overlay.inputs?.final_labels_sha256 !== pins.labels || overlay.inputs?.taxonomy_sha256 !== pins.taxonomy || overlay.inputs?.segmentation_sha256 !== pins.segmentation) fail("secondary-subtopic overlay was made against different inputs");
  if (coverage.verdict !== "PASS" || coverage.problems.length) fail("coverage receipt is not PASS");
  const totals = coverage.totals;
  if (totals.canonical_questions !== expected.canonical || totals.labelled_questions !== expected.rows || totals.served_alias_questions !== expected.servedAliases || totals.held_questions !== expected.held || totals.excluded_questions !== 0 || totals.universe_papers !== expected.sets) fail(`coverage totals drifted: ${JSON.stringify(totals)}`);
  // Gate waivers: exactly the recorded ones, and the receipt applied exactly those.
  const waiverGates = gateWaivers.waivers.map((waiver) => waiver.gate);
  if (JSON.stringify(waiverGates) !== JSON.stringify(config.waivedGates ?? []) || JSON.stringify((coverage.gates?.waivers_applied ?? []).map((waiver) => waiver.gate)) !== JSON.stringify(waiverGates)) fail("gate waivers drifted");
  if (coverage.gates && (!coverage.gates.passed || coverage.gates.failed.length)) fail("coverage receipt gates did not pass");
  const waivers = new Map(gateWaivers.waivers.flatMap((waiver) => waiver.gate === "cbse.segmentation_clean" ? waiver.papers.map((paper) => [paper.paper, paper]) : []));
  if (finalLabels.held.length || finalLabels.review_corrections?.length || finalLabels.dropped_empty_earlier_syllabus_topics.length) fail("final labels carry held rows, corrections or earlier-syllabus topics; review before building");

  if (!canonical.frozen || canonical.canonical_questions.length !== expected.canonical || Object.keys(canonical.aliases).length !== expected.aliasesInManifest) fail("canonical manifest drifted");
  const heldIds = Object.keys(held.questions).sort();
  if (heldIds.length !== expected.held) fail(`held ${heldIds.length}`);
  const labels = new Map(finalLabels.labels.map((label) => [label.id, label]));
  if (labels.size !== expected.rows || finalLabels.labels.length !== expected.rows) fail("labels do not cover the release once each");
  const topicsByCode = new Map(sourceTaxonomy.topics.map((entry) => [entry.code, entry]));
  const subtopicsByCode = new Map(sourceTaxonomy.topics.flatMap((entry) => entry.subtopics.map((subtopic) => [subtopic.code, { ...subtopic, topic: entry.code }])));
  const subtopicLabelFor = subtopicLabels(config, sourceTaxonomy);

  const segmented = new Map(segmentation.papers.flatMap((paper) => paper.questions.map((question) => [question.id, { paper, question }])));
  if (segmentation.papers.length !== expected.sets) fail("segmentation drifted");
  const heldSet = new Set(heldIds);
  const servedIds = new Set(canonical.canonical_questions.map((entry) => entry.id).filter((id) => !heldSet.has(id)));
  for (const paper of segmentation.papers) {
    if (paper.max_marks !== config.paperFacts[1].totalMarks) fail(`${paper.paper_id} maximum ${paper.max_marks}`);
    checkPaperIssues(config, paper, servedIds, heldSet, waivers);
  }
  if (JSON.stringify([...segmentation.summary.papers_with_issues].sort()) !== JSON.stringify(segmentation.papers.filter((paper) => paper.issues.length).map((paper) => paper.paper_id).sort())) fail("segmentation issue summary drifted");
  for (const paperId of waivers.keys()) if (!segmentation.papers.some((paper) => paper.paper_id === paperId && paper.issues.length)) fail(`waived ${paperId} has no issue left: remove the waiver`);
  const sourceUrl = (paperId, kind) => {
    const url = sources.papers[paperId]?.[kind]?.url;
    if (typeof url !== "string" || !url.startsWith("https://www.cbse.gov.in/")) fail(`${paperId} ${kind} has no official source`);
    return url;
  };
  const reviewedMs = msReviews.items;

  const questions = [];
  const used = new Map();
  const overlayRowsUsed = new Set();
  let crops = 0;
  for (const entry of canonical.canonical_questions) {
    if (heldSet.has(entry.id)) {
      if (labels.has(entry.id)) fail(`held ${entry.id} has a label`);
      continue;
    }
    const found = segmented.get(entry.id);
    if (!found) fail(`${entry.id} is not segmented`);
    const { paper, question } = found;
    if (question.held || question.excluded_from_practice || entry.excluded_from_practice || question.removed_parts.length) fail(`${question.id} is held, excluded or has removed parts`);
    if (question.paper !== 1 || entry.paper_number !== 1 || question.level !== null || entry.levels.length) fail(`${question.id} paper or level drifted`);
    const session = SESSION_LABELS[question.session];
    if (!session || !config.sessions.includes(question.session) || session.series !== entry.series_code || question.year !== entry.year || question.set_code !== entry.set_code || paper.set_code !== question.set_code) fail(`${question.id} session or set drifted`);
    if (entry.exam_status !== "sat") fail(`${question.id} exam status ${entry.exam_status}`);
    // Marks: the question paper's printed marks; a scheme total that differs is served only with a reviewed "serve".
    if (entry.printed_marks !== question.marks || !(question.marks > 0)) fail(`${question.id} marks drifted`);
    if (question.marks_status === "ms_marks_differ") {
      const review = reviewedMs[question.id] ?? reviewedMs[question.id.replace(/-or$/, "")];
      if (review?.decision !== "serve" || review.served_marks !== question.marks) fail(`${question.id} scheme total differs without a reviewed serve`);
    } else if (question.marks_status !== "reconciled" || question.ms_marks !== question.marks) fail(`${question.id} marks status ${question.marks_status}`);
    const label = labels.get(question.id);
    if (!label) fail(`${question.id} has no final label`);
    if (label.format !== question.format || entry.format !== question.format) fail(`${question.id} format drifted`);
    const mcq = mcqFields(config, question, entry, settlements);

    const codes = [label.primary, ...label.secondaries];
    if (new Set(codes).size !== codes.length) fail(`${question.id} repeats a chapter`);
    const resolved = codes.map((code) => topicsByCode.get(code) ?? fail(`${question.id} uses unknown chapter ${code}`));
    const primarySubtopic = subtopicsByCode.get(label.primary_subtopic);
    if (!primarySubtopic || primarySubtopic.topic !== label.primary) fail(`${question.id} subtopic ${label.primary_subtopic} is not under ${label.primary}`);
    const furtherCodes = furtherSubtopics(config, question.id, label, overlay.rows[question.id] ?? {}, subtopicsByCode);
    if (overlay.rows[question.id]) overlayRowsUsed.add(question.id);
    const further = furtherCodes.map((code) => subtopicLabelFor.get(code));
    const subtopics = [subtopicLabelFor.get(primarySubtopic.code), ...further];

    for (const alias of entry.alias_ids) if (canonical.aliases[alias]?.canonical_id !== question.id) fail(`alias ${alias} does not resolve to ${question.id}`);
    const transcript = blind.transcripts.get(question.id);
    if (!transcript) fail(`${question.id} has no blind transcript`);
    const questionImages = question.question_images.map((asset) => runtimeAsset(config, "questions", asset, paper.paper_id));
    const markschemeImages = question.markscheme_images.map((asset) => runtimeAsset(config, "markschemes", asset, paper.paper_id));
    if (!questionImages.length || !markschemeImages.length) fail(`${question.id} is missing crops`);
    crops += questionImages.length + markschemeImages.length;
    for (const topic of resolved) used.set(topic.id, (used.get(topic.id) ?? 0) + 1);
    const [primary, ...secondaries] = resolved;
    questions.push({
      id: question.id,
      canonicalId: question.id,
      aliasIds: [...entry.alias_ids],
      bankSlug: config.bank,
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
      subject: config.subject,
      course: config.course,
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
      maxMarks: config.paperFacts[1].totalMarks,
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
        taxonomyPath: outputsFor(config.bank).taxonomy,
      },
      marks_ready: true,
      rightsStatus: RIGHTS_STATUS,
    });
  }

  const stray = Object.keys(overlay.rows).filter((id) => !overlayRowsUsed.has(id));
  if (stray.length) fail(`overlay rows for questions not in the release: ${stray.join(", ")}`);
  if (questions.length !== expected.rows || new Set(questions.map((question) => question.id)).size !== expected.rows) fail(`rows ${questions.length}`);
  if (questions.filter((question) => question.format === "multiple_choice").length !== expected.multipleChoice || questions.filter((question) => question.format === "structured").length !== expected.structured) fail("format counts drifted");
  if (questions.filter((question) => config.freeYears.includes(question.year)).length !== expected.freeRows) fail("free-year count drifted");
  if (questions.filter((question) => question.excludedFromSelfMarking).length !== config.excludedFromSelfMarking.length) fail("exclusion count drifted");
  if (crops !== expected.crops) fail(`crops ${crops}`);
  if (used.size !== expected.topics) fail(`chapters used ${used.size}`);
  const years = questions.map((question) => question.year);
  const yearRange = `${Math.min(...years)}-${Math.max(...years)}`;
  if (yearRange !== expected.years) fail(`years ${yearRange}`);
  const papers = new Set(questions.map((question) => question.paperId));

  // Aliases of served questions only (a held canonical's aliases are not served either).
  const aliases = Object.fromEntries(questions.flatMap((question) => question.aliasIds.map((alias) => [alias, question.id])).sort(([a], [b]) => a.localeCompare(b)));
  if (Object.keys(aliases).length !== expected.servedAliases) fail(`served aliases ${Object.keys(aliases).length}`);

  const outputs = outputsFor(config.bank);
  const taxonomy = studentTaxonomy(config, sourceTaxonomy, used, subtopicLabelFor);
  const taxonomySerialized = `${JSON.stringify(taxonomy, null, 2)}\n`;
  const taxonomyFileSha = sha256(taxonomySerialized);
  const artifact = {
    version: `${config.bank}-full${questions.length}-v1`,
    releaseStatus: CANDIDATE_PUBLICATION_STATUS,
    rightsStatus: RIGHTS_STATUS,
    sourceType: "actual_past_paper",
    specimenQuestionsIncluded: false,
    liveOnlyUnderReleaseGate: true,
    years: yearRange,
    paperCount: papers.size,
    setCount: expected.sets,
    questionCount: questions.length,
    marks_ready: true,
    paperFacts: { 1: { ...config.paperFacts[1] } },
    heldQuestionIds: heldIds,
    excludedQuestionIds: [],
    excludedFromSelfMarkingIds: [...config.excludedFromSelfMarking],
    ...(gateWaivers.waivers.length ? { gateWaivers: gateWaivers.waivers.map((waiver) => ({ gate: waiver.gate, approvedBy: waiver.approved_by, date: waiver.date, expires: waiver.expires, papers: waiver.papers.map((paper) => paper.paper) })) } : {}),
    sourceCandidate: { paths: ["data/classification/final-labels.json"], sha256: [pins.labels], questionCount: questions.length },
    taxonomy: { path: outputs.taxonomy, version: taxonomy.version, sha256: taxonomyFileSha },
    questions,
    publicationStatus: CANDIDATE_PUBLICATION_STATUS,
    assetVerification: "pending_upload",
    runtimeArtifact: {
      schemaVersion: "igcse-production-runtime-v1",
      sourceRepository: config.sourceRepository,
      sourceCommit: config.sourceCommit,
      toolkitCommit: config.toolkitCommit,
      sourceSha256: pins,
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
    report: { status: "PASS", bank: config.bank, rows: questions.length, papers: papers.size, years: yearRange, aliases: Object.keys(aliases).length, crops, freeRows: expected.freeRows, blindPin: blind.pin, candidate: seals.candidate },
  };
}

/** The candidate a finalized runtime was made from: the fields `generate-igcse-release.mjs --finalize` sets, put back. */
export function reconstructCandidate(finalized) {
  const candidate = JSON.parse(JSON.stringify(finalized));
  for (const question of candidate.questions) {
    question.publicationStatus = CANDIDATE_PUBLICATION_STATUS;
    question.classificationReviewStatus = "candidate_not_approved";
  }
  candidate.releaseStatus = CANDIDATE_PUBLICATION_STATUS;
  candidate.publicationStatus = CANDIDATE_PUBLICATION_STATUS;
  candidate.assetVerification = "pending_upload";
  const meta = candidate.runtimeArtifact;
  meta.assetVerification = "pending_upload";
  meta.publicationStatus = CANDIDATE_PUBLICATION_STATUS;
  meta.assetManifestSha256 = null;
  meta.storageReceiptSha256 = null;
  delete meta.storageState;
  delete meta.finalizedContentSha256;
  meta.runtimeSha256 = null;
  meta.runtimeSha256 = sha256(JSON.stringify(candidate));
  return candidate;
}

export function createPrivateIndex(config, artifact) {
  return {
    version: 1,
    bank: config.bank,
    questions: artifact.questions.map((question) => ({
      id: question.id, number: question.number, paper: question.paper, year: question.year, session: question.session,
      primaryTopic: question.primaryTopic, secondaryTopics: [...question.secondaryTopics], skills: [...question.skills],
      subtopics: [...question.subtopics], subject: question.subject, zone: question.zone, component: question.component, marks: question.marks,
    })),
  };
}

export function withBankAliases(config, file, aliases) {
  const note = file.note.includes(config.aliasNote) ? file.note : `${file.note} ${config.aliasNote}`;
  return { ...file, note, banks: { ...file.banks, [config.bank]: aliases } };
}

/**
 * CLI: write the outputs, or with --check rebuild and compare. Once uploaded and finalized, the committed runtime is the
 * finalized one: --check compares its reconstructed candidate, and writing never overwrites it (that would drop the
 * verified read-back).
 */
export async function runCli(config, repo) {
  const check = process.argv.includes("--check");
  const built = await buildRuntime(config);
  const outputs = outputsFor(config.bank);
  const aliasFile = JSON.parse(await readFile(path.join(repo, ALIASES_OUTPUT), "utf8"));
  const current = await readFile(path.join(repo, outputs.runtime), "utf8").then(JSON.parse).catch(() => null);
  const finalized = current?.runtimeArtifact?.assetVerification === "verified_readback";
  const files = {
    [outputs.runtime]: built.serialized,
    [outputs.privateIndex]: `${JSON.stringify(createPrivateIndex(config, built.artifact))}\n`,
    [outputs.taxonomy]: built.taxonomySerialized,
    [ALIASES_OUTPUT]: `${JSON.stringify(withBankAliases(config, aliasFile, built.aliases), null, 1)}\n`,
  };
  const differs = [];
  for (const [relative, text] of Object.entries(files)) {
    const target = path.join(repo, relative);
    if (relative === outputs.runtime && finalized) {
      if (JSON.stringify(reconstructCandidate(current)) !== JSON.stringify(built.artifact)) differs.push(`${relative} (finalized: its candidate differs)`);
      continue;
    }
    if (check) { if ((await readFile(target, "utf8").catch(() => "")) !== text) differs.push(relative); }
    else await writeFile(target, text);
  }
  console.log(JSON.stringify({ ...built.report, finalized, ...(check ? { check: differs.length ? "DIFFERS" : "MATCHES", differs } : {}) }));
  if (differs.length) process.exitCode = 1;
}
