import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { reseal0620Marks } from "./reseal-0620-marks.mjs";
import { runtimeSha256, sha256 } from "./igcse-release.mjs";
const root=path.resolve(process.cwd());
const BASE="5e6abbe33cb1a0d23f5148f39824390ed58312dd";
const pinned=p=>JSON.parse(execFileSync("git",["show",`${BASE}:${p}`],{cwd:root,maxBuffer:100_000_000}).toString("utf8"));
const json=async p=>JSON.parse(await readFile(path.join(root,p),"utf8"));
const BANK="igcse-chemistry-0620";
const inputs=async()=>({baseline:pinned(`src/data/production/${BANK}.json`),index:pinned(`src/data/private-index/${BANK}.json`),overlay:await json("data/classification/marks-repair/igcse-chemistry-0620-overlay-v1.json"),decision:await json("scripts/data/0620-marks-qp-source-decision.json")});
describe("Chemistry 0620 printed-QP marks-only descendant",()=>{
 it("repairs exact 74 null and 16 wrong totals; preserves all other fields and 5,039 other rows",async()=>{
  const input=await inputs();const {baseline,index,overlay}=input;const {runtime,privateIndex}=reseal0620Marks(input);
  const affected=new Set(overlay.targets.map(x=>x.question_id));expect(affected.size).toBe(90);
  expect(runtime.questions.length).toBe(5129);expect(runtime.marks_ready).toBe(true);
  expect(runtime.questions.filter(x=>x.marks==null || x.maxMarks==null)).toHaveLength(0);
  expect(runtime.runtimeArtifact.assetManifestSha256).toBe(baseline.runtimeArtifact.assetManifestSha256);
  expect(runtime.runtimeArtifact.storageReceiptSha256).toBe(baseline.runtimeArtifact.storageReceiptSha256);
  expect(runtime.runtimeArtifact.contentSha256).toBe(baseline.runtimeArtifact.contentSha256);
  expect(runtime.runtimeArtifact.chemistryOtherRetrievalRepair).toEqual(baseline.runtimeArtifact.chemistryOtherRetrievalRepair);
  expect(runtime.runtimeArtifact.finalizedContentSha256).toBe(sha256(JSON.stringify(runtime.questions)));
  expect(runtime.runtimeArtifact.runtimeSha256).toBe(runtimeSha256(runtime));
  let changed=0;for(let n=0;n<baseline.questions.length;n++){
   const before=baseline.questions[n],after=runtime.questions[n];expect(after.id).toBe(before.id);
   if(!affected.has(before.id)){expect(after).toEqual(before);continue;}
   changed++;const target=overlay.targets.find(x=>x.question_id===before.id);
   expect({...after,marks:before.marks,maxMarks:before.maxMarks}).toEqual(before);
   expect(after.marks).toBe(target.proposed_marks);expect(after.maxMarks).toBe(target.proposed_marks);
  }expect(changed).toBe(90);
  const o=new Map(runtime.questions.map(q=>[q.id,q]));
  for(let n=0;n<index.questions.length;n++){
   const before=index.questions[n],after=privateIndex.questions[n];expect(after.id).toBe(before.id);
   expect({...after,marks:before.marks}).toEqual(before);
   expect(after.marks).toBe(o.get(after.id).marks);
   if(!affected.has(after.id))expect(after).toEqual(before);
  }
 });
 it("requires checked-in runtime and private index to equal pinned replay",async()=>{
  const generated=reseal0620Marks(await inputs());
  const actualRuntime=await json(`src/data/production/${BANK}.json`);
  const actualIndex=await json(`src/data/private-index/${BANK}.json`);
  expect(actualRuntime).toEqual(generated.runtime);
  expect(actualIndex).toEqual(generated.privateIndex);
 });
 it("is deterministic and refuses stale source or extra targets",async()=>{
  const x=await inputs(),a=reseal0620Marks(x),again=reseal0620Marks(x);
  expect(JSON.stringify(a)).toBe(JSON.stringify(again));
  expect(()=>reseal0620Marks({...x,baseline:{...x.baseline,questionCount:0}})).toThrow();
  expect(()=>reseal0620Marks({...x,overlay:{...x.overlay,targets:[...x.overlay.targets,{...x.overlay.targets[0],question_id:'foreign'}]}})).toThrow();
  expect(()=>reseal0620Marks({...x,decision:{...x.decision,decision:'ignore_print'}})).toThrow(/source decision/);
  expect(()=>reseal0620Marks({...x,overlay:{...x.overlay,targets:x.overlay.targets.map((t,i)=>i===0?{...t,proposed_marks:99}:t)}})).toThrow();
 });
});
