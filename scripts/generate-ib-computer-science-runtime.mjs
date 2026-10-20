#!/usr/bin/env node
/**
 * Build the IB Computer Science HL and SL candidate runtimes from the pinned source workspace.
 *
 * Inputs (SHA-256 pinned; any drift fails closed), all under the source workspace
 * (ib-computer-science-topic-practice, commit a0c91c8):
 *   data/segmentation/full/segmentation.json   897 questions across 64 QP/MS pairs, May 2019 to May 2026
 *   data/classification/final-labels.json      897 labels (primary, secondaries, mark allocation, new_scope)
 *   data/classification/taxonomy.json          owner-approved tree: the new (2027) guide, then the earlier
 *                                              (2014) guide used by every paper in scope
 *   data/source-manifest.json                  source URLs (IB Docs; papers.xtremepape.rs for May 2026)
 *   data/acquisition-manifest.json             the kept source files; every source URL must be listed there
 *
 * Writes, per bank (HL holds every HL question, SL every SL question):
 *   src/data/production/<bank>.json           candidate runtime
 *   src/data/private-index/<bank>.json        metadata-only private index
 * and one shared student taxonomy, src/data/ib-computer-science-taxonomy.json. The runtimes stay
 * candidates until the R2 upload receipt exists and `generate-igcse-release.mjs --finalize <bank>` seals them.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const BANKS = {
  "ib-computer-science-hl": { level: "HL", course: "IB Computer Science HL", rows: 506, papers: 32 },
  "ib-computer-science-sl": { level: "SL", course: "IB Computer Science SL", rows: 391, papers: 32 },
};
export const RIGHTS_STATUS = "user_attested_rights_authorized";
export const CANDIDATE_PUBLICATION_STATUS = "authorized_production_candidate";
export const DEFAULT_SOURCE_ROOT = "/Users/sakshamgoel/Documents/ProjectsInternships/ib-computer-science-topic-practice";
export const SOURCE_COMMIT = "a0c91c8";
export const SOURCE_SHA256 = {
  segmentation: "0c8bde3babaa875f2fbe606bc3f7c004b6b6d8e185e12589332a9f598a157c1c",
  labels: "cf37adc7b7904597a415a9f20e46fbf2d1a61d5d66cb5b22cd2227fecfd5aead",
  taxonomy: "8f984cd3ad44ec2a2eff48521c47600e44186005f81b5607ae22a131ee316830",
  sourceManifest: "b3f98f7f089b66f46263f9277c369a08d7449b0eea6d25bec7ca331ef1b85399",
  acquisitionManifest: "5451a3f7e66a2a512bd533d14d7767ac39130f0d8bc7c660dea3febe1465a809",
};
export const EXPECTED = { sourceQuestions: 897, pairs: 64, sections: 53, years: "2019-2026" };
/** Printed paper totals by level and paper (the QP cover; six SL Paper 2 mark schemes print 65 in error). */
const PRINTED_TOTALS = { HL: { 1: 100, 2: 65 }, SL: { 1: 70, 2: 45 } };
const SESSIONS = new Set(["May", "November"]);
export const TAXONOMY_OUTPUT = "src/data/ib-computer-science-taxonomy.json";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function sourceRootPath(environment = process.env) {
  return environment.PASTPAPERPREP_IB_COMPUTER_SCIENCE_SOURCE_ROOT?.trim() || DEFAULT_SOURCE_ROOT;
}

async function pinned(sourceRoot, relative, expected) {
  const bytes = await readFile(path.join(sourceRoot, relative));
  const actual = sha256(bytes);
  if (actual !== expected) throw new Error(`IB Computer Science source ${relative} SHA-256 ${actual} != pinned ${expected}`);
  return JSON.parse(bytes.toString("utf8"));
}

/**
 * Student-facing tree, shared by both banks. New-guide topics A1 to B4 first, in teaching order, each with its
 * subtopic sections; then the earlier-syllabus topics 1 to 7, then options A to D, each with its subtopics.
 * `banks` lists the banks whose questions carry the section: a bank's topic picker shows only those.
 */
export function studentTaxonomy(source, usedByBank) {
  const labels = source.labels;
  for (let i = 1; i < labels.length; i += 1) if (!(labels[i].order > labels[i - 1].order)) throw new Error("IB Computer Science taxonomy labels are not in teaching order");
  const topics = [];
  for (const label of labels) {
    if (label.level !== "topic" && label.level !== "option") continue;
    const sections = labels
      .filter((candidate) => candidate.level === "subtopic" && candidate.parent_id === label.id)
      .map((section) => ({
        id: section.id,
        code: section.code,
        label: section.label,
        official: true,
        era: section.era,
        scope: section.scope,
        banks: Object.keys(usedByBank).filter((bank) => usedByBank[bank].has(section.id)),
      }));
    if (!sections.length) throw new Error(`IB Computer Science topic ${label.id} has no sections`);
    topics.push({
      id: label.id,
      code: label.code,
      label: label.label,
      official: true,
      era: label.era,
      scope: label.scope,
      banks: Object.keys(usedByBank).filter((bank) => sections.some((section) => section.banks.includes(bank))),
      sections,
    });
  }
  const sectionCount = topics.reduce((sum, topic) => sum + topic.sections.length, 0);
  if (sectionCount !== EXPECTED.sections || labels.filter((label) => label.level === "subtopic").length !== sectionCount) throw new Error("IB Computer Science taxonomy shape drifted");
  return {
    artifact: "ib_computer_science_student_taxonomy",
    version: "ib_computer_science_source_backed_taxonomy@1",
    boardcode: "IB Computer Science",
    eras: source.eras,
    note: "New-guide topics (first assessment May 2027) come first; the earlier-syllabus topics and options (the 2014 guide every 2019-2026 paper was set under) follow. A bank's picker shows only the sections that carry at least one of its questions.",
    sourceTaxonomyPath: "data/classification/taxonomy.json",
    sourceTaxonomySHA256: SOURCE_SHA256.taxonomy,
    topics,
  };
}

function runtimeAsset(kind, asset, pair) {
  const match = /^assets\/(ib-cs-\d{4}-(?:may|nov)-(?:hl|sl)-p[12]-tz\d)\/(questions|markschemes)\/(q\d+-\d+-\d+\.webp)$/.exec(asset.path);
  if (!match || match[2] !== kind || match[1] !== pair) throw new Error(`Unexpected IB Computer Science ${kind} asset path: ${asset.path}`);
  return `${kind}/${match[1]}/${match[3]}`;
}

function toQuestion(bank, question, paper, label, sections, provenance) {
  const codes = [label.primary, ...label.secondaries];
  if (new Set(codes).size !== codes.length) throw new Error(`IB Computer Science ${question.id} repeats a label`);
  const resolved = codes.map((code) => {
    const hit = sections.get(code);
    if (!hit) throw new Error(`IB Computer Science ${question.id} uses unknown section ${code}`);
    return hit;
  });
  if (label.component.split("-")[1] !== question.level) throw new Error(`IB Computer Science ${question.id} label is for another level`);
  if (label.marks !== question.marks) throw new Error(`IB Computer Science ${question.id} label marks ${label.marks} != ${question.marks}`);
  const [primary] = resolved;
  if (!SESSIONS.has(question.session)) throw new Error(`Unknown IB Computer Science session: ${question.session}`);
  const questionImages = question.question_images.map((asset) => runtimeAsset("questions", asset, question.pair_id));
  const markschemeImages = question.markscheme_images.map((asset) => runtimeAsset("markschemes", asset, question.pair_id));
  if (!questionImages.length || !markschemeImages.length) throw new Error(`IB Computer Science ${question.id} is missing crops`);
  if (!(question.marks > 0)) throw new Error(`IB Computer Science ${question.id} has no positive printed marks`);
  const paperTotal = PRINTED_TOTALS[question.level][question.paper];
  if (paper.printed_total !== paperTotal) throw new Error(`IB Computer Science ${paper.pair_id} printed total ${paper.printed_total}`);
  const option = question.paper === 2 ? question.option : null;
  if (question.paper === 2 && (!option || !question.option_name)) throw new Error(`IB Computer Science ${question.id} is Paper 2 without an option`);
  if (question.paper === 1 && question.option) throw new Error(`IB Computer Science ${question.id} is Paper 1 with an option`);
  // Paper 2 is sat as one option: its maximum is the option's total, which equals the printed paper total.
  const maxMarks = option ? paper.option_totals?.[option] : paper.printed_total;
  if (maxMarks !== paperTotal) throw new Error(`IB Computer Science ${question.id} maximum ${maxMarks}`);
  const subtopics = [...new Set(resolved.map((hit) => hit.section.label))];
  const topicLabels = resolved.map((hit) => hit.topic.label);
  const topicIds = resolved.map((hit) => hit.topic.id);
  return {
    id: question.id,
    canonicalId: question.id,
    bankSlug: bank,
    paperId: question.pair_id,
    number: question.number,
    paper: question.paper,
    year: question.year,
    session: question.session,
    zone: question.tz,
    timezone: question.tz,
    level: question.level,
    component: option ? `P2 Option ${option}` : "P1",
    ...(option ? { optionTitle: question.option_name } : {}),
    courseEra: "2014",
    era: "2014",
    subject: "Computer Science",
    course: BANKS[bank].course,
    primaryTopic: primary.topic.label,
    primaryTopicId: primary.topic.id,
    secondaryTopics: [...new Set(topicLabels.slice(1))].filter((topic) => topic !== primary.topic.label),
    secondaryTopicIds: [...new Set(topicIds.slice(1))].filter((id) => id !== primary.topic.id),
    subtopics,
    detailedSubtopics: subtopics,
    secondarySubtopics: subtopics.slice(1),
    skills: [],
    assessmentObjectives: [],
    syllabusScope: label.new_scope ?? null,
    marks: question.marks,
    maxMarks,
    marksSource: "printed_question_paper",
    summary: question.text.slice(0, 220),
    accessibleText: question.text,
    questionImages,
    markschemeImages,
    questionImageHashes: question.question_images.map((asset) => asset.sha256),
    markschemeImageHashes: question.markscheme_images.map((asset) => asset.sha256),
    officialMarkscheme: { images: markschemeImages, imageHashes: question.markscheme_images.map((asset) => asset.sha256) },
    officialCodeRefs: codes,
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
      markAllocation: label.mark_allocation,
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

export async function buildRuntimes({ sourceRoot = sourceRootPath() } = {}) {
  const segmentation = await pinned(sourceRoot, "data/segmentation/full/segmentation.json", SOURCE_SHA256.segmentation);
  const finalLabels = await pinned(sourceRoot, "data/classification/final-labels.json", SOURCE_SHA256.labels);
  const sourceTaxonomy = await pinned(sourceRoot, "data/classification/taxonomy.json", SOURCE_SHA256.taxonomy);
  const sourceManifest = await pinned(sourceRoot, "data/source-manifest.json", SOURCE_SHA256.sourceManifest);
  const acquisition = await pinned(sourceRoot, "data/acquisition-manifest.json", SOURCE_SHA256.acquisitionManifest);

  const sourceQuestions = segmentation.papers.flatMap((paper) => paper.questions.map((question) => ({ paper, question })));
  if (segmentation.papers.length !== EXPECTED.pairs || sourceQuestions.length !== EXPECTED.sourceQuestions) throw new Error(`IB Computer Science source ${sourceQuestions.length} questions in ${segmentation.papers.length} pairs`);
  if (finalLabels.labels.length !== EXPECTED.sourceQuestions || new Set(finalLabels.labels.map((label) => label.id)).size !== EXPECTED.sourceQuestions) throw new Error("IB Computer Science labels do not cover the source questions once each");
  if (sourceQuestions.some(({ question }) => question.excluded_from_practice)) throw new Error("IB Computer Science source excludes a question; the scope has no exclusions");
  const labels = new Map(finalLabels.labels.map((label) => [label.id, label]));

  // Every source URL must be one of the kept, identity-checked files.
  const kept = new Set(acquisition.files.map((file) => file.url));
  if (acquisition.kept_count !== acquisition.files.length || acquisition.files.length !== EXPECTED.pairs * 2) throw new Error("IB Computer Science acquisition manifest drifted");
  const sourceUrl = (pairId, kind) => {
    const url = sourceManifest.pairs[pairId]?.[kind]?.url;
    if (!url || !kept.has(url)) throw new Error(`IB Computer Science ${pairId} ${kind} is not a kept source file`);
    return url;
  };

  // Section index (leaf subtopic id -> section and topic), and the sections each bank's questions carry.
  const draft = studentTaxonomy(sourceTaxonomy, Object.fromEntries(Object.keys(BANKS).map((bank) => [bank, new Set()])));
  const sections = new Map(draft.topics.flatMap((topic) => topic.sections.map((section) => [section.id, { topic, section }])));
  const usedByBank = Object.fromEntries(Object.keys(BANKS).map((bank) => [bank, new Set()]));
  for (const { question } of sourceQuestions) {
    const label = labels.get(question.id);
    if (!label) throw new Error(`IB Computer Science ${question.id} has no final label`);
    const bank = Object.keys(BANKS).find((slug) => BANKS[slug].level === question.level);
    if (!bank) throw new Error(`IB Computer Science ${question.id} has level ${question.level}`);
    for (const code of [label.primary, ...label.secondaries]) usedByBank[bank].add(code);
  }
  const taxonomy = studentTaxonomy(sourceTaxonomy, usedByBank);
  const taxonomySerialized = `${JSON.stringify(taxonomy, null, 2)}\n`;
  const taxonomyFileSha = sha256(taxonomySerialized);

  const built = {};
  for (const [bank, config] of Object.entries(BANKS)) {
    const questions = [];
    for (const { paper, question } of sourceQuestions) {
      if (question.level !== config.level) continue;
      const provenance = { question: sourceUrl(paper.pair_id, "qp_file"), markscheme: sourceUrl(paper.pair_id, "ms_file") };
      questions.push(toQuestion(bank, question, paper, labels.get(question.id), sections, provenance));
    }
    if (questions.length !== config.rows) throw new Error(`${bank} rows ${questions.length} != ${config.rows}`);
    if (new Set(questions.map((question) => question.id)).size !== questions.length) throw new Error(`${bank} question ids are not unique`);
    const papers = new Set(questions.map((question) => question.paperId));
    if (papers.size !== config.papers) throw new Error(`${bank} papers ${papers.size} != ${config.papers}`);
    const years = questions.map((question) => question.year);
    const yearRange = `${Math.min(...years)}-${Math.max(...years)}`;
    if (yearRange !== EXPECTED.years) throw new Error(`${bank} years ${yearRange}`);
    const shown = new Set(questions.flatMap((question) => question.officialCodeRefs));

    const artifact = {
      version: `${bank}-full${questions.length}-v1`,
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
        paths: ["data/classification/final-labels.json"],
        sha256: [SOURCE_SHA256.labels],
        questionCount: questions.length,
      },
      taxonomy: { path: TAXONOMY_OUTPUT, version: taxonomy.version, sha256: taxonomyFileSha },
      questions,
      publicationStatus: CANDIDATE_PUBLICATION_STATUS,
      assetVerification: "pending_upload",
      runtimeArtifact: {
        schemaVersion: "igcse-production-runtime-v1",
        sourceRepository: "ib-computer-science-topic-practice",
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
    built[bank] = {
      artifact,
      serialized: `${JSON.stringify(artifact, null, 2)}\n`,
      seals,
      report: {
        status: "PASS", bank, rows: questions.length, papers: papers.size, years: yearRange, sectionsShown: shown.size,
        runtimeAssetRefs: new Set(questions.flatMap((question) => [...question.questionImages, ...question.markschemeImages])).size,
      },
    };
  }
  return { banks: built, taxonomy, taxonomySerialized };
}

export function createPrivateIndex(artifact) {
  return {
    version: 1,
    bank: artifact.questions[0].bankSlug,
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

export async function writeRuntimes({ repo = path.resolve(import.meta.dirname, ".."), sourceRoot = sourceRootPath() } = {}) {
  const built = await buildRuntimes({ sourceRoot });
  await writeFile(path.join(repo, TAXONOMY_OUTPUT), built.taxonomySerialized);
  const results = {};
  for (const [bank, result] of Object.entries(built.banks)) {
    const output = path.join(repo, "src/data/production", `${bank}.json`);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, result.serialized);
    // Metadata-only candidate private index: no answers, text or asset paths cross this boundary.
    const privateIndex = path.join(repo, "src/data/private-index", `${bank}.json`);
    await mkdir(path.dirname(privateIndex), { recursive: true });
    await writeFile(privateIndex, `${JSON.stringify(createPrivateIndex(result.artifact))}\n`);
    results[bank] = { ...result, output, privateIndex };
  }
  return { ...built, banks: results };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const result = await writeRuntimes();
  console.log(JSON.stringify(Object.values(result.banks).map((bank) => ({ ...bank.report, seals: bank.seals, output: bank.output })), null, 2));
}
