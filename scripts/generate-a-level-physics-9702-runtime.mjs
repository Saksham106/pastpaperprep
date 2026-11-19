#!/usr/bin/env node
/**
 * Build the Cambridge International AS & A Level Physics 9702 candidate runtime from the pinned source workspace
 * (cambridge-a-level-physics-9702-topic-practice, commit 67b80c6). Every input is SHA-256 pinned; any drift fails closed.
 *
 *   data/segmentation/full/segmentation.json   2,627 canonical questions in 132 canonical papers (P1, P2, P4)
 *   data/classification/final-labels.json      2,627 labels: primary topic, primary_subtopic, secondaries
 *   data/taxonomy/taxonomy.json                topics 1-25 (9702:2022:<n>) and 9 named earlier-syllabus topics
 *   data/canonical-manifest.json               canonical ids, exam status, alias ids, MCQ keys
 *   data/held-questions.json, data/crop-revisions.json   both empty at 67b80c6 (asserted)
 *   data/paper-facts.json                      paper totals and durations from the syllabus assessment overview
 *   data/source-manifest.json + acquisition-manifest.json   kept, identity-checked source files
 *   data/classification/blind-results/*.json   blind-pass transcriptions, used as accessible text
 *
 * Multiple-choice rows carry the official key, read two independent ways in the source (mark-scheme text and
 * rendered view; both must agree), as `answer` with official `answerProvenance`, the release-runtime contract
 * that src/lib/mcq-answer-letters.ts serves only with an authorized answer.
 *
 * Writes src/data/production/a-level-physics-9702.json, src/data/private-index/a-level-physics-9702.json,
 * src/data/a-level-physics-9702-taxonomy.json and the bank's alias ids in src/data/question-id-aliases.json.
 * The runtime stays a candidate until the owner-approved R2 upload is read back and it is finalized.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const BANK = "a-level-physics-9702";
export const RIGHTS_STATUS = "user_attested_rights_authorized";
export const CANDIDATE_PUBLICATION_STATUS = "authorized_production_candidate";
export const DEFAULT_SOURCE_ROOT = "/Users/sakshamgoel/Documents/ProjectsInternships/cambridge-a-level-physics-9702-topic-practice";
export const SOURCE_COMMIT = "67b80c6";
export const SOURCE_SHA256 = {
  segmentation: "8d901b3261d33cc8201bff9fc88320d979fd2d034b0f77a78b65ea279240cc63",
  labels: "7c2d1ed7221e5799fc8965fab47e7ca77361e0a258e56418d2ae20e7929747de",
  taxonomy: "51de6bbc0fbabade153a568a16f4bbd88e3d8e04a0402433b500fe5992424f42",
  canonicalManifest: "317ed28df9258a495a318b883ee8e5b52889e5fa75df564cfd5f01dbc4f0e9fa",
  paperFacts: "68ff8b1380fbb9b44a4e14ebd4bfc570ebba7b9a3a4e267f973409a73ba2450e",
  sourceManifest: "1f1bfae2cc9a4a73669b2712cd25ff080185e39d7bcabe6d5d50b0c629050cb3",
  acquisitionManifest: "0b4e797954a187e7d9bca8fd50485b9c2d29551002980c74661d380481ea6d63",
  heldQuestions: "95532ff77a4b9e91ba2db2c2ad1120236d2092462b07cbd55a1d5aa3082eab1e",
  cropRevisions: "79b565a5f352bb0b9a217256377828f206155684595f6b42431b7c81631173de",
  /** SHA-256 over the sorted "<file> <sha256>" lines of every top-level blind-results/*.json file. */
  blindResults: "ab088ffe603ee22c7af0a1ce7de9b8aa35d70f91f9688dfdc017be265c58839b",
};
export const EXPECTED = {
  rows: 2627, papers: 132, aliases: 184, byPaper: { 1: 1920, 2: 324, 4: 383 }, topics: 25, earlierTopics: 9,
  subtopics: 76, freeRows: 773, notSatRows: 164, years: "2020-2026", sourcePapers: 147,
};
export const TAXONOMY_OUTPUT = "src/data/a-level-physics-9702-taxonomy.json";
export const ALIASES_OUTPUT = "src/data/question-id-aliases.json";
export const ALIAS_NOTE_9702 = "A Level Physics 9702: a variant that reprints another variant of the same series maps to the canonical question, from the source workspace's frozen canonical manifest.";
const SESSION_LABELS = { february_march: "March", may_june: "June", october_november: "November" };
const SERIES_CODES = { february_march: "m", may_june: "s", october_november: "w" };
const PAPERS = new Set([1, 2, 4]);
const COURSE = "Cambridge International AS & A Level Physics 9702";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function sourceRootPath(environment = process.env) {
  return environment.PASTPAPERPREP_A_LEVEL_PHYSICS_SOURCE_ROOT?.trim() || DEFAULT_SOURCE_ROOT;
}

async function pinned(sourceRoot, relative, expected) {
  const bytes = await readFile(path.join(sourceRoot, relative));
  const actual = sha256(bytes);
  if (actual !== expected) throw new Error(`9702 source ${relative} SHA-256 ${actual} != pinned ${expected}`);
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
      if (transcripts.has(row.id)) throw new Error(`9702 ${row.id} has more than one blind transcript`);
      transcripts.set(row.id, row.transcript.trim());
    }
  }
  return { pin: sha256(`${lines.join("\n")}\n`), transcripts };
}

/** Student taxonomy: topics 1-25 (with subtopics), then the earlier-syllabus topics; question counts per topic. */
export function studentTaxonomy(source, used) {
  const topic = (entry, earlier) => ({
    id: entry.id, code: entry.code, label: entry.title, level: entry.level, era: entry.era, earlierSyllabus: earlier, official: true,
    questions: used.get(entry.id) ?? 0,
    subtopics: (entry.subtopics ?? []).map((subtopic) => ({ code: subtopic.code, label: subtopic.title })),
  });
  const topics = [...source.topics.map((entry) => topic(entry, false)), ...source.earlier_syllabus_topics.map((entry) => topic(entry, true))];
  if (source.topics.length !== EXPECTED.topics || source.earlier_syllabus_topics.length !== EXPECTED.earlierTopics) throw new Error("9702 taxonomy shape drifted");
  if (topics.reduce((sum, entry) => sum + entry.subtopics.length, 0) !== EXPECTED.subtopics) throw new Error("9702 subtopic count drifted");
  return {
    artifact: "a_level_physics_9702_student_taxonomy",
    version: source.version,
    qualification: "9702",
    note: "Topics 1-25 of the 2022 revision in syllabus order, then the content it removed as named earlier-syllabus topics (2020-2021 papers only). Each paper is its own tab; P1/P2 carry AS topics, P4 any topic.",
    sourceTaxonomyPath: "data/taxonomy/taxonomy.json",
    sourceTaxonomySHA256: SOURCE_SHA256.taxonomy,
    topics,
  };
}

function runtimeAsset(kind, asset, paperId) {
  const match = /^assets\/(9702-20\d{2}-[msw]-\d{2})\/(questions|markschemes)\/(q\d+-\d+-\d+(?:\.v\d+)?\.webp)$/.exec(asset.path);
  if (!match || match[2] !== kind || match[1] !== paperId) throw new Error(`Unexpected 9702 ${kind} asset path: ${asset.path}`);
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
  if (blind.pin !== SOURCE_SHA256.blindResults) throw new Error(`9702 blind results ${blind.pin} != pinned ${SOURCE_SHA256.blindResults}`);
  if (Object.keys(held.questions).length || Object.keys(cropRevisions.revisions).length) throw new Error("9702 held questions or crop revisions appeared; review before building");

  if (!canonical.frozen || canonical.canonical_questions.length !== EXPECTED.rows) throw new Error("9702 canonical manifest drifted");
  const canonicalById = new Map(canonical.canonical_questions.map((question) => [question.id, question]));
  const labels = new Map(finalLabels.labels.map((label) => [label.id, label]));
  if (labels.size !== EXPECTED.rows || finalLabels.labels.length !== EXPECTED.rows) throw new Error("9702 labels do not cover the release once each");
  const topicsByCode = new Map([...sourceTaxonomy.topics, ...sourceTaxonomy.earlier_syllabus_topics].map((entry) => [entry.code, entry]));
  const subtopicsByCode = new Map(sourceTaxonomy.topics.flatMap((entry) => entry.subtopics.map((subtopic) => [subtopic.code, { ...subtopic, topic: entry.code }])));

  const sourceQuestions = segmentation.papers.flatMap((paper) => paper.questions.map((question) => ({ paper, question })));
  if (segmentation.papers.length !== EXPECTED.papers || sourceQuestions.length !== EXPECTED.rows) throw new Error(`9702 segmentation ${sourceQuestions.length} questions in ${segmentation.papers.length} papers`);
  if (JSON.stringify(sourceQuestions.map(({ question }) => question.id).sort()) !== JSON.stringify([...canonicalById.keys()].sort())) throw new Error("9702 segmentation ids differ from the frozen canonical set");

  if (acquisition.pair_count !== EXPECTED.sourcePapers || acquisition.document_count !== EXPECTED.sourcePapers * 2) throw new Error("9702 acquisition manifest drifted");
  const sourceUrl = (paperId, kind) => {
    const url = acquisition.papers[paperId]?.[kind]?.final_url;
    if (typeof url !== "string" || !url.startsWith("https://")) throw new Error(`9702 ${paperId} ${kind} has no kept source file`);
    return url;
  };

  const questions = [];
  const used = new Map();
  for (const { paper, question } of sourceQuestions) {
    if (question.held || question.excluded_from_practice) throw new Error(`9702 ${question.id} is held or excluded`);
    const label = labels.get(question.id);
    const entry = canonicalById.get(question.id);
    if (!label) throw new Error(`9702 ${question.id} has no final label`);
    if (!PAPERS.has(question.paper) || label.paper !== question.paper || entry.paper_number !== question.paper) throw new Error(`9702 ${question.id} paper mismatch`);
    const facts = paperFacts.papers[String(question.paper)];
    if (!facts || paper.printed_total !== facts.total_marks) throw new Error(`9702 ${paper.paper_id} printed total ${paper.printed_total} != syllabus ${facts?.total_marks}`);
    if (entry.printed_marks !== question.marks || !(question.marks > 0)) throw new Error(`9702 ${question.id} marks drifted`);
    const mcq = question.format === "multiple_choice";
    if (mcq !== (question.paper === 1) || label.format !== question.format || entry.format !== question.format) throw new Error(`9702 ${question.id} format ${question.format}`);
    if (mcq && (question.marks !== 1 || !/^[ABCD]$/.test(question.mcq_key ?? "") || question.mcq_key !== question.mcq_key_text || entry.mcq_key !== question.mcq_key)) throw new Error(`9702 ${question.id} MCQ key reads disagree`);
    const codes = [label.primary, ...label.secondaries];
    if (new Set(codes).size !== codes.length) throw new Error(`9702 ${question.id} repeats a label`);
    const resolved = codes.map((code) => {
      const topic = topicsByCode.get(code);
      if (!topic) throw new Error(`9702 ${question.id} uses unknown topic ${code}`);
      if (topic.era === "2019" && question.year > 2021) throw new Error(`9702 ${question.id} carries an earlier-syllabus topic after 2021`);
      return topic;
    });
    let subtopics = [];
    if (label.primary_subtopic !== null) {
      const subtopic = subtopicsByCode.get(label.primary_subtopic);
      if (!subtopic || subtopic.topic !== label.primary) throw new Error(`9702 ${question.id} subtopic ${label.primary_subtopic} is not under ${label.primary}`);
      subtopics = [subtopic.title];
    } else if (resolved[0].era !== "2019") throw new Error(`9702 ${question.id} has no subtopic under a current topic`);
    const session = SESSION_LABELS[question.session];
    if (!session || SERIES_CODES[question.session] !== entry.series_code) throw new Error(`9702 ${question.id} session ${question.session}`);
    const component = paper.paper_id.split("-")[3];
    if (component !== `${question.paper}${question.variant}` || entry.component !== component) throw new Error(`9702 ${question.id} component ${component}`);
    const notSat = entry.exam_status === "released_not_sat";
    if (notSat !== (question.year === 2020 && question.session === "may_june") || !["sat", "released_not_sat"].includes(entry.exam_status)) throw new Error(`9702 ${question.id} exam status ${entry.exam_status}`);
    for (const alias of entry.alias_ids) if (canonical.aliases[alias]?.canonical_id !== question.id) throw new Error(`9702 alias ${alias} does not resolve to ${question.id}`);
    const transcript = blind.transcripts.get(question.id);
    if (!transcript) throw new Error(`9702 ${question.id} has no blind transcript`);
    const questionImages = question.question_images.map((asset) => runtimeAsset("questions", asset, paper.paper_id));
    const markschemeImages = question.markscheme_images.map((asset) => runtimeAsset("markschemes", asset, paper.paper_id));
    if (!questionImages.length || !markschemeImages.length) throw new Error(`9702 ${question.id} is missing crops`);
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
      courseEra: question.year <= 2021 ? "2019" : "2022",
      era: question.year <= 2021 ? "2019" : "2022",
      subject: "Physics",
      course: COURSE,
      primaryTopic: primary.title,
      primaryTopicId: primary.id,
      secondaryTopics: secondaries.map((topic) => topic.title),
      secondaryTopicIds: secondaries.map((topic) => topic.id),
      subtopics,
      detailedSubtopics: subtopics,
      secondarySubtopics: [],
      skills: [],
      assessmentObjectives: [],
      marks: question.marks,
      maxMarks: facts.total_marks,
      marksSource: "printed_question_paper",
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
        markAllocation: label.mark_allocation,
        taxonomyPath: TAXONOMY_OUTPUT,
      },
      marks_ready: true,
      rightsStatus: RIGHTS_STATUS,
    });
  }

  if (questions.length !== EXPECTED.rows || new Set(questions.map((question) => question.id)).size !== EXPECTED.rows) throw new Error(`9702 rows ${questions.length}`);
  for (const [paper, count] of Object.entries(EXPECTED.byPaper)) if (questions.filter((question) => question.paper === Number(paper)).length !== count) throw new Error(`9702 Paper ${paper} count drifted`);
  const papers = new Set(questions.map((question) => question.paperId));
  if (papers.size !== EXPECTED.papers) throw new Error(`9702 papers ${papers.size}`);
  const years = questions.map((question) => question.year);
  const yearRange = `${Math.min(...years)}-${Math.max(...years)}`;
  if (yearRange !== EXPECTED.years) throw new Error(`9702 years ${yearRange}`);
  if (questions.filter((question) => question.year <= 2021).length !== EXPECTED.freeRows) throw new Error("9702 free-year count drifted");
  if (questions.filter((question) => question.examStatus === "released_not_sat").length !== EXPECTED.notSatRows) throw new Error("9702 not-sat count drifted");
  if (used.size !== EXPECTED.topics + EXPECTED.earlierTopics) throw new Error(`9702 topics used ${used.size}`);

  const aliases = Object.fromEntries(questions.flatMap((question) => question.aliasIds.map((alias) => [alias, question.id])).sort(([a], [b]) => a.localeCompare(b)));
  if (Object.keys(aliases).length !== EXPECTED.aliases || Object.keys(aliases).length !== Object.keys(canonical.aliases).length) throw new Error("9702 alias count drifted");

  const taxonomy = studentTaxonomy(sourceTaxonomy, used);
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
    paperFacts: Object.fromEntries(Object.entries(paperFacts.papers).map(([paper, facts]) => [paper, { name: facts.name, durationMinutes: facts.duration_minutes, totalMarks: facts.total_marks }])),
    heldQuestionIds: [],
    sourceCandidate: { paths: ["data/classification/final-labels.json"], sha256: [SOURCE_SHA256.labels], questionCount: questions.length },
    taxonomy: { path: TAXONOMY_OUTPUT, version: taxonomy.version, sha256: taxonomyFileSha },
    questions,
    publicationStatus: CANDIDATE_PUBLICATION_STATUS,
    assetVerification: "pending_upload",
    runtimeArtifact: {
      schemaVersion: "igcse-production-runtime-v1",
      sourceRepository: "cambridge-a-level-physics-9702-topic-practice",
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
      byPaper: EXPECTED.byPaper, freeRows: EXPECTED.freeRows, notSatRows: EXPECTED.notSatRows,
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
  const note = file.note.includes(ALIAS_NOTE_9702) ? file.note : `${file.note} ${ALIAS_NOTE_9702}`;
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
