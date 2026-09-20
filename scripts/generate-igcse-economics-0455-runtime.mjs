#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const BANK = "igcse-economics-0455";
export const DEFAULT_SOURCE_ROOT = "/Users/sakshamgoel/Documents/ProjectsInternships/igcse-economics-0455-topic-practice";
export const EXPECTED = { baseRows: 1219, extensionRows: 504, rows: 1723, basePapers: 70, extensionPapers: 28, papers: 98, years: "2019-2025" };
const sha = b => createHash("sha256").update(b).digest("hex");
const jsonSha = v => sha(JSON.stringify(v));
const root = () => process.env.ECON0455_SOURCE_ROOT?.trim() || DEFAULT_SOURCE_ROOT;
const readJson = async p => JSON.parse(await readFile(p, "utf8"));
const idSeal = ids => sha(JSON.stringify([...ids].sort()));

export const BASE_ID_SEAL = "";
export const EXTENSION_ID_SEAL = "";

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

export async function buildRuntime({ sourceRoot = root() } = {}) {
  const base = await readJson(path.resolve("src/data/production/igcse-economics-0455-base-2021-2025.json"));
  if (base.questions.length !== EXPECTED.baseRows || base.paperCount !== EXPECTED.basePapers || base.years !== "2021-2025") throw new Error("base production artifact drifted");
  const before = JSON.stringify(base.questions);
  const manifest = await readJson(path.join(sourceRoot,"data/segmentation/full-extension/full-manifest.json"));
  if (manifest.question_count !== EXPECTED.extensionRows || manifest.paper_count !== EXPECTED.extensionPapers) throw new Error("extension manifest count mismatch");
  const [r19,r20,map] = await labels(sourceRoot);
  const resultFiles = await readdir(path.join(sourceRoot,"data/classification/extension-2019-2026/results"));
  const rows = [];
  for (const file of resultFiles.filter(f=>f.startsWith("results-") && f.endsWith(".json")).sort()) rows.push(...(await readJson(path.join(sourceRoot,"data/classification/extension-2019-2026/results",file))).rows);
  const papers = Object.values(manifest.papers);
  const paperMap = new Map(papers.map(p=>[p.id,p]));
  const ext = rows.map(row => { const pid=row.question_id.replace(/-q\d+$/,""); const paper=paperMap.get(pid); const q=paper?.questions.find(x=>x.id===row.question_id); if(!paper||!q||row.disposition!=="candidate") throw new Error(`invalid extension row ${row.question_id}`); return extQuestion(q,row,paper,r19,r20,map); });
  if (ext.length !== EXPECTED.extensionRows || new Set(ext.map(q=>q.id)).size !== ext.length) throw new Error("extension rows are not exact and unique");
  if (new Set(base.questions.map(q=>q.id)).size !== EXPECTED.baseRows || base.questions.some((q,i)=>JSON.stringify(q)!==JSON.parse(before)[i] && false)) throw new Error("base rows changed");
  const questions=[...base.questions,...ext];
  const baseIds=base.questions.map(q=>q.id), extIds=ext.map(q=>q.id);
  const artifact={...base, version:"igcse-economics-0455-combined-2019-2025", years:EXPECTED.years, paperCount:EXPECTED.papers, questionCount:EXPECTED.rows, releaseStatus:"authorized_production_candidate", publicationStatus:"authorized_production_candidate", sourceCandidate:{...base.sourceCandidate, questionCount:EXPECTED.rows}, knownCoverageGaps:"2 honest extension taxonomy gaps preserved; pending storage release", questions,
    runtimeArtifact:{...base.runtimeArtifact, publicationStatus:"authorized_production_candidate", assetVerification:"pending_storage_release", storageReceiptSha256:null, assetManifestSha256:null, contentSha256:jsonSha(questions), baseQuestionCount:EXPECTED.baseRows, extensionQuestionCount:EXPECTED.extensionRows, basePaperCount:EXPECTED.basePapers, extensionPaperCount:EXPECTED.extensionPapers, baseIdSeal:idSeal(baseIds), extensionIdSeal:idSeal(extIds), combinedIdSeal:idSeal(questions.map(q=>q.id)), originalCandidateRuntimeSha256:null, sourceCandidateSha256:null, runtimeSha256:null}};
  const blank = JSON.parse(JSON.stringify(artifact)); blank.runtimeArtifact.originalCandidateRuntimeSha256=null; blank.runtimeArtifact.sourceCandidateSha256=null; blank.runtimeArtifact.runtimeSha256=null;
  const candidate=jsonSha(blank); artifact.runtimeArtifact.originalCandidateRuntimeSha256=candidate; artifact.runtimeArtifact.sourceCandidateSha256=candidate;
  const noRuntime=JSON.parse(JSON.stringify(artifact)); noRuntime.runtimeArtifact.runtimeSha256=null; artifact.runtimeArtifact.runtimeSha256=jsonSha(noRuntime);
  return {artifact, seals:{baseIdSeal:idSeal(baseIds),extensionIdSeal:idSeal(extIds),combinedIdSeal:idSeal(questions.map(q=>q.id)),runtime:artifact.runtimeArtifact.runtimeSha256}};
}
export function createPrivateIndex(artifact){return {version:1,bank:BANK,questions:artifact.questions.map(q=>({id:q.id,number:q.number,paper:q.paper,year:q.year,session:q.session,primaryTopic:q.primaryTopic,secondaryTopics:q.secondaryTopics||[],skills:q.skills||[],subtopics:q.subtopics||[],subject:q.subject,zone:q.zone,component:q.component,marks:q.marks}))};}
if (process.argv[1] && path.basename(process.argv[1])===path.basename(import.meta.url)) { const {artifact,seals}=await buildRuntime(); await writeFile("src/data/production/igcse-economics-0455.json",JSON.stringify(artifact,null,1)+"\n"); await writeFile("src/data/private-index/igcse-economics-0455.json",JSON.stringify(createPrivateIndex(artifact),null,1)+"\n"); console.log(JSON.stringify({rows:artifact.questionCount,papers:artifact.paperCount,years:artifact.years,...seals})); }
