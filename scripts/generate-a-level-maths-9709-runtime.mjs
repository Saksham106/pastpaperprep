#!/usr/bin/env node
/**
 * Build the Cambridge International AS & A Level Mathematics 9709 candidate runtime from the pinned source
 * workspace (cambridge-a-level-mathematics-9709-topic-practice, commit 8e5f3a7). Every input is SHA-256
 * pinned; any drift fails closed.
 *
 *   data/segmentation/full/segmentation.json   2,119 canonical questions in 256 canonical papers (crops, marks, text)
 *   data/classification/final-labels.json      2,118 labels: primary, secondaries, mark allocation (own paper only)
 *   data/classification/taxonomy.json          38 official sections 1.1-6.5, keyed 9709:2020:<code>
 *   data/canonical-manifest.json               canonical ids, exam status (sat / released_not_sat), alias ids
 *   data/held-questions.json                   questions kept out of the release (9709-2024-s-33-q11)
 *   data/paper-facts.json                      paper totals and durations from the syllabus assessment table
 *   data/source-manifest.json + acquisition-manifest.json   source URLs; each must be a kept, identity-checked file
 *   data/classification/blind-results/*.json   blind-pass plain-text transcriptions, used as accessible text
 *
 * Writes:
 *   src/data/production/a-level-maths-9709.json        candidate runtime (sealed with the blanked-v1 content seal)
 *   src/data/private-index/a-level-maths-9709.json     metadata-only private index
 *   src/data/a-level-maths-9709-taxonomy.json          student taxonomy: Papers 1-6, each with its sections
 *   src/data/question-id-aliases.json                  the bank's alias ids -> canonical ids (other banks untouched)
 * The runtime stays a candidate until the owner-approved R2 upload is read back and
 * `generate-igcse-release.mjs --finalize a-level-maths-9709` seals it.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const BANK = "a-level-maths-9709";
export const RIGHTS_STATUS = "user_attested_rights_authorized";
export const CANDIDATE_PUBLICATION_STATUS = "authorized_production_candidate";
export const DEFAULT_SOURCE_ROOT = "/Users/sakshamgoel/Documents/ProjectsInternships/cambridge-a-level-mathematics-9709-topic-practice";
export const SOURCE_COMMIT = "8e5f3a7";
export const SOURCE_SHA256 = {
  segmentation: "eb5d9ff0f4324ff1fc98676f6948514f4acb324a85912e50a1abf69fd37c3798",
  labels: "66ad8d7d1649bda242aa397c27e83c29b639a00e48fc1d804f6c87df9b8bf6ec",
  taxonomy: "cfbb1efd4efd8018bd5c0a02eac863d49043566da37d0be64ce0ddfd72918ae7",
  canonicalManifest: "2143e6553c0cfcb545e16e2449c75a82e627a9ecb9f9ff6e6c4634aa8365e40a",
  paperFacts: "69e95e717e187a71c4e2057e33583f1fcb2b803935a1e164f5935ab3283eb6c5",
  sourceManifest: "ff314542cb9f80ada368b93538d63173a76de12470980d2b484a76e4d3cf73ce",
  acquisitionManifest: "ce9e850b21e77bce4b760d885ecaffd8370f5d2c50601a1af70208c04e07f238",
  heldQuestions: "7fa568d0878f77954a10520c3baba4d0620dc9237e5aa2db0be236e8c06df231",
  /** Crop revision v2 (2026-11-15): 23 crops re-rendered under new .v2.webp names, and the 20 questions re-transcribed. */
  cropRevisions: "e8ab88cab6d82ad9367692450ade42f8e9ce8513e5b47a75dec3e0a5011ee595",
  transcriptOverrides: "abebfd7365a9e47276df8a077ecd9a57e6d1dd7b10601748d8f0543727ef5f7d",
  /** SHA-256 over the sorted "<file> <sha256>" lines of every blind-results/*.json file. */
  blindResults: "e605c6857c2694266b291a8a7f938d2c1a55858c396b733172320814cc5e6006",
};
export const EXPECTED = { canonicalQuestions: 2119, rows: 2118, papers: 256, aliases: 149, sections: 38, freeRows: 636, notSatRows: 138, years: "2020-2026", revisedCrops: 23, revisedQuestions: 20 };
export const HELD = ["9709-2024-s-33-q11"];
export const TAXONOMY_OUTPUT = "src/data/a-level-maths-9709-taxonomy.json";
export const ALIASES_OUTPUT = "src/data/question-id-aliases.json";
const SESSION_LABELS = { february_march: "March", may_june: "June", october_november: "November" };
const SERIES_CODES = { february_march: "m", may_june: "s", october_november: "w" };
const COURSE = "Cambridge International AS & A Level Mathematics 9709";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function sourceRootPath(environment = process.env) {
  return environment.PASTPAPERPREP_A_LEVEL_MATHS_SOURCE_ROOT?.trim() || DEFAULT_SOURCE_ROOT;
}

async function pinned(sourceRoot, relative, expected) {
  const bytes = await readFile(path.join(sourceRoot, relative));
  const actual = sha256(bytes);
  if (actual !== expected) throw new Error(`9709 source ${relative} SHA-256 ${actual} != pinned ${expected}`);
  return JSON.parse(bytes.toString("utf8"));
}

/** Transcripts by question id, from the pinned blind-results files. Each id must have exactly one transcript. */
export async function blindTranscripts(sourceRoot) {
  const directory = path.join(sourceRoot, "data/classification/blind-results");
  const files = (await readdir(directory)).filter((file) => file.endsWith(".json")).sort();
  const lines = [];
  const transcripts = new Map();
  for (const file of files) {
    const bytes = await readFile(path.join(directory, file));
    lines.push(`${file} ${sha256(bytes)}`);
    for (const row of JSON.parse(bytes.toString("utf8")).rows ?? []) {
      if (typeof row.transcript !== "string" || !row.transcript.trim()) continue;
      if (transcripts.has(row.id)) throw new Error(`9709 ${row.id} has more than one blind transcript`);
      transcripts.set(row.id, row.transcript.trim());
    }
  }
  return { pin: sha256(`${lines.join("\n")}\n`), transcripts };
}

/** Student taxonomy: Papers 1-6 in order, each with its official sections in syllabus order. */
export function studentTaxonomy(source, used) {
  const papers = Object.entries(source.papers).map(([paper, info]) => ({
    paper: Number(paper),
    title: info.title,
    level: info.level,
    sections: info.sections.map((code) => {
      const section = source.sections.find((candidate) => candidate.code === code);
      if (!section || section.paper !== Number(paper)) throw new Error(`9709 taxonomy section ${code} is not on Paper ${paper}`);
      return { id: section.id, code: section.code, label: section.title, level: section.level, official: true, questions: used.get(section.id) ?? 0 };
    }),
  }));
  const count = papers.reduce((sum, paper) => sum + paper.sections.length, 0);
  if (papers.length !== 6 || count !== EXPECTED.sections || source.sections.length !== EXPECTED.sections) throw new Error("9709 taxonomy shape drifted");
  return {
    artifact: "a_level_maths_9709_student_taxonomy",
    version: source.version,
    qualification: "9709",
    era: source.era,
    note: "Topics are the official syllabus sections. Each paper is its own tab; a question carries sections of its own paper only (no Pure 2 / Pure 3 cross-tags).",
    sourceTaxonomyPath: "data/classification/taxonomy.json",
    sourceTaxonomySHA256: SOURCE_SHA256.taxonomy,
    papers,
  };
}

function runtimeAsset(kind, asset, paperId) {
  const match = /^assets\/(9709-20\d{2}-[msw]-\d{2})\/(questions|markschemes)\/(q\d+-\d+-\d+(?:\.v2)?\.webp)$/.exec(asset.path);
  if (!match || match[2] !== kind || match[1] !== paperId) throw new Error(`Unexpected 9709 ${kind} asset path: ${asset.path}`);
  return `${kind}/${match[1]}/${match[3]}`;
}

/** Deterministic self-seal: candidate hash over the artifact with every seal field blanked, then the runtime self-hash. */
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
  const canonical = await pinned(sourceRoot, "data/canonical-manifest.json", SOURCE_SHA256.canonicalManifest);
  const paperFacts = await pinned(sourceRoot, "data/paper-facts.json", SOURCE_SHA256.paperFacts);
  const sourceManifest = await pinned(sourceRoot, "data/source-manifest.json", SOURCE_SHA256.sourceManifest);
  const acquisition = await pinned(sourceRoot, "data/acquisition-manifest.json", SOURCE_SHA256.acquisitionManifest);
  const held = await pinned(sourceRoot, "data/held-questions.json", SOURCE_SHA256.heldQuestions);
  const cropRevisions = await pinned(sourceRoot, "data/crop-revisions.json", SOURCE_SHA256.cropRevisions);
  const transcriptOverrides = await pinned(sourceRoot, "data/classification/transcript-overrides.json", SOURCE_SHA256.transcriptOverrides);
  const blind = await blindTranscripts(sourceRoot);
  // Re-transcriptions from the v2 crops replace the blind-pass text for the revised questions.
  for (const row of transcriptOverrides.rows) {
    if (!blind.transcripts.has(row.id) || typeof row.transcript !== "string" || !row.transcript.trim()) throw new Error(`9709 transcript override ${row.id} is invalid`);
    blind.transcripts.set(row.id, row.transcript.trim());
  }
  const revisedQuestions = new Set(Object.values(cropRevisions.revisions).map((revision) => revision.question));
  if (Object.keys(cropRevisions.revisions).length !== EXPECTED.revisedCrops || revisedQuestions.size !== EXPECTED.revisedQuestions
    || transcriptOverrides.rows.length !== EXPECTED.revisedQuestions || transcriptOverrides.rows.some((row) => !revisedQuestions.has(row.id))) throw new Error("9709 crop revision set drifted");
  if (blind.pin !== SOURCE_SHA256.blindResults) throw new Error(`9709 blind results ${blind.pin} != pinned ${SOURCE_SHA256.blindResults}`);

  if (JSON.stringify(Object.keys(held.questions).sort()) !== JSON.stringify(HELD)) throw new Error("9709 held set drifted");
  if (!canonical.frozen || canonical.canonical_questions.length !== EXPECTED.canonicalQuestions) throw new Error("9709 canonical manifest drifted");
  const canonicalById = new Map(canonical.canonical_questions.map((question) => [question.id, question]));
  const labels = new Map(finalLabels.labels.map((label) => [label.id, label]));
  if (labels.size !== EXPECTED.rows || finalLabels.labels.length !== EXPECTED.rows) throw new Error("9709 labels do not cover the release once each");
  const sections = new Map(sourceTaxonomy.sections.map((section) => [section.code, section]));

  const sourceQuestions = segmentation.papers.flatMap((paper) => paper.questions.map((question) => ({ paper, question })));
  if (segmentation.papers.length !== EXPECTED.papers || sourceQuestions.length !== EXPECTED.canonicalQuestions) throw new Error(`9709 segmentation ${sourceQuestions.length} questions in ${segmentation.papers.length} papers`);
  if (JSON.stringify(sourceQuestions.map(({ question }) => question.id).sort()) !== JSON.stringify([...canonicalById.keys()].sort())) throw new Error("9709 segmentation ids differ from the frozen canonical set");

  const kept = new Set(Object.values(acquisition.papers).flatMap((paper) => [paper.question_paper?.final_url, paper.mark_scheme?.final_url]).filter(Boolean));
  if (acquisition.pair_count !== 276 || acquisition.document_count !== 552 || kept.size !== 552) throw new Error("9709 acquisition manifest drifted");
  const sourceUrl = (paperId, kind) => {
    const url = sourceManifest.papers[paperId]?.[kind]?.canonical_exact_url;
    if (!url || !kept.has(url)) throw new Error(`9709 ${paperId} ${kind} is not a kept source file`);
    return url;
  };

  const questions = [];
  const used = new Map();
  for (const { paper, question } of sourceQuestions) {
    if (HELD.includes(question.id)) {
      if (!question.held || labels.has(question.id)) throw new Error(`9709 held question ${question.id} is not held in the source`);
      continue;
    }
    if (question.held || question.excluded_from_practice) throw new Error(`9709 ${question.id} is held or excluded outside the held set`);
    const label = labels.get(question.id);
    const entry = canonicalById.get(question.id);
    if (!label) throw new Error(`9709 ${question.id} has no final label`);
    if (label.paper !== question.paper || entry.paper_number !== question.paper) throw new Error(`9709 ${question.id} paper mismatch`);
    const facts = paperFacts.papers[String(question.paper)];
    if (!facts || paper.printed_total !== facts.total_marks) throw new Error(`9709 ${paper.paper_id} printed total ${paper.printed_total} != syllabus ${facts?.total_marks}`);
    if (entry.printed_marks !== question.marks || !(question.marks > 0)) throw new Error(`9709 ${question.id} marks drifted`);
    const codes = [label.primary, ...label.secondaries];
    if (new Set(codes).size !== codes.length) throw new Error(`9709 ${question.id} repeats a label`);
    const resolved = codes.map((code) => {
      const section = sections.get(code);
      if (!section) throw new Error(`9709 ${question.id} uses unknown section ${code}`);
      if (section.paper !== question.paper) throw new Error(`9709 ${question.id} carries ${code} from another paper`);
      return section;
    });
    const session = SESSION_LABELS[question.session];
    if (!session || SERIES_CODES[question.session] !== entry.series_code) throw new Error(`9709 ${question.id} session ${question.session}`);
    const component = paper.paper_id.split("-")[3];
    if (component !== `${question.paper}${question.variant}` || entry.component !== component) throw new Error(`9709 ${question.id} component ${component}`);
    const notSat = entry.exam_status === "released_not_sat";
    if (notSat !== (question.year === 2020 && question.session === "may_june") || !["sat", "released_not_sat"].includes(entry.exam_status)) throw new Error(`9709 ${question.id} exam status ${entry.exam_status}`);
    for (const alias of entry.alias_ids) if (canonical.aliases[alias]?.canonical_id !== question.id) throw new Error(`9709 alias ${alias} does not resolve to ${question.id}`);
    const transcript = blind.transcripts.get(question.id);
    if (!transcript) throw new Error(`9709 ${question.id} has no blind transcript`);
    const questionImages = question.question_images.map((asset) => runtimeAsset("questions", asset, paper.paper_id));
    const markschemeImages = question.markscheme_images.map((asset) => runtimeAsset("markschemes", asset, paper.paper_id));
    if (!questionImages.length || !markschemeImages.length) throw new Error(`9709 ${question.id} is missing crops`);
    for (const section of resolved) used.set(section.id, (used.get(section.id) ?? 0) + 1);
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
      zone: `Variant ${question.variant}`,
      component,
      courseEra: "2020",
      era: "2020",
      subject: "Mathematics",
      course: COURSE,
      primaryTopic: primary.title,
      primaryTopicId: primary.id,
      secondaryTopics: secondaries.map((section) => section.title),
      secondaryTopicIds: secondaries.map((section) => section.id),
      subtopics: [],
      detailedSubtopics: [],
      secondarySubtopics: [],
      skills: [],
      assessmentObjectives: [],
      marks: question.marks,
      maxMarks: facts.total_marks,
      marksSource: "printed_question_paper",
      summary: transcript.slice(0, 220),
      accessibleText: transcript,
      questionImages,
      markschemeImages,
      questionImageHashes: question.question_images.map((asset) => asset.sha256),
      markschemeImageHashes: question.markscheme_images.map((asset) => asset.sha256),
      officialMarkscheme: { images: markschemeImages, imageHashes: question.markscheme_images.map((asset) => asset.sha256) },
      officialCodeRefs: resolved.map((section) => section.id),
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
        secondaryCodes: [...label.secondaries],
        markAllocation: label.mark_allocation,
        taxonomyPath: TAXONOMY_OUTPUT,
      },
      marks_ready: true,
      rightsStatus: RIGHTS_STATUS,
    });
  }

  if (questions.length !== EXPECTED.rows || new Set(questions.map((question) => question.id)).size !== EXPECTED.rows) throw new Error(`9709 rows ${questions.length}`);
  const papers = new Set(questions.map((question) => question.paperId));
  if (papers.size !== EXPECTED.papers) throw new Error(`9709 papers ${papers.size}`);
  const years = questions.map((question) => question.year);
  const yearRange = `${Math.min(...years)}-${Math.max(...years)}`;
  if (yearRange !== EXPECTED.years) throw new Error(`9709 years ${yearRange}`);
  if (questions.filter((question) => question.year <= 2021).length !== EXPECTED.freeRows) throw new Error("9709 free-year count drifted");
  if (questions.filter((question) => question.examStatus === "released_not_sat").length !== EXPECTED.notSatRows) throw new Error("9709 not-sat count drifted");
  if (used.size !== EXPECTED.sections) throw new Error(`9709 sections used ${used.size}`);

  const aliases = Object.fromEntries(questions.flatMap((question) => question.aliasIds.map((alias) => [alias, question.id])).sort(([a], [b]) => a.localeCompare(b)));
  if (Object.keys(aliases).length !== EXPECTED.aliases || Object.keys(aliases).length !== Object.keys(canonical.aliases).length) throw new Error("9709 alias count drifted");

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
    heldQuestionIds: [...HELD],
    sourceCandidate: { paths: ["data/classification/final-labels.json"], sha256: [SOURCE_SHA256.labels], questionCount: questions.length },
    taxonomy: { path: TAXONOMY_OUTPUT, version: taxonomy.version, sha256: taxonomyFileSha },
    questions,
    publicationStatus: CANDIDATE_PUBLICATION_STATUS,
    assetVerification: "pending_upload",
    runtimeArtifact: {
      schemaVersion: "igcse-production-runtime-v1",
      sourceRepository: "cambridge-a-level-mathematics-9709-topic-practice",
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
    artifact,
    serialized: `${JSON.stringify(artifact, null, 2)}\n`,
    seals,
    taxonomy,
    taxonomySerialized,
    aliases,
    report: {
      status: "PASS", bank: BANK, rows: questions.length, papers: papers.size, years: yearRange, aliases: Object.keys(aliases).length,
      freeRows: EXPECTED.freeRows, notSatRows: EXPECTED.notSatRows, held: HELD,
      runtimeAssetRefs: new Set(questions.flatMap((question) => [...question.questionImages, ...question.markschemeImages])).size,
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

/** Replaces only this bank's entry in the shared alias file; every other bank's map is kept byte-for-byte in value. */
export const ALIAS_NOTE_9709 = "A Level Maths 9709: a variant that reprints another variant of the same series (for example 9709/23 = 9709/22) maps to the canonical question, from the source workspace's frozen canonical manifest.";
export function withBankAliases(file, aliases) {
  const note = file.note.includes(ALIAS_NOTE_9709) ? file.note : `${file.note} ${ALIAS_NOTE_9709}`;
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
