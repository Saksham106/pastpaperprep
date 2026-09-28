#!/usr/bin/env node
/** Chemistry 0620 QP-printed marks-only descendant; immutable asset ancestry. */
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runtimeSha256, sha256 } from "./igcse-release.mjs";
const BANK="igcse-chemistry-0620";
const BASE="5e6abbe33cb1a0d23f5148f39824390ed58312dd";
const OVERLAY_SHA="9577f31ce0b93cc12cdfef1a66dfa41028e9d397535c3dbcce9a37db608137e2";
const DECISION_SHA="8c40431012ed16750ac5218aa163fd8b5fddb6283ad46d33d6d330946dce85ce";
const ASSET_MANIFEST="2b7c46666ece8f3d9bb57a50e3dfe7389a993432656b5215b12d782409fed43b";
const STORAGE_RECEIPT="935f8c574bd1ef4e7fd1760a13fdec3ce31503144185070df0c76603a225b357";
const fail=(message)=>{throw new Error(`0620 marks repair: ${message}`)};
const assert=(condition,message)=>{if(!condition)fail(message)};
const hash=(value)=>sha256(JSON.stringify(value));
export function reseal0620Marks({baseline,index,overlay,decision}) {
 assert(decision?.schemaVersion==="chemistry-0620-qp-source-decision-v1" && decision.decision==="apply_exact_printed_question_total" && hash(decision)===DECISION_SHA,"source decision missing or changed");
 assert(decision.sourceOverlaySha256===OVERLAY_SHA && decision.baselineGitCommit===BASE && decision.targetIdsSha256===overlay.targetIdsSha256,"source decision ancestry mismatch");
 assert(decision.ms_comparison.paperCount===23 && decision.ms_comparison.extracted_question_totals_match_qp_in_papers===15 && decision.ms_comparison.parser_or_publisher_disagreements_requiring_attention.length===8,"MS comparison disclosure drift");
 assert(overlay.schemaVersion==="igcse-chemistry-0620-marks-overlay-v1" && overlay.apply===false,"overlay schema/apply drift");
 assert(hash(overlay)===OVERLAY_SHA,"pinned QP overlay changed");
 assert(overlay.baseline.questionCount===5129 && hash(baseline)===overlay.baseline.productionSha256,"pinned production baseline drift");
 assert(hash(index)===overlay.baseline.privateIndexSha256,"pinned private index baseline drift");
 assert(baseline.runtimeArtifact.runtimeSha256===runtimeSha256(baseline),"baseline runtime self-seal drift");
 assert(baseline.runtimeArtifact.finalizedContentSha256===hash(baseline.questions),"baseline finalized content drift");
 assert(baseline.runtimeArtifact.assetManifestSha256===ASSET_MANIFEST && baseline.runtimeArtifact.storageReceiptSha256===STORAGE_RECEIPT,"storage ancestry changed");
 assert(baseline.questions.length===5129 && index.questions.length===5129 && baseline.releaseStatus==="production" && baseline.assetVerification==="verified_readback","not the finalized cohort");
 const sortedIds=overlay.targets.map(x=>x.question_id).sort();
 assert(sortedIds.length===90 && new Set(sortedIds).size===90 && hash(sortedIds)===overlay.targetIdsSha256,"90-row target set drift");
 const papers=new Map(overlay.papers.map(x=>[x.paper_id,x]));
 assert(papers.size===23 && [...papers.values()].every(x=>x.source_total===x.expected_total && [40,80].includes(x.expected_total)),"printed paper maximum failed");
 const oldById=new Map(baseline.questions.map(x=>[x.id,x]));
 assert(oldById.size===5129 && new Set(index.questions.map(x=>x.id)).size===5129,"duplicate bank IDs");
 const nullIds=baseline.questions.filter(x=>x.marks==null || x.maxMarks==null).map(x=>x.id).sort();
 assert(nullIds.length===74 && JSON.stringify(nullIds)===JSON.stringify(overlay.targets.filter(x=>x.issue==="missing").map(x=>x.question_id).sort()),"exact null-mark coverage failed");
 assert(overlay.targets.filter(x=>x.issue==="stored_disagrees_with_print").length===16,"nonnull mismatch count drift");
 const targets=new Map();
 for(const row of overlay.targets){
  const old=oldById.get(row.question_id),paper=papers.get(row.paper_id);
  assert(old && paper && row.question_id===`${row.paper_id}-q${row.number}` && old.number===row.number,"question source identity mismatch");
  assert(old.marks===row.stored_marks && old.maxMarks===row.stored_marks,"stored marks drift: "+row.question_id);
  assert(Number.isInteger(row.proposed_marks) && row.proposed_marks>0 && row.proposed_marks<=80 && row.proposed_marks!==row.stored_marks,"invalid printed total: "+row.question_id);
  assert(row.qp_sha256===paper.qp_sha256 && row.ms_sha256===paper.ms_sha256 && Number.isInteger(row.qp_page) && row.qp_page>=row.anchor_page && row.anchor_page>0,"source PDF binding drift: "+row.question_id);
  assert(row.kind==="printed_[Total]" ? new RegExp(`^\\[\\s*Total\\s*:\\s*${row.proposed_marks}\\s*\\]$`).test(row.bracket_excerpt) : row.kind==="printed_planning_[6]" && row.proposed_marks===6,"printed bracket evidence drift: "+row.question_id);
  targets.set(row.question_id,row);
 }
 assert(decision.independent_qp_spot_checks.length===5 && decision.independent_qp_spot_checks.every(x=>{
  const row=targets.get(x.questionId);return row && row.qp_page===x.qpPage && row.proposed_marks===x.printedMarks;
 }),"independent QP spot-check binding mismatch");
 const runtime=structuredClone(baseline),privateIndex=structuredClone(index);
 let changed=0;
 for(const question of runtime.questions){const target=targets.get(question.id);if(!target)continue;
  question.marks=target.proposed_marks;question.maxMarks=target.proposed_marks;changed++;
 }
 assert(changed===90 && runtime.questions.every(x=>Number.isInteger(x.marks) && x.marks>0 && x.maxMarks===x.marks),"not all totals repaired");
 let indexed=0;
 for(const question of privateIndex.questions){const target=targets.get(question.id);if(!target)continue;
  assert(question.marks===target.stored_marks,"private index baseline mismatch: "+question.id);
  question.marks=target.proposed_marks;indexed++;
 }
 assert(indexed===90 && privateIndex.questions.every(x=>Number.isInteger(x.marks) && x.marks>0),"private index not fully repaired");
 runtime.runtimeArtifact.chemistryMarksRepair={baselineGitCommit:BASE,baselineRuntimeSha256:baseline.runtimeArtifact.runtimeSha256,baselineFinalizedContentSha256:baseline.runtimeArtifact.finalizedContentSha256,overlaySha256:OVERLAY_SHA,sourceDecisionSha256:DECISION_SHA,targetIdsSha256:overlay.targetIdsSha256,changedCount:90,filledNullCount:74,correctedNonNullCount:16,method:"printed QP question-anchor and per-paper maximum; QP primary; MS comparison disclosed in pinned decision; no asset or classification changes"};
 runtime.runtimeArtifact.finalizedContentSha256=hash(runtime.questions);
 runtime.runtimeArtifact.runtimeSha256=null;
 runtime.runtimeArtifact.runtimeSha256=runtimeSha256(runtime);
 return {runtime,privateIndex};
}
async function main(){
 const mode=process.argv[2];assert(mode==="--write" || mode==="--check","explicit --check or --write required");
 const root=path.resolve(import.meta.dirname,"..");
 const get=(file)=>JSON.parse(execFileSync("git",["show",`${BASE}:${file}`],{cwd:root,maxBuffer:100_000_000}).toString("utf8"));
 const overlay=JSON.parse(await readFile(path.join(root,"data/classification/marks-repair/igcse-chemistry-0620-overlay-v1.json"),"utf8"));
 const decision=JSON.parse(await readFile(path.join(root,"scripts/data/0620-marks-qp-source-decision.json"),"utf8"));
 const {runtime,privateIndex}=reseal0620Marks({baseline:get(`src/data/production/${BANK}.json`),index:get(`src/data/private-index/${BANK}.json`),overlay,decision});
 const runtimePath=path.join(root,`src/data/production/${BANK}.json`),indexPath=path.join(root,`src/data/private-index/${BANK}.json`);
 if(mode==="--check"){
  assert(await readFile(runtimePath,"utf8")===`${JSON.stringify(runtime)}\n`,"runtime differs from exact replay");
  assert(await readFile(indexPath,"utf8")===`${JSON.stringify(privateIndex)}\n`,"index differs from exact replay");
 }else{
  await writeFile(runtimePath,`${JSON.stringify(runtime)}\n`);
  await writeFile(indexPath,`${JSON.stringify(privateIndex)}\n`);
 }
 console.log(JSON.stringify({mode,changed:90,untouched:5039,filled:74,corrected:16,finalizedContentSha256:runtime.runtimeArtifact.finalizedContentSha256,runtimeSha256:runtime.runtimeArtifact.runtimeSha256}));
}
if(process.argv[1] && path.resolve(process.argv[1])===path.resolve(fileURLToPath(import.meta.url)))main().catch(error=>{console.error(error.message);process.exitCode=1});
