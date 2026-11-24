#!/usr/bin/env node
/**
 * Build the IB Business Management HL and SL candidate runtimes from the pinned source workspace.
 *
 * Inputs (SHA-256 pinned; any drift fails closed), all under the source workspace
 * (ib-business-management-topic-practice, commit 817b319):
 *   data/segmentation/full/questions.json   385 questions, Nov 2020 to May 2026 (old guide P1/P2 Sections A and B; 2024 guide P1/P2/P3)
 *   data/segmentation/full/stimuli.json     28 shared case-study sets (P1 and P3)
 *   data/segmentation/full/markbands.json   71 shared markband sets
 *   data/segmentation/full/papers.json      78 segmented papers (printed maxima); Nov 2025 P2 SL TZ1 is held (its QP is missing)
 *   data/classification/final-labels.json   385 labels (primary, secondaries, mark allocation, toolkit, HL-only basis)
 *   data/taxonomy/labels.json               owner-approved tree (2026-11-23): 5 units, the toolkit, 5 earlier-syllabus filters
 *   data/taxonomy/paper-filters.json        Paper 1 / Paper 2 / Paper 3 (HL only)
 *   data/acquisition-manifest.json          the kept source files; every source URL must be listed there
 *
 * Writes, per bank (HL holds every question that serves HL, SL every question that serves SL; the joint 2024+ Paper 1 is in both):
 *   src/data/production/<bank>.json           candidate runtime
 *   src/data/private-index/<bank>.json        metadata-only private index
 * and one shared student taxonomy, src/data/ib-business-management-taxonomy.json. The runtimes stay candidates until the
 * R2 upload receipt exists and `generate-igcse-release.mjs --finalize <bank>` seals them.
 *
 * Shared objects: a case study's crops are stored once under stimuli/<stimulus_id>/<file>.webp and a markband set's crops once
 * under markbands/<markband_id>/<file>.webp; every question that uses them references the same key. A question's images are
 * the stimulus crops then its own crops; its mark scheme is its own crops then the markband crops.
 */
import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const BANKS = {
  "ib-business-management-hl": { level: "HL", rows: 260, papers: 49, course: "IB Business Management HL" },
  "ib-business-management-sl": { level: "SL", rows: 218, papers: 41, course: "IB Business Management SL" },
};
export const RIGHTS_STATUS = "user_attested_rights_authorized";
export const CANDIDATE_PUBLICATION_STATUS = "authorized_production_candidate";
export const DEFAULT_SOURCE_ROOT = "/Users/sakshamgoel/Documents/ProjectsInternships/ib-business-management-topic-practice";
export const SOURCE_COMMIT = "817b319";
export const SOURCE_SHA256 = {
  questions: "73637ac8765c6e68314c945f8a9a8eeab58fa4fe3cac2d479c286eaa7f27ab01",
  stimuli: "ae4fca917efb64cc116de3023d65babf421063897018300b86f13e1f3845715f",
  markbands: "cab4f655558df1d74f5cfc22b2a83dc5bad43170b06f6f73e21126d48c32e8c8",
  papers: "a9c950331b2f9b99c08e584be15b8d0f1e4d12a13b50973dffede209f7dca227",
  labels: "b47d4b96eef04c9ba7047d4001824fc48ca0a4e453dc7c3e7173137c910100a1",
  taxonomy: "d9ff54d2ee820f35480da75b2d0ea3640b57ef0ff6fe990ff1419db9464338ee",
  paperFilters: "a64908d1a7d271b99b4b0e1d156a68b75da4ace8041db08e5044077760f2c97c",
  acquisitionManifest: "0bca35e0f5a40ce61c49df9ae00230d37048b98d30e09928ff05c606660b796a",
};
export const EXPECTED = { sourceQuestions: 385, papers: 78, stimuli: 28, markbands: 71, years: "2020-2026", sections: { HL: 55, SL: 36 } };
/** The held paper: its question paper is missing, so none of its questions may appear. */
export const HELD_PAPER_ID = "ibbm-2025-nov-sl-p2-tz1";
export const TAXONOMY_OUTPUT = "src/data/ib-business-management-taxonomy.json";
export const TOOLKIT_TOPIC = { id: "2024:toolkit", label: "Business management toolkit" };
export const EARLIER_TOPIC = { id: "2016:earlier", label: "Earlier syllabus" };

/**
 * Owner decision 2026-11-23: old-guide Paper 2 Section C (the concept essay) is out. Ten old-guide Paper 2 markband sets
 * (HL and SL, Nov 2020 and the four 2023 papers) carry its "Assessment criteria for Section C" on pages 2 and 3 of the set;
 * page 1 of each set is the Section A and B markbands and stays. Derived by reading the text of every crop from its mark
 * scheme page and bbox (2026-11-24), pinned by [markband id, crop SHA-256] and dropped here, not at the source.
 */
export const SECTION_C_MARKBAND_CROPS = [
  ["ibbm-2020-nov-hl-p2-tz0-markbands", "0ca9348dbaf7e3a207d88f34796bb7b15e17635170160bb0f6c665a0b91d178f"],
  ["ibbm-2020-nov-hl-p2-tz0-markbands", "be0f793a3509170aac7dc340c0d4d5b595c543dafd552f2ab246b920047ce83d"],
  ["ibbm-2020-nov-sl-p2-tz0-markbands", "48641e03344fba017c31934245d4a9c950eba730691b4bf4f263a105d2305614"],
  ["ibbm-2020-nov-sl-p2-tz0-markbands", "0759b69f9d7e87d13d068cca2063a4868fbdc46b6efb8bc45d7af40f2be0c401"],
  ["ibbm-2023-may-hl-p2-tz1-markbands", "9815099294d1c745d38ddd84fc44a0570e416b3dda62c7126fed9016c2810b36"],
  ["ibbm-2023-may-hl-p2-tz1-markbands", "dce57cad4fcdc431377440db4d6bdfe17844533919ba0d7fb58d4dc3dfdf4f89"],
  ["ibbm-2023-may-sl-p2-tz1-markbands", "cfa66254cc09e37f6fd1196eef0bf18e74a99e4e75d458a406391b0843c4f1f6"],
  ["ibbm-2023-may-sl-p2-tz1-markbands", "cbed72e1aa67a2a7fc0095826ca58fada9578101bc2ebdbc04a0a2cda541d7d8"],
  ["ibbm-2023-may-hl-p2-tz2-markbands", "321b6476417cd03da064bbd6900984b43817ea73ef07cfe67488d793b785be79"],
  ["ibbm-2023-may-hl-p2-tz2-markbands", "e319a115151022da9b1edcaaa6640df1343892da1bb68ecfdbc521d8bf9c45a2"],
  ["ibbm-2023-may-sl-p2-tz2-markbands", "e57b60f366093f7617e2118be38ef7a731aec24cfee9475c19edd27b5545c783"],
  ["ibbm-2023-may-sl-p2-tz2-markbands", "fef0f32e18a0562dea996312d35367c667fa7ba1608f977f50dfb735c4409f68"],
  ["ibbm-2023-nov-hl-p2-tz1-markbands", "8ebeb5cc2634b5ec983a5ed00a86739bda6bd20cf048914286b02d4c915b151b"],
  ["ibbm-2023-nov-hl-p2-tz1-markbands", "daee70f7230b6b884621f5920dae2693eb3d3ec3b9aebcf543a1d4372eb5d6d9"],
  ["ibbm-2023-nov-sl-p2-tz1-markbands", "53037e2dd709db1a10314291874707259e554a9d63bc6c3e87000632e694ea6f"],
  ["ibbm-2023-nov-sl-p2-tz1-markbands", "6ce75c8ba9e4eca98db976fd85ed64c651427f35fb86bd9ab4480caba751f9fe"],
  ["ibbm-2023-nov-hl-p2-tz2-markbands", "1c8967e11e351efc79f775a6896de4a12a61385d30db0d2e7025110066f533f6"],
  ["ibbm-2023-nov-hl-p2-tz2-markbands", "41b4d35e8f81ff76f9479a6ece0df189cbdcf842e379a54a7bc79decd6978ac5"],
  ["ibbm-2023-nov-sl-p2-tz2-markbands", "34b2cbc92424ec9e693765698618a7bc29de21434430a3f0b8447e6ddadab0ba"],
  ["ibbm-2023-nov-sl-p2-tz2-markbands", "f44291698f0c1e8b9430ea536178a92d20b081962456393ff5b370e4baefb3b3"],
];

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function sourceRootPath(environment = process.env) {
  return environment.PASTPAPERPREP_IB_BUSINESS_MANAGEMENT_SOURCE_ROOT?.trim() || DEFAULT_SOURCE_ROOT;
}

async function pinned(sourceRoot, relative, expected) {
  const bytes = await readFile(path.join(sourceRoot, relative));
  const actual = sha256(bytes);
  if (actual !== expected) throw new Error(`IB Business Management source ${relative} SHA-256 ${actual} != pinned ${expected}`);
  return JSON.parse(bytes.toString("utf8"));
}

/**
 * Student-facing tree, shared by both banks. Units 1 to 5 in teaching order (2024-guide subtopics as sections; leaf points
 * are tags, never filters), then the toolkit (each tool a section), then one "Earlier syllabus" topic holding the five
 * earlier-syllabus filters. A section's `banks` lists the banks whose questions carry it: a bank's picker shows only those.
 */
export function studentTaxonomy(source, usedByBank) {
  const labels = source.labels;
  for (let i = 1; i < labels.length; i += 1) if (!(labels[i].order > labels[i - 1].order)) throw new Error("IB Business Management taxonomy labels are not in teaching order");
  const banksFor = (id) => Object.keys(usedByBank).filter((bank) => usedByBank[bank].has(id));
  const section = (label) => ({ id: label.id, code: label.code, label: label.label, official: true, era: label.era, scope: label.scope, banks: banksFor(label.id) });
  const topic = (head, sections) => {
    if (!sections.length) throw new Error(`IB Business Management topic ${head.id} has no sections`);
    return {
      id: head.id, code: head.code ?? null, label: head.label, official: true, era: head.era, scope: head.scope ?? "SL+HL",
      banks: Object.keys(usedByBank).filter((bank) => sections.some((entry) => entry.banks.includes(bank))), sections,
    };
  };
  const topics = [];
  for (const unit of labels.filter((label) => label.level === "unit")) {
    topics.push(topic(unit, labels.filter((label) => label.level === "subtopic" && label.era === "2024" && label.parent_id === unit.id).map(section)));
  }
  const toolkit = labels.find((label) => label.level === "toolkit_group");
  if (toolkit?.label !== TOOLKIT_TOPIC.label || toolkit.id !== TOOLKIT_TOPIC.id) throw new Error("IB Business Management toolkit group drifted");
  topics.push(topic(toolkit, labels.filter((label) => label.level === "tool" && label.parent_id === toolkit.id).map(section)));
  topics.push(topic(
    { id: EARLIER_TOPIC.id, label: EARLIER_TOPIC.label, era: "2016", scope: "SL+HL" },
    labels.filter((label) => label.level === "subtopic" && label.era === "2016").map(section),
  ));
  const sectionCount = topics.reduce((sum, entry) => sum + entry.sections.length, 0);
  if (sectionCount !== 37 + 15 + 5 || topics.length !== 7) throw new Error("IB Business Management taxonomy shape drifted");
  return {
    artifact: "ib_business_management_student_taxonomy",
    version: "ib_business_management_source_backed_taxonomy@1",
    boardcode: "IB Business Management",
    note: "Units 1 to 5 (2024 guide subtopics) come first in teaching order, then the business management toolkit (one section per tool, a filter only), then the earlier-syllabus filters. A bank's picker shows only the sections that carry at least one of its questions.",
    sourceTaxonomyPath: "data/taxonomy/labels.json",
    sourceTaxonomySHA256: SOURCE_SHA256.taxonomy,
    topics,
  };
}

const stimulusKey = (stimulusId, asset) => {
  const match = new RegExp(`^assets/stimuli/${stimulusId}/(s-p\\d+-\\d+\\.webp)$`).exec(asset.path);
  if (!match) throw new Error(`Unexpected IB Business Management stimulus asset path: ${asset.path}`);
  return `stimuli/${stimulusId}/${match[1]}`;
};
const markbandKey = (markbandId, asset) => {
  const paperId = markbandId.replace(/-markbands$/, "");
  const match = new RegExp(`^assets/${paperId}/markbands/(mb-p\\d+-\\d+\\.webp)$`).exec(asset.path);
  if (!match) throw new Error(`Unexpected IB Business Management markband asset path: ${asset.path}`);
  return `markbands/${markbandId}/${match[1]}`;
};
const ownKey = (kind, paperId, asset) => {
  const match = new RegExp(`^assets/${paperId}/${kind}/(q\\d+-p\\d+-\\d+\\.webp)$`).exec(asset.path);
  if (!match) throw new Error(`Unexpected IB Business Management ${kind} asset path: ${asset.path}`);
  return `${kind}/${paperId}/${match[1]}`;
};

function toQuestion(bank, question, context) {
  const { paper, label, sections, stimulus, markband, droppedCrops, provenance } = context;
  const codes = [label.primary, ...label.secondaries];
  const tools = label.toolkit;
  if (new Set([...codes, ...tools]).size !== codes.length + tools.length) throw new Error(`IB Business Management ${question.id} repeats a label`);
  const resolve = (code) => {
    const hit = sections.get(code);
    if (!hit) throw new Error(`IB Business Management ${question.id} uses unknown section ${code}`);
    return hit;
  };
  const resolved = codes.map(resolve);
  const resolvedTools = tools.map(resolve);
  if (resolvedTools.some((hit) => hit.topic.id !== TOOLKIT_TOPIC.id) || resolved.some((hit) => hit.topic.id === TOOLKIT_TOPIC.id)) throw new Error(`IB Business Management ${question.id}: a tool is never a primary or secondary topic`);
  if (label.marks !== question.marks) throw new Error(`IB Business Management ${question.id} label marks ${label.marks} != ${question.marks}`);
  if (!(question.marks > 0)) throw new Error(`IB Business Management ${question.id} has no positive printed marks`);
  if (JSON.stringify([...label.banks].sort()) !== JSON.stringify([...question.serves_banks].sort())) throw new Error(`IB Business Management ${question.id} label banks disagree with the segmentation`);
  const month = { may: "May", nov: "November" }[question.month];
  if (!month) throw new Error(`Unknown IB Business Management session: ${question.month}`);
  if (!(question.paper === 1 || question.paper === 2 || question.paper === 3)) throw new Error(`IB Business Management ${question.id} paper ${question.paper}`);
  if (question.paper === 3 && bank !== "ib-business-management-hl") throw new Error(`IB Business Management ${question.id}: Paper 3 is HL only`);
  if (!(paper.printed_max > 0)) throw new Error(`IB Business Management ${paper.paper_id} has no printed total`);

  const own = question.question_images.map((asset) => ownKey("questions", question.paper_id, asset));
  const ownHashes = question.question_images.map((asset) => asset.sha256);
  const ms = question.markscheme_images.map((asset) => ownKey("markschemes", question.paper_id, asset));
  const msHashes = question.markscheme_images.map((asset) => asset.sha256);
  if (!own.length || !ms.length) throw new Error(`IB Business Management ${question.id} is missing crops`);
  const stimulusImages = stimulus ? stimulus.images.map((asset) => stimulusKey(stimulus.stimulus_id, asset)) : [];
  const stimulusHashes = stimulus ? stimulus.images.map((asset) => asset.sha256) : [];
  if (Boolean(question.stimulus_id) !== Boolean(stimulus)) throw new Error(`IB Business Management ${question.id} stimulus reference drifted`);
  if (stimulus && !stimulus.used_by.includes(question.id)) throw new Error(`IB Business Management ${question.id} is not listed as a user of ${stimulus.stimulus_id}`);
  if (markband && !markband.used_by.includes(question.id)) throw new Error(`IB Business Management ${question.id} is not listed as a user of ${markband.markband_id}`);
  if (Boolean(question.markband_id) !== Boolean(markband)) throw new Error(`IB Business Management ${question.id} markband reference drifted`);
  // Only the markband pages this question's scheme points to: 1-based, strictly ascending positions into the paper's set.
  let keptBand = [];
  if (markband) {
    const positions = question.markband_positions;
    if (!Array.isArray(positions) || !positions.length) throw new Error(`IB Business Management ${question.id} has a markband set but no markband_positions`);
    if (positions.some((position, index) => !Number.isInteger(position) || position < 1 || position > markband.images.length || (index > 0 && position <= positions[index - 1]))) throw new Error(`IB Business Management ${question.id} markband_positions ${JSON.stringify(positions)} are not ascending 1-based positions within ${markband.images.length}`);
    keptBand = positions.map((position) => markband.images[position - 1]).filter((asset) => !droppedCrops.has(`${markband.markband_id}:${asset.sha256}`));
    if (!keptBand.length) throw new Error(`IB Business Management ${question.id} markband reference drifted`);
  } else if (question.markband_positions !== undefined && question.markband_positions !== null && question.markband_positions.length) {
    throw new Error(`IB Business Management ${question.id} has markband_positions without a markband set`);
  }
  if (stimulus && (typeof stimulus.accessible_text !== "string" || !stimulus.accessible_text.trim())) throw new Error(`IB Business Management ${stimulus.stimulus_id} has no accessible_text`);
  const bandImages = keptBand.map((asset) => markbandKey(markband.markband_id, asset));
  const bandHashes = keptBand.map((asset) => asset.sha256);

  const questionImages = [...stimulusImages, ...own];
  const markschemeImages = [...ms, ...bandImages];
  const questionImageHashes = [...stimulusHashes, ...ownHashes];
  const markschemeImageHashes = [...msHashes, ...bandHashes];

  const [primary] = resolved;
  const topicOrder = [primary, ...resolved.slice(1)].map((hit) => hit.topic);
  const secondaryTopics = [...new Map(topicOrder.slice(1).filter((topic) => topic.id !== primary.topic.id).map((topic) => [topic.id, topic])).values()];
  if (resolvedTools.length && !secondaryTopics.some((topic) => topic.id === TOOLKIT_TOPIC.id)) secondaryTopics.push({ id: TOOLKIT_TOPIC.id, label: TOOLKIT_TOPIC.label });
  const subtopics = [...new Set([...resolved, ...resolvedTools].map((hit) => hit.section.label))];
  return {
    id: question.id,
    canonicalId: question.id,
    bankSlug: bank,
    paperId: question.paper_id,
    number: question.number,
    paper: question.paper,
    year: question.year,
    session: month,
    zone: `TZ${question.tz}`,
    timezone: `TZ${question.tz}`,
    level: BANKS[bank].level,
    component: `P${question.paper}`,
    courseEra: question.guide === "old" ? "2016" : "2024",
    era: question.guide === "old" ? "2016" : "2024",
    subject: "Business Management",
    course: BANKS[bank].course,
    primaryTopic: primary.topic.label,
    primaryTopicId: primary.topic.id,
    secondaryTopics: secondaryTopics.map((topic) => topic.label),
    secondaryTopicIds: secondaryTopics.map((topic) => topic.id),
    subtopics,
    detailedSubtopics: subtopics,
    secondarySubtopics: subtopics.slice(1),
    skills: [],
    assessmentObjectives: [],
    syllabusScope: label.hl_only ? "HL" : null,
    marks: question.marks,
    maxMarks: paper.printed_max,
    marksSource: "printed_question_paper",
    summary: question.text.slice(0, 220),
    // A question with a case or resources carries them as text, after its own text; the summary stays the question alone.
    accessibleText: stimulus ? `${question.text}\n\n${question.paper === 3 ? "Resources:" : "Case study:"}\n${stimulus.accessible_text.trim()}` : question.text,
    ...(stimulus ? { stimulusId: stimulus.stimulus_id, stimulusImageCount: stimulusImages.length, stimulusKey: sha256(stimulusHashes.join("\n")).slice(0, 16) } : {}),
    ...(markband ? { markbandId: markband.markband_id } : {}),
    questionImages,
    markschemeImages,
    questionImageHashes,
    markschemeImageHashes,
    officialMarkscheme: { images: markschemeImages, imageHashes: markschemeImageHashes },
    officialCodeRefs: [...codes, ...tools],
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
      toolkitCodes: tools,
      hlBasis: label.hl_basis,
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
  const segmentation = await pinned(sourceRoot, "data/segmentation/full/questions.json", SOURCE_SHA256.questions);
  const stimuliFile = await pinned(sourceRoot, "data/segmentation/full/stimuli.json", SOURCE_SHA256.stimuli);
  const markbandsFile = await pinned(sourceRoot, "data/segmentation/full/markbands.json", SOURCE_SHA256.markbands);
  const papersFile = await pinned(sourceRoot, "data/segmentation/full/papers.json", SOURCE_SHA256.papers);
  const finalLabels = await pinned(sourceRoot, "data/classification/final-labels.json", SOURCE_SHA256.labels);
  const sourceTaxonomy = { labels: await pinned(sourceRoot, "data/taxonomy/labels.json", SOURCE_SHA256.taxonomy) };
  await pinned(sourceRoot, "data/taxonomy/paper-filters.json", SOURCE_SHA256.paperFilters);
  const acquisition = await pinned(sourceRoot, "data/acquisition-manifest.json", SOURCE_SHA256.acquisitionManifest);

  const questions = segmentation.questions;
  if (questions.length !== EXPECTED.sourceQuestions || new Set(questions.map((question) => question.id)).size !== EXPECTED.sourceQuestions) throw new Error(`IB Business Management source has ${questions.length} questions`);
  if (papersFile.papers.length !== EXPECTED.papers || papersFile.failures.length) throw new Error("IB Business Management papers drifted");
  if (papersFile.held.length !== 1 || papersFile.held[0].paper_id !== HELD_PAPER_ID) throw new Error("IB Business Management held papers drifted");
  if (questions.some((question) => question.paper_id === HELD_PAPER_ID)) throw new Error("The held paper's questions must not appear");
  if (finalLabels.labels.length !== EXPECTED.sourceQuestions || new Set(finalLabels.labels.map((label) => label.id)).size !== EXPECTED.sourceQuestions) throw new Error("IB Business Management labels do not cover the source questions once each");
  const labels = new Map(finalLabels.labels.map((label) => [label.id, label]));
  const papers = new Map(papersFile.papers.map((paper) => [paper.paper_id, paper]));
  const stimuli = new Map(stimuliFile.stimuli.map((entry) => [entry.stimulus_id, entry]));
  const markbands = new Map(markbandsFile.markbands.map((entry) => [entry.markband_id, entry]));
  if (stimuli.size !== EXPECTED.stimuli || markbands.size !== EXPECTED.markbands) throw new Error("IB Business Management shared sets drifted");
  for (const entry of markbands.values()) if (entry.markband_id !== `${entry.paper_id}-markbands`) throw new Error(`Markband id ${entry.markband_id} is not its paper's`);

  // Section C markband crops: every pinned pair must exist, and no other markband may carry the same crop bytes.
  const droppedCrops = new Set(SECTION_C_MARKBAND_CROPS.map(([id, sha]) => `${id}:${sha}`));
  if (droppedCrops.size !== SECTION_C_MARKBAND_CROPS.length) throw new Error("Section C crop list repeats a crop");
  const dropped = [];
  for (const entry of markbands.values()) {
    for (const asset of entry.images) {
      if (droppedCrops.has(`${entry.markband_id}:${asset.sha256}`)) dropped.push({ markband: entry.markband_id, position: asset.position, sha256: asset.sha256 });
    }
  }
  if (dropped.length !== SECTION_C_MARKBAND_CROPS.length) throw new Error(`Section C crops found ${dropped.length} != pinned ${SECTION_C_MARKBAND_CROPS.length}`);
  for (const entry of markbands.values()) {
    for (const asset of entry.images) {
      if (dropped.some((crop) => crop.sha256 === asset.sha256 && !(crop.markband === entry.markband_id && crop.position === asset.position))) throw new Error(`A kept markband crop shares bytes with a Section C crop: ${asset.path}`);
    }
  }

  // Every source URL must be one of the kept, identity-checked files.
  const acquired = new Map(acquisition.papers.filter((paper) => paper.status === "complete").map((paper) => [paper.id, paper]));
  const sourceUrls = (paperId) => {
    const paper = papers.get(paperId);
    const entry = acquired.get(paper?.source_id);
    if (!entry || entry.qp?.identity !== "pass" || entry.ms?.identity !== "pass" || !entry.qp.url || !entry.ms.url) throw new Error(`IB Business Management ${paperId} is not a kept, identity-checked source pair`);
    if (entry.qp.sha256 !== paper.qp_sha256 || entry.ms.sha256 !== paper.ms_sha256) throw new Error(`IB Business Management ${paperId} source hashes disagree with the acquisition manifest`);
    return { question: entry.qp.url, markscheme: entry.ms.url };
  };

  // Section index (id -> section and topic), and the sections each bank's questions carry.
  const draft = studentTaxonomy(sourceTaxonomy, Object.fromEntries(Object.keys(BANKS).map((bank) => [bank, new Set()])));
  const sections = new Map(draft.topics.flatMap((topic) => topic.sections.map((section) => [section.id, { topic, section }])));
  const usedByBank = Object.fromEntries(Object.keys(BANKS).map((bank) => [bank, new Set()]));
  const bankOf = (level) => Object.keys(BANKS).find((slug) => BANKS[slug].level === level);
  for (const question of questions) {
    const label = labels.get(question.id);
    if (!label) throw new Error(`IB Business Management ${question.id} has no final label`);
    if (!question.serves_banks.length || question.serves_banks.some((level) => !bankOf(level))) throw new Error(`IB Business Management ${question.id} serves ${question.serves_banks}`);
    for (const level of question.serves_banks) for (const code of [label.primary, ...label.secondaries, ...label.toolkit]) usedByBank[bankOf(level)].add(code);
  }
  const taxonomy = studentTaxonomy(sourceTaxonomy, usedByBank);
  const taxonomySerialized = `${JSON.stringify(taxonomy, null, 2)}\n`;
  const taxonomyFileSha = sha256(taxonomySerialized);

  const built = {};
  for (const [bank, config] of Object.entries(BANKS)) {
    const rows = [];
    for (const question of questions) {
      if (!question.serves_banks.includes(config.level)) continue;
      const paper = papers.get(question.paper_id);
      if (!paper) throw new Error(`IB Business Management ${question.id} has no paper ${question.paper_id}`);
      rows.push(toQuestion(bank, question, {
        paper,
        label: labels.get(question.id),
        sections,
        stimulus: question.stimulus_id ? stimuli.get(question.stimulus_id) : null,
        markband: question.markband_id ? markbands.get(question.markband_id) : null,
        droppedCrops,
        provenance: sourceUrls(question.paper_id),
      }));
    }
    if (rows.length !== config.rows) throw new Error(`${bank} rows ${rows.length} != ${config.rows}`);
    if (new Set(rows.map((row) => row.id)).size !== rows.length) throw new Error(`${bank} question ids are not unique`);
    const paperIds = new Set(rows.map((row) => row.paperId));
    if (paperIds.size !== config.papers) throw new Error(`${bank} papers ${paperIds.size} != ${config.papers}`);
    const years = rows.map((row) => row.year);
    const yearRange = `${Math.min(...years)}-${Math.max(...years)}`;
    if (yearRange !== EXPECTED.years) throw new Error(`${bank} years ${yearRange}`);
    const shown = new Set(rows.flatMap((row) => row.officialCodeRefs));
    if (shown.size !== EXPECTED.sections[config.level]) throw new Error(`${bank} shows ${shown.size} sections`);

    const artifact = {
      version: `${bank}-full${rows.length}-v1`,
      releaseStatus: CANDIDATE_PUBLICATION_STATUS,
      rightsStatus: RIGHTS_STATUS,
      sourceType: "actual_past_paper",
      specimenQuestionsIncluded: false,
      liveOnlyUnderReleaseGate: true,
      years: yearRange,
      paperCount: paperIds.size,
      questionCount: rows.length,
      marks_ready: true,
      sourceCandidate: {
        paths: ["data/classification/final-labels.json"],
        sha256: [SOURCE_SHA256.labels],
        questionCount: rows.length,
      },
      taxonomy: { path: TAXONOMY_OUTPUT, version: taxonomy.version, sha256: taxonomyFileSha },
      questions: rows,
      publicationStatus: CANDIDATE_PUBLICATION_STATUS,
      assetVerification: "pending_upload",
      runtimeArtifact: {
        schemaVersion: "igcse-production-runtime-v1",
        sourceRepository: "ib-business-management-topic-practice",
        sourceCommit: SOURCE_COMMIT,
        sourceSha256: SOURCE_SHA256,
        sectionCMarkbandCrops: { count: dropped.length, sha256: sha256(SECTION_C_MARKBAND_CROPS.map(([id, sha]) => `${id}:${sha}`).join("\n")) },
        sourceCandidateSha256: null,
        releaseTaxonomySha256: taxonomyFileSha,
        runtimeTaxonomySha256: sha256(JSON.stringify(taxonomy)),
        publicationStatus: CANDIDATE_PUBLICATION_STATUS,
        rightsStatus: RIGHTS_STATUS,
        assetVerification: "pending_upload",
        assetManifestSha256: null,
        storageReceiptSha256: null,
        contentSha256: sha256(JSON.stringify(rows)),
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
        status: "PASS", bank, rows: rows.length, papers: paperIds.size, years: yearRange, sectionsShown: shown.size,
        runtimeAssetRefs: new Set(rows.flatMap((row) => [...row.questionImages, ...row.markschemeImages])).size,
      },
    };
  }
  return { banks: built, taxonomy, taxonomySerialized, sectionCCrops: dropped, sourceRoot };
}

/** Local-only check: every referenced crop exists under the source workspace and has the SHA-256 the segmentation recorded. */
export async function verifyCropFiles(built, sourceRoot) {
  const segmentation = JSON.parse(await readFile(path.join(sourceRoot, "data/segmentation/full/questions.json"), "utf8"));
  const stimuli = JSON.parse(await readFile(path.join(sourceRoot, "data/segmentation/full/stimuli.json"), "utf8"));
  const markbands = JSON.parse(await readFile(path.join(sourceRoot, "data/segmentation/full/markbands.json"), "utf8"));
  const assets = [
    ...segmentation.questions.flatMap((question) => [...question.question_images, ...question.markscheme_images]),
    ...stimuli.stimuli.flatMap((entry) => entry.images),
    ...markbands.markbands.flatMap((entry) => entry.images),
  ];
  const seen = new Set();
  let checked = 0;
  for (const asset of assets) {
    if (seen.has(asset.path)) continue;
    seen.add(asset.path);
    const file = path.join(sourceRoot, "data/segmentation/full", asset.path);
    await access(file);
    if (sha256(await readFile(file)) !== asset.sha256) throw new Error(`Crop ${asset.path} does not match its recorded SHA-256`);
    checked += 1;
  }
  return checked;
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

export async function writeRuntimes({ repo = path.resolve(import.meta.dirname, ".."), sourceRoot = sourceRootPath(), verifyCrops = true } = {}) {
  const built = await buildRuntimes({ sourceRoot });
  const cropsChecked = verifyCrops ? await verifyCropFiles(built, sourceRoot) : null;
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
  return { ...built, banks: results, cropsChecked };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const result = await writeRuntimes({ verifyCrops: !process.argv.includes("--skip-crop-files") });
  console.log(JSON.stringify({
    banks: Object.values(result.banks).map((bank) => ({ ...bank.report, seals: bank.seals, output: bank.output })),
    cropFilesVerified: result.cropsChecked,
    sectionCMarkbandCropsDropped: result.sectionCCrops,
  }, null, 2));
}
