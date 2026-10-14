#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const BANK = "igcse-economics-0455";
export const DEFAULT_SOURCE_ROOT = "/Users/sakshamgoel/Documents/ProjectsInternships/igcse-economics-0455-topic-practice";
export const EXPECTED = { baseRows: 1219, extensionRows: 504, rows: 1723, basePapers: 70, extensionPapers: 28, papers: 98, years: "2019-2025", extensionQuestionAssets: 528, extensionMarkschemeAssets: 654 };
export const SOURCE_RECONCILIATION_RECEIPT = "data/segmentation/full-extension/reconciliation-receipt.json";
export const SOURCE_RECONCILIATION_RECEIPT_SHA256 = "2647220c5e1571aaf2b62a69dd2c6741df904f38bc1104d66cb62807284bf020";
const sha = b => createHash("sha256").update(b).digest("hex");
const jsonSha = v => sha(JSON.stringify(v));
const root = () => process.env.ECON0455_SOURCE_ROOT?.trim() || DEFAULT_SOURCE_ROOT;
const readJson = async p => JSON.parse(await readFile(p, "utf8"));
const idSeal = ids => sha(JSON.stringify([...ids].sort()));

export const BASE_ID_SEAL = "8a7dd6c1985e4fd2f083b6ec882a75aeccbf31944d24bf9bbf002f7f335ac461";
export const EXTENSION_ID_SEAL = "b3c844c1255ec9d1eff2f6fc2664f3c758d40ca6061fe1a5425cc298bc662d6c";

function labels(sourceRoot) { return Promise.all([
  readJson(path.join(sourceRoot, "research/extension-2019-2026/registry-2017-2019.json")),
  readJson(path.join(sourceRoot, "research/extension-2019-2026/registry-2020-2022-extended.json")),
  readJson(path.join(sourceRoot, "research/extension-2019-2026/section-to-modern-topic-mapping.json")),
]); }
function topicFor(code, map) {
  const section = code.match(/:S(\d+\.\d+):/)?.[1];
  if (section) return map.mappings.find(x => x.section === section)?.modern_topics?.[0] || null;
  return `topic-${code.split(".")[0]}`;
}
function labelFor(code, era, r19, r20) {
  if (era === "2017_2019") return Object.values(r19.sections).flatMap(s => s.bullets).find(x => x.id === code)?.text || null;
  return r20.codes[code] || null;
}
function extQuestion(q, row, paper, r19, r20, map) {
  const era = row.era; const primary = row.primary;
  const secondaries = row.secondary || [];
  const labels = [primary, ...secondaries].filter(Boolean).map(c => labelFor(c, era, r19, r20)).filter(Boolean);
  const parts = q.parts || [];
  const accessible = [q.text, ...parts.map(p => p.text)].filter(Boolean).join("\n\n") + (q.answer ? `\n\nOfficial answer: ${q.answer}` : "");
  const qimgs = q.images.map(a => `questions/${paper.id}/${path.basename(a.path)}`);
  const mimgs = q.mark_scheme_images.map(a => `markschemes/${paper.id}/${path.basename(a.path)}`);
  const topicId = topicFor(primary || secondaries[0] || "", map);
  const topicName = map.modern_topics[topicId] || topicId;
  return {
    id:q.id, canonicalId:q.id, bankSlug:BANK, number:q.number, paper:paper.paper_number, year:paper.year,
    session:paper.session === "march_india" ? "March" : paper.session === "november" ? "November" : "June",
    zone: paper.component_variant ? `Variant ${paper.component_variant}` : "", component:`P${paper.paper_number}`,
    courseEra:era, era, subject:"Economics", course:"Cambridge IGCSE Economics 0455", primaryTopic:topicName, primaryTopicId:topicId,
    secondaryTopics:[...new Set(secondaries.map(c => map.modern_topics[topicFor(c, map)] || topicFor(c,map)))], secondaryTopicIds:[...new Set(secondaries.map(c=>topicFor(c,map)))],
    subtopics:labels, detailedSubtopics:labels, secondarySubtopics:labels.slice(1), skills:[], assessmentObjectives:row.ao || [], marks:row.marks?.total ?? q.marks,
    maxMarks:paper.paper_maximum_mark, summary:(q.text || accessible).slice(0,220), accessibleText:accessible, questionImages:qimgs, markschemeImages:mimgs,
    questionImageHashes:q.images.map(a=>a.sha256), markschemeImageHashes:q.mark_scheme_images.map(a=>a.sha256), officialMarkscheme:{images:mimgs,imageHashes:q.mark_scheme_images.map(a=>a.sha256)},
    officialCodes:[primary,...secondaries].filter(Boolean).map(code=>({official_code:code,era,normalized_detail_id:code})), sourceQuestionUrl:paper.question_paper?.canonical_exact_url,
    sourceMarkSchemeUrl:paper.mark_scheme?.canonical_exact_url, sourceType:"actual_past_paper", sourceId:q.id, publicationStatus:"authorized_production_candidate",
    classificationVersion:"economics0455_extension_2019_2020", classificationReviewStatus:"source_paired_review_completed_pending_release", classificationConfidence:null,
    classificationProvenance:{candidatePath:"data/classification/extension-2019-2026/results", candidateSHA256:null, selectedSource:"validated-extension-results", taxonomyPath:"research/extension-2019-2026/registry-2017-2019.json", taxonomySHA256:null},
    rightsStatus:"user_attested_private_acquisition_publication_blocked"
  };
}

/**
 * Historical builder: reproduces the original 1,723-row 2019-2025 candidate (original candidate
 * runtime SHA-256 629eb2cd…). That candidate was finalized and then corrected in place (Jev,
 * #62), so it is no longer the live runtime; the 2026 addition below starts from the finalized
 * live file instead. Kept so the historical seal stays reproducible (`--check-historical`).
 */
export async function buildRuntime({ sourceRoot = root() } = {}) {
  const base = await readJson(path.resolve("src/data/production/igcse-economics-0455-base-2021-2025.json"));
  if (base.questions.length !== EXPECTED.baseRows || base.paperCount !== EXPECTED.basePapers || base.years !== "2021-2025") throw new Error("base production artifact drifted");
  const before = JSON.stringify(base.questions);
  const beforeQuestions = JSON.parse(before);
  const manifest = await readJson(path.join(sourceRoot,"data/segmentation/full-extension/full-manifest.json"));
  const reconciliationPath = path.join(sourceRoot, SOURCE_RECONCILIATION_RECEIPT);
  const reconciliationBytes = await readFile(reconciliationPath);
  if (sha(reconciliationBytes) !== SOURCE_RECONCILIATION_RECEIPT_SHA256) throw new Error("source reconciliation receipt SHA256 mismatch");
  const reconciliation = JSON.parse(reconciliationBytes);
  if (reconciliation.assertions?.qp_ms_reference_mismatches_0 !== true || reconciliation.counts?.qp_refs_new !== EXPECTED.extensionQuestionAssets || reconciliation.counts?.ms_refs_new !== EXPECTED.extensionMarkschemeAssets) throw new Error("source reconciliation receipt assertions drifted");
  if (manifest.question_count !== EXPECTED.extensionRows || manifest.paper_count !== EXPECTED.extensionPapers) throw new Error("extension manifest count mismatch");
  const [r19,r20,map] = await labels(sourceRoot);
  const resultFiles = await readdir(path.join(sourceRoot,"data/classification/extension-2019-2026/results"));
  const rows = [];
  for (const file of resultFiles.filter(f=>f.startsWith("results-") && f.endsWith(".json")).sort()) rows.push(...(await readJson(path.join(sourceRoot,"data/classification/extension-2019-2026/results",file))).rows);
  const papers = Object.values(manifest.papers);
  const paperMap = new Map(papers.map(p=>[p.id,p]));
  const ext = rows.map(row => { const pid=row.question_id.replace(/-q\d+$/,""); const paper=paperMap.get(pid); const q=paper?.questions.find(x=>x.id===row.question_id); if(!paper||!q||row.disposition!=="candidate") throw new Error(`invalid extension row ${row.question_id}`); return extQuestion(q,row,paper,r19,r20,map); });
  if (ext.length !== EXPECTED.extensionRows || new Set(ext.map(q=>q.id)).size !== ext.length) throw new Error("extension rows are not exact and unique");
  if (JSON.stringify(base.questions) !== JSON.stringify(beforeQuestions)) throw new Error("base rows changed");
  const removedRefs = new Set(reconciliation.mappings.filter(x => x.status === "removed").map(x => x.old_path?.replace(/^assets\//, "")).filter(Boolean));
  const extensionQuestionRefs = new Set(ext.flatMap(q => q.questionImages));
  const extensionMarkschemeRefs = new Set(ext.flatMap(q => q.markschemeImages));
  if (extensionQuestionRefs.size !== EXPECTED.extensionQuestionAssets || extensionMarkschemeRefs.size !== EXPECTED.extensionMarkschemeAssets) throw new Error("extension asset counts are not exact");
  if ([...extensionQuestionRefs, ...extensionMarkschemeRefs].some(ref => removedRefs.has(ref.split('/').slice(1).join('/')))) throw new Error("removed blank/furniture-only asset referenced");
  if (new Set(base.questions.map(q=>q.id)).size !== EXPECTED.baseRows) throw new Error("base IDs are not exact");
  const questions=[...base.questions,...ext];
  const baseIds=base.questions.map(q=>q.id), extIds=ext.map(q=>q.id);
  const artifact={...base, version:"igcse-economics-0455-combined-2019-2025", years:EXPECTED.years, paperCount:EXPECTED.papers, questionCount:EXPECTED.rows, releaseStatus:"authorized_production_candidate", publicationStatus:"authorized_production_candidate", sourceCandidate:{...base.sourceCandidate, questionCount:EXPECTED.rows}, knownCoverageGaps:"2 honest extension taxonomy gaps preserved; pending storage release", questions,
    runtimeArtifact:{...base.runtimeArtifact, publicationStatus:"authorized_production_candidate", assetVerification:"pending_storage_release", storageState:"pending_upload", storageReceiptSha256:null, assetManifestSha256:null, contentSha256:jsonSha(questions), sourceReconciliationReceiptSha256:SOURCE_RECONCILIATION_RECEIPT_SHA256, baseQuestionCount:EXPECTED.baseRows, extensionQuestionCount:EXPECTED.extensionRows, basePaperCount:EXPECTED.basePapers, extensionPaperCount:EXPECTED.extensionPapers, baseIdSeal:idSeal(baseIds), extensionIdSeal:idSeal(extIds), combinedIdSeal:idSeal(questions.map(q=>q.id)), originalCandidateRuntimeSha256:null, sourceCandidateSha256:null, runtimeSha256:null}};
  const blank = JSON.parse(JSON.stringify(artifact)); blank.runtimeArtifact.originalCandidateRuntimeSha256=null; blank.runtimeArtifact.sourceCandidateSha256=null; blank.runtimeArtifact.runtimeSha256=null;
  const candidate=jsonSha(blank); artifact.runtimeArtifact.originalCandidateRuntimeSha256=candidate; artifact.runtimeArtifact.sourceCandidateSha256=candidate;
  const noRuntime=JSON.parse(JSON.stringify(artifact)); noRuntime.runtimeArtifact.runtimeSha256=null; artifact.runtimeArtifact.runtimeSha256=jsonSha(noRuntime);
  return {artifact, seals:{baseIdSeal:idSeal(baseIds),extensionIdSeal:idSeal(extIds),combinedIdSeal:idSeal(questions.map(q=>q.id)),runtime:artifact.runtimeArtifact.runtimeSha256}};
}
export function createPrivateIndex(artifact){return {version:1,bank:BANK,questions:artifact.questions.map(q=>({id:q.id,number:q.number,paper:q.paper,year:q.year,session:q.session,primaryTopic:q.primaryTopic,secondaryTopics:q.secondaryTopics||[],skills:q.skills||[],subtopics:q.subtopics||[],subject:q.subject,zone:q.zone,component:q.component,marks:q.marks}))};}

// ---------------------------------------------------------------------------------------------
// 2026 addition: 8 papers / 139 practice rows appended to the finalized 2019-2025 release.
// ---------------------------------------------------------------------------------------------

/** The finalized, Jev-corrected 1,723-row runtime served on main before the 2026 addition. */
export const BASELINE_2019_2025 = {
  gitBlob: "4c9bb0b7f1bcb09722315c479fcc34bffcde9092",
  fileSha256: "a606ac577df40e5f2ffbd2303f4743360d71f895467dd0ff4dcc26031146d29e",
  runtimeSha256: "585200ac5b182b6f968f35a849905447643a3f772c21d27ddc9321bb9f125487",
  originalCandidateRuntimeSha256: "629eb2cd4ae77ad6fd7cade9b89380b0a8b41a45f42548dab822ce3f0aabcf81",
  finalizedContentSha256: "1ebc313836458e69546b20cc87bdc05459154d36bfab3445d02a9b9eebbc2efd",
  assetManifestSha256: "173200cb011b2bef8c8be84e6007c747423cd026d35db9fd16a409f6101d15b4",
  storageReceiptSha256: "87a51ab5e425b8a5da04a5c468593ed686f6c0e5ec746211a687a50b4366993c",
  combinedIdSeal: "06fcf13e34fd181089a910bb15c789cc7de4b73f4e9a53147e078856a3c90b30",
  questionCount: 1723,
  paperCount: 98,
};
export const LANE_2026 = {
  manifest: "data/segmentation/full-extension-2026/full-manifest.json",
  laneRoot: "data/segmentation/full-extension-2026",
  receipt: "data/segmentation/full-extension-2026/reconciliation-receipt.json",
  receiptSha256: "1a2f1de492284a43301ac5407117cdcc636a692909e27691ce731f50e497a587",
  results: "data/classification/extension-2026/results",
  resultFiles: ["results-ext26-mcq-01.json", "results-ext26-mcq-02.json", "results-ext26-mcq-03.json", "results-ext26-mcq-04.json", "results-ext26-struct-01.json", "results-ext26-struct-02.json"],
  registry: "research/extension-2026/registry-2023-2025-extended.json",
  eraDecision: "research/extension-2026/era-decision-2026.json",
  sourceBranch: "feat/2026-acquisition",
  sourceCommitAtBuild: "0b7c8e33c5438ed58a8439a78da80d630133ccaa",
  segmentedRows: 140,
  rows: 139,
  papers: 8,
  questionAssets: 143,
  markschemeAssets: 205,
  /** sha256(JSON.stringify(sorted ids)) — the runtime ID-seal formula. */
  idSeal: "cae509582a634bbc1376899aab8d4d4deb93992ae4a1cf24df3d79040ab5388a",
  /** sha256(sorted ids joined by "\n") — the release-script cohort formula. */
  idsSha256: "93ba2b6eb04395ec68970e707d6901f419ae2adc43381ca061c5c0b8142ccbaf",
  /** Official removals: segmented and audited, never served. */
  excluded: { "0455-2026-s-11-q26": "Cambridge removed this question from the paper (printed key cell: removed, mark 0)" },
};
export const EXPECTED_2026 = { rows: 1862, papers: 106, years: "2019-2026" };
export const CLASSIFICATION_VERSION_2026 = "economics0455_extension_2026";
export const CANDIDATE_REVIEW_STATUS = "source_paired_review_completed_pending_release";

const fileSha = async p => sha(await readFile(p));

/** Load the finalized 1,723-row baseline from Git (or an explicit file) and prove it is the sealed release. */
export async function loadBaseline({ baselinePath } = {}) {
  const bytes = baselinePath
    ? await readFile(baselinePath)
    : execFileSync("git", ["cat-file", "blob", BASELINE_2019_2025.gitBlob], { maxBuffer: 64 * 1024 * 1024 });
  if (sha(bytes) !== BASELINE_2019_2025.fileSha256) throw new Error("baseline runtime file SHA256 mismatch");
  const baseline = JSON.parse(bytes.toString("utf8"));
  const ra = baseline.runtimeArtifact;
  const unsealed = JSON.parse(JSON.stringify(baseline)); unsealed.runtimeArtifact.runtimeSha256 = null;
  if (ra.runtimeSha256 !== BASELINE_2019_2025.runtimeSha256 || jsonSha(unsealed) !== ra.runtimeSha256) throw new Error("baseline runtime self-seal mismatch");
  if (ra.originalCandidateRuntimeSha256 !== BASELINE_2019_2025.originalCandidateRuntimeSha256) throw new Error("baseline original candidate seal mismatch");
  if (jsonSha(baseline.questions) !== BASELINE_2019_2025.finalizedContentSha256 || ra.finalizedContentSha256 !== BASELINE_2019_2025.finalizedContentSha256) throw new Error("baseline finalized content mismatch");
  if (ra.assetManifestSha256 !== BASELINE_2019_2025.assetManifestSha256 || ra.storageReceiptSha256 !== BASELINE_2019_2025.storageReceiptSha256) throw new Error("baseline storage seals mismatch");
  if (baseline.releaseStatus !== "production" || ra.assetVerification !== "verified_readback") throw new Error("baseline is not the finalized release");
  if (baseline.questions.length !== BASELINE_2019_2025.questionCount || baseline.paperCount !== BASELINE_2019_2025.paperCount) throw new Error("baseline counts drifted");
  if (idSeal(baseline.questions.map(q => q.id)) !== BASELINE_2019_2025.combinedIdSeal || ra.combinedIdSeal !== BASELINE_2019_2025.combinedIdSeal) throw new Error("baseline ID seal mismatch");
  if (idSeal(baseline.questions.filter(q => q.year >= 2021).map(q => q.id)) !== BASE_ID_SEAL || idSeal(baseline.questions.filter(q => q.year <= 2020).map(q => q.id)) !== EXTENSION_ID_SEAL) throw new Error("baseline cohort seals mismatch");
  if (baseline.questions.some(q => q.publicationStatus !== "production" || q.classificationReviewStatus !== "classified" || q.year > 2025)) throw new Error("baseline rows are not all finalized 2019-2025 rows");
  return baseline;
}

function lane2026Question(q, row, paper, registry, map, provenance) {
  const era = row.era; const primary = row.primary;
  const secondaries = row.secondary || [];
  const labelOf = code => { const label = registry.codes[code]; if (!label) throw new Error(`2026 code ${code} missing from the 2026 registry (${q.id})`); return label; };
  const labels = [primary, ...secondaries].map(labelOf);
  const parts = q.parts || [];
  const accessible = [q.text, ...parts.map(p => p.text)].filter(Boolean).join("\n\n") + (q.answer ? `\n\nOfficial answer: ${q.answer}` : "");
  const qimgs = q.images.map(a => `questions/${paper.id}/${path.basename(a.path)}`);
  const mimgs = q.mark_scheme_images.map(a => `markschemes/${paper.id}/${path.basename(a.path)}`);
  const topicId = topicFor(primary, map);
  const topicName = map.modern_topics[topicId];
  if (!topicName) throw new Error(`2026 primary topic unresolved for ${q.id}`);
  return {
    id:q.id, canonicalId:q.id, bankSlug:BANK, number:q.number, paper:paper.paper_number, year:paper.year,
    session:paper.session === "march_india" ? "March" : paper.session === "june" ? "June" : (() => { throw new Error(`unexpected 2026 session ${paper.session}`); })(),
    zone:`Variant ${String(paper.component).slice(-1)}`, component:`P${paper.paper_number}`,
    courseEra:era, era, subject:"Economics", course:"Cambridge IGCSE Economics 0455", primaryTopic:topicName, primaryTopicId:topicId,
    secondaryTopics:[...new Set(secondaries.map(c => map.modern_topics[topicFor(c, map)] || topicFor(c,map)))], secondaryTopicIds:[...new Set(secondaries.map(c=>topicFor(c,map)))],
    subtopics:labels, detailedSubtopics:labels, secondarySubtopics:labels.slice(1), skills:[], assessmentObjectives:row.ao, marks:row.marks.total,
    maxMarks:paper.paper_maximum_mark, summary:(q.text || accessible).slice(0,220), accessibleText:accessible, questionImages:qimgs, markschemeImages:mimgs,
    questionImageHashes:q.images.map(a=>a.sha256), markschemeImageHashes:q.mark_scheme_images.map(a=>a.sha256), officialMarkscheme:{images:mimgs,imageHashes:q.mark_scheme_images.map(a=>a.sha256)},
    officialCodes:[primary,...secondaries].map(code=>({official_code:code,era,normalized_detail_id:code})),
    sourceType:"actual_past_paper", sourceId:q.id, publicationStatus:"authorized_production_candidate",
    classificationVersion:CLASSIFICATION_VERSION_2026, classificationReviewStatus:CANDIDATE_REVIEW_STATUS, classificationConfidence:row.confidence,
    classificationProvenance:{candidatePath:`${LANE_2026.results}/${provenance.resultFile}`, candidateSHA256:provenance.resultSha256, selectedSource:"validated-extension-2026-results", taxonomyPath:LANE_2026.registry, taxonomySHA256:provenance.registrySha256, confidenceBasis:row.confidence_basis},
    rightsStatus:"user_attested_private_acquisition_publication_blocked"
  };
}

/** Build the 139 2026 rows from the source lane, fail-closed on every pinned count, hash and removal. */
export async function build2026Rows({ sourceRoot = root() } = {}) {
  const at = rel => path.join(sourceRoot, rel);
  const receiptBytes = await readFile(at(LANE_2026.receipt));
  if (sha(receiptBytes) !== LANE_2026.receiptSha256) throw new Error("2026 reconciliation receipt SHA256 mismatch");
  const receipt = JSON.parse(receiptBytes);
  const a = receipt.assertions || {};
  if (!(a.ids_140 && a.papers_8 && a.qp_ms_reference_mismatches_0 && a.missing_extra_0 && a.no_blank_or_furniture_only_qp_crops && a.invalid_marks_0 && a.visual_qa_pass && a.clean_builds_byte_identical)
    || receipt.counts?.question_ids !== LANE_2026.segmentedRows || receipt.counts?.papers !== LANE_2026.papers || receipt.counts?.excluded_from_practice !== Object.keys(LANE_2026.excluded).length) throw new Error("2026 reconciliation receipt assertions drifted");
  const manifestBytes = await readFile(at(LANE_2026.manifest));
  const manifest = JSON.parse(manifestBytes);
  if (manifest.question_count !== LANE_2026.segmentedRows || manifest.paper_count !== LANE_2026.papers || manifest.foundation?.lane !== "extension-2026") throw new Error("2026 manifest count mismatch");
  const registryBytes = await readFile(at(LANE_2026.registry));
  const registry = JSON.parse(registryBytes);
  if (registry.era_id !== "2023_2025" || !registry.codes) throw new Error("2026 registry is not the 2023_2025 extended registry");
  const eraDecision = await readJson(at(LANE_2026.eraDecision));
  if (eraDecision.decision?.era_assignment?.["2026"] !== "2023_2025" || eraDecision.decision?.registry !== LANE_2026.registry) throw new Error("2026 era decision does not assign 2023_2025");
  const [, , map] = await labels(sourceRoot);
  const listed = (await readdir(at(LANE_2026.results))).filter(f => f.startsWith("results-") && f.endsWith(".json")).sort();
  if (JSON.stringify(listed) !== JSON.stringify(LANE_2026.resultFiles)) throw new Error("2026 results file set drifted");
  const resultsSha256 = {}; const rows = [];
  for (const file of LANE_2026.resultFiles) {
    const bytes = await readFile(at(`${LANE_2026.results}/${file}`));
    resultsSha256[file] = sha(bytes);
    for (const row of JSON.parse(bytes).rows) rows.push({ row, file });
  }
  const papers = Object.values(manifest.papers);
  const paperMap = new Map(papers.map(p => [p.id, p]));
  const manifestIds = papers.flatMap(p => p.questions.map(q => q.id));
  if (rows.length !== LANE_2026.segmentedRows || new Set(rows.map(r => r.row.question_id)).size !== rows.length
    || JSON.stringify(rows.map(r => r.row.question_id).sort()) !== JSON.stringify([...manifestIds].sort())) throw new Error("2026 results do not cover the manifest exactly once");
  const out = []; const excluded = [];
  for (const { row, file } of rows) {
    const pid = row.question_id.replace(/-q\d+$/, ""); const paper = paperMap.get(pid); const q = paper?.questions.find(x => x.id === row.question_id);
    if (!paper || !q || paper.year !== 2026 || row.era !== "2023_2025" || paper.era !== "2023_2025") throw new Error(`invalid 2026 row ${row.question_id}`);
    if (row.disposition === "excluded_from_practice") {
      if (!LANE_2026.excluded[row.question_id] || row.source_status !== "official_question_discounted" || q.disposition !== "excluded_from_practice"
        || q.mark_scheme_status !== "official_question_discounted" || row.primary !== null || row.marks?.total !== null || q.marks !== null) throw new Error(`unauthorized 2026 exclusion ${row.question_id}`);
      excluded.push(row.question_id); continue;
    }
    if (row.disposition !== "candidate" || LANE_2026.excluded[row.question_id] || q.disposition) throw new Error(`invalid 2026 disposition ${row.question_id}`);
    const expectedMarks = paper.paper_number === 1 ? 1 : q.number === 1 ? 30 : 20;
    if (row.marks?.total !== expectedMarks) throw new Error(`2026 marks mismatch ${row.question_id}`);
    if (!["high", "medium", "low"].includes(row.confidence) || !row.ao?.length || !row.primary) throw new Error(`2026 classification incomplete ${row.question_id}`);
    for (const asset of [...q.images, ...q.mark_scheme_images]) {
      const lanePath = path.join(at(LANE_2026.laneRoot), asset.path);
      if (await fileSha(lanePath) !== asset.sha256) throw new Error(`2026 asset SHA256 mismatch ${asset.path}`);
    }
    out.push(lane2026Question(q, row, paper, registry, map, { resultFile: file, resultSha256: resultsSha256[file], registrySha256: sha(registryBytes) }));
  }
  if (JSON.stringify(excluded.sort()) !== JSON.stringify(Object.keys(LANE_2026.excluded).sort())) throw new Error("2026 exclusions drifted");
  const removedRefs = new Set(receipt.mappings.filter(x => x.status === "removed").map(x => x.new_path ?? x.old_path));
  if (removedRefs.size) throw new Error("2026 lane unexpectedly removed crops");
  const qRefs = new Set(out.flatMap(q => q.questionImages)); const mRefs = new Set(out.flatMap(q => q.markschemeImages));
  if (out.length !== LANE_2026.rows || qRefs.size !== LANE_2026.questionAssets || mRefs.size !== LANE_2026.markschemeAssets) throw new Error("2026 row or asset counts are not exact");
  if (new Set(out.map(q => q.id.replace(/-q\d+$/, ""))).size !== LANE_2026.papers) throw new Error("2026 paper count is not exact");
  const ids = out.map(q => q.id);
  if (idSeal(ids) !== LANE_2026.idSeal || sha([...ids].sort().join("\n")) !== LANE_2026.idsSha256) throw new Error("2026 ID seal mismatch");
  for (const q of out) project2026Guard(q, map);
  return { rows: out, excluded, provenance: { manifestSha256: sha(manifestBytes), registrySha256: sha(registryBytes), eraDecisionSha256: await fileSha(at(LANE_2026.eraDecision)), resultsSha256 } };
}

function project2026Guard(q, map) {
  if (q.officialCodes.some(c => c.era !== "2023_2025" || topicFor(c.official_code, map) !== `topic-${c.official_code.split(".")[0]}`)) throw new Error(`2026 code era/topic guard failed ${q.id}`);
}

/** Pure insertion: the finalized baseline rows stay verbatim and in order; the 2026 rows are appended. */
export async function buildRuntime2026({ sourceRoot = root(), baselinePath } = {}) {
  const baseline = await loadBaseline({ baselinePath });
  const before = baseline.questions.map(q => JSON.stringify(q));
  const { rows, excluded, provenance } = await build2026Rows({ sourceRoot });
  if (rows.some(q => baseline.questions.some(b => b.id === q.id))) throw new Error("2026 rows collide with baseline IDs");
  const questions = [...baseline.questions, ...rows];
  if (questions.slice(0, before.length).some((q, i) => JSON.stringify(q) !== before[i])) throw new Error("baseline rows changed");
  if (jsonSha(questions.slice(0, before.length)) !== BASELINE_2019_2025.finalizedContentSha256) throw new Error("baseline content seal changed");
  const papers = new Set(questions.map(q => q.id.replace(/-q\d+$/, "")));
  if (questions.length !== EXPECTED_2026.rows || papers.size !== EXPECTED_2026.papers) throw new Error("combined 2019-2026 counts are not exact");
  const ra = baseline.runtimeArtifact;
  const artifact = {
    ...baseline,
    version: "igcse-economics-0455-combined-2019-2026", releaseStatus: "authorized_production_candidate", years: EXPECTED_2026.years,
    paperCount: EXPECTED_2026.papers, questionCount: EXPECTED_2026.rows, publicationStatus: "authorized_production_candidate", assetVerification: "pending_storage_release",
    knownCoverageGaps: `${baseline.knownCoverageGaps}; 2026: ${excluded.join(", ")} officially removed by Cambridge, excluded from practice; 2026 assets pending storage release`,
    questions,
    runtimeArtifact: {
      ...ra,
      publicationStatus: "authorized_production_candidate", assetVerification: "pending_storage_release", storageReceiptSha256: null, assetManifestSha256: null,
      contentSha256: jsonSha(questions), originalCandidateRuntimeSha256: null, sourceCandidateSha256: null, runtimeSha256: null, storageState: "pending_upload",
      combinedIdSeal: idSeal(questions.map(q => q.id)), finalizedContentSha256: null,
      extension2026: {
        method: "pure insertion: the finalized 2019-2025 runtime (baseline) is kept verbatim and in order; 2026 rows are appended",
        baselineGitBlob: BASELINE_2019_2025.gitBlob, baselineFileSha256: BASELINE_2019_2025.fileSha256, baselineRuntimeSha256: BASELINE_2019_2025.runtimeSha256,
        baselineOriginalCandidateRuntimeSha256: BASELINE_2019_2025.originalCandidateRuntimeSha256, baselineFinalizedContentSha256: BASELINE_2019_2025.finalizedContentSha256,
        baselineAssetManifestSha256: BASELINE_2019_2025.assetManifestSha256, baselineStorageReceiptSha256: BASELINE_2019_2025.storageReceiptSha256,
        baselineCombinedIdSeal: BASELINE_2019_2025.combinedIdSeal, baselineQuestionCount: BASELINE_2019_2025.questionCount, baselinePaperCount: BASELINE_2019_2025.paperCount,
        questionCount: LANE_2026.rows, paperCount: LANE_2026.papers, questionAssetCount: LANE_2026.questionAssets, markschemeAssetCount: LANE_2026.markschemeAssets,
        idSeal: LANE_2026.idSeal, idsSha256: LANE_2026.idsSha256, excludedFromPractice: excluded.map(id => ({ id, reason: LANE_2026.excluded[id] })),
        courseEra: "2023_2025", classificationVersion: CLASSIFICATION_VERSION_2026,
        sourceRepository: "igcse-economics-0455-topic-practice", sourceBranch: LANE_2026.sourceBranch, sourceCommitAtBuild: LANE_2026.sourceCommitAtBuild,
        sourceReconciliationReceiptSha256: LANE_2026.receiptSha256, sourceManifestSha256: provenance.manifestSha256, registrySha256: provenance.registrySha256,
        eraDecisionSha256: provenance.eraDecisionSha256, resultsSha256: provenance.resultsSha256,
      },
    },
  };
  const blank = JSON.parse(JSON.stringify(artifact));
  const candidate = jsonSha(blank); artifact.runtimeArtifact.originalCandidateRuntimeSha256 = candidate; artifact.runtimeArtifact.sourceCandidateSha256 = candidate;
  const noRuntime = JSON.parse(JSON.stringify(artifact)); noRuntime.runtimeArtifact.runtimeSha256 = null; artifact.runtimeArtifact.runtimeSha256 = jsonSha(noRuntime);
  return { artifact, baseline, seals: { lane2026IdSeal: LANE_2026.idSeal, combinedIdSeal: artifact.runtimeArtifact.combinedIdSeal, candidate, runtime: artifact.runtimeArtifact.runtimeSha256, contentSha256: artifact.runtimeArtifact.contentSha256 } };
}

/** Finalized runtimes are written minified, so the baseline rows keep their exact serialized bytes. */
export function serializeRuntime(artifact) { return `${JSON.stringify(artifact)}\n`; }
export function serializePrivateIndex(artifact) { return `${JSON.stringify(createPrivateIndex(artifact), null, 1)}\n`; }

if (process.argv[1] && path.basename(process.argv[1]) === path.basename(import.meta.url)) {
  if (process.argv.includes("--check-historical")) {
    const { artifact } = await buildRuntime();
    if (artifact.runtimeArtifact.originalCandidateRuntimeSha256 !== BASELINE_2019_2025.originalCandidateRuntimeSha256) throw new Error("historical 2019-2025 candidate no longer reproduces");
    console.log(JSON.stringify({ historicalCandidate: artifact.runtimeArtifact.originalCandidateRuntimeSha256, rows: artifact.questionCount }));
  } else {
    const baselineArg = process.argv.indexOf("--baseline");
    const { artifact, seals } = await buildRuntime2026({ baselinePath: baselineArg > 0 ? process.argv[baselineArg + 1] : undefined });
    const outputs = [["src/data/production/igcse-economics-0455.json", serializeRuntime(artifact)], ["src/data/private-index/igcse-economics-0455.json", serializePrivateIndex(artifact)]];
    if (process.argv.includes("--check")) {
      // Once finalized, the committed runtime is checked as finalizeRelease(candidate): compare the exact reconstruction.
      const { committedCandidateText } = await import("./igcse-2026-release-finalization.mjs");
      const committed = [await committedCandidateText(BANK), await readFile(outputs[1][0], "utf8")];
      outputs.forEach(([file, text], i) => { if (committed[i] !== text) throw new Error(`${file} is not the regenerated 2026 candidate`); });
    } else {
      for (const [file, text] of outputs) await writeFile(file, text);
    }
    console.log(JSON.stringify({ rows: artifact.questionCount, papers: artifact.paperCount, years: artifact.years, ...seals }));
  }
}
