import{describe,test,expect}from'vitest';
import{existsSync,readFileSync}from'node:fs';
import{execFileSync}from'node:child_process';
import{createHash}from'node:crypto';
import{reviewedMarkschemePaths}from'@/lib/reviewed-mcq-answer-repairs';
import{loadBankQuestions}from'@/lib/question-loader';
import{metadataFromRaw}from'../../scripts/generate-bank-index.mjs';
import type{BankSlug}from'@/lib/banks';
import loaded from'@/data/reviewed-ib-maths-ms-row-repairs.json';
// docs/ib-maths-ms-row-repairs.md
const overlay=JSON.parse(readFileSync('src/data/reviewed-ib-maths-ms-row-repairs.json','utf8'));
type Entry={oldPaths:string[];oldSha256:string[];newPaths:string[];sha256:string[]};
const banks=overlay.banks as Record<'ib-hl'|'ib-ai-hl',Record<string,Entry>>;
const manifestBytes=readFileSync('data/storage/ib-maths-ms-row-repairs.manifest.json');const manifest=JSON.parse(manifestBytes.toString());
const receiptFile='data/storage/ib-maths-ms-row-repairs.receipt.json';
const research='/Users/sakshamgoel/Documents/ProjectsInternships/research/ib-maths-ms-row-repair-20261024';
const answers=(q:{markschemeImages?:string[];officialMarkscheme?:{images?:string[]}})=>[...(q.markschemeImages??[]),...(q.officialMarkscheme?.images??[])];
describe('reviewed IB maths mark-scheme row repairs',()=>{
 test('exact cohort: two questions per paper; one manifest object per new crop',()=>{
  expect(Object.keys(banks)).toEqual(['ib-hl','ib-ai-hl']);
  expect(Object.keys(banks['ib-hl'])).toEqual(['2021-may-tz1-p1-q1','2021-may-tz1-p1-q2']);
  expect(Object.keys(banks['ib-ai-hl'])).toEqual(['2024-may-tz1-p3-q1','2024-may-tz1-p3-q2']);
  const fresh=Object.entries(banks).flatMap(([bank,entries])=>Object.values(entries).flatMap(e=>e.newPaths.filter(p=>p.startsWith(overlay.namespace+'/')).map(p=>`${bank}/${p}`)));
  expect(manifest.objects.map((o:{objectKey:string})=>o.objectKey)).toEqual(fresh.sort());
  expect([manifest.answerReplacementCount,manifest.objectCount]).toEqual([4,5]);
 });
 test('each answer gains or loses only the misassigned rows',()=>{
  // ib-hl: each one-image answer is replaced by the right part of page 8.
  for(const e of Object.values(banks['ib-hl'])){expect(e.oldPaths).toHaveLength(1);expect(e.newPaths).toHaveLength(1);expect(e.newPaths[0]).not.toBe(e.oldPaths[0]);}
  const{'2024-may-tz1-p3-q1':q1,'2024-may-tz1-p3-q2':q2}=banks['ib-ai-hl'];
  // AI HL Q1 keeps pages 7-9 and now runs to the end of page 11; Q2 starts on page 12 and keeps pages 13-14.
  expect(q1.newPaths.slice(0,3)).toEqual(q1.oldPaths.slice(0,3));expect(q1.sha256.slice(0,3)).toEqual(q1.oldSha256.slice(0,3));expect(q1.newPaths).toHaveLength(5);
  expect(q2.newPaths.slice(1)).toEqual(q2.oldPaths.slice(3));expect(q2.sha256.slice(1)).toEqual(q2.oldSha256.slice(3));expect(q2.newPaths).toHaveLength(3);
 });
 test('no question is also in a sealed IB overlay',()=>{
  const boundary=JSON.parse(readFileSync('src/data/reviewed-ib-boundary-batch-repairs.json','utf8')).banks['ib-hl'];
  const matrix=JSON.parse(readFileSync('src/data/reviewed-ib-matrix-head-repairs.json','utf8')).entries;
  for(const id of Object.keys(banks['ib-hl']))expect(boundary[id]).toBeUndefined();
  for(const id of Object.keys(banks['ib-ai-hl']))expect(matrix[id]).toBeUndefined();
 });
 test.skipIf(!existsSync(receiptFile))('sealed remote receipt binds every immutable object and the exact manifest',()=>{
  const receipt=JSON.parse(readFileSync(receiptFile,'utf8'));
  expect([receipt.state,receipt.bucket,receipt.objectCount]).toEqual(['verified_readback','pastpaperprep-assets',5]);
  expect(receipt.manifestSha256).toBe(createHash('sha256').update(manifestBytes).digest('hex'));
  expect(receipt.records.map(({objectKey,sha256,bytes}:{objectKey:string;sha256:string;bytes:number})=>({objectKey,sha256,bytes}))).toEqual(manifest.objects);
 });
 test('every mapping is activated by the actual IB loader; everything else unchanged',async()=>{
  for(const bank of ['ib-hl','ib-ai-hl'] as const){
   const raw=JSON.parse(readFileSync(`src/data/raw/${bank}.json`,'utf8')).questions;const before=JSON.stringify(raw);
   const after=new Map((await loadBankQuestions(bank)).map(q=>[q.id,q]));
   for(const [qid,entry]of Object.entries(banks[bank])){
    const q=raw.find((x:{id:string})=>x.id===qid);
    expect(answers(q)).toEqual(entry.oldPaths);
    expect(reviewedMarkschemePaths(bank,qid,entry.oldPaths)).toEqual(entry.newPaths);
    expect(after.get(qid)?.markschemeAssetPaths).toEqual(entry.newPaths.map(p=>`${bank}/${p}`));
    expect(after.get(qid)?.markschemeImageCount).toBe(entry.newPaths.length);
    expect(metadataFromRaw(q,{bank}).markschemeImageCount).toBe(entry.newPaths.length);
   }
   for(const q of after.values())if(!banks[bank][q.id])expect(q.markschemeAssetPaths.some(p=>p.includes('/ib-maths-ms-rows-v1-'))).toBe(false);
   expect(JSON.stringify(raw)).toBe(before);
  }
 });
 test('stale old paths and a tampered hash fail closed; other banks untouched',()=>{
  const [qid,entry]=Object.entries(banks['ib-ai-hl'])[0];
  expect(()=>reviewedMarkschemePaths('ib-ai-hl',qid,entry.oldPaths.slice(1))).toThrow(/disagrees/);
  // The runtime reads the imported module, so tamper with that copy.
  const live=(loaded.banks['ib-ai-hl'] as Record<string,Entry>)[qid];const saved=live.oldSha256[0];live.oldSha256[0]='0'.repeat(64);
  try{expect(()=>reviewedMarkschemePaths('ib-ai-hl',qid,entry.oldPaths)).toThrow(/disagrees/);}finally{live.oldSha256[0]=saved;}
  for(const other of ['ib-sl','ib-ai-sl'] as BankSlug[])expect(reviewedMarkschemePaths(other,qid,entry.oldPaths)).toEqual(entry.oldPaths);
 });
 test.skipIf(!existsSync(research))('builder is reproducible from the research package',()=>{
  execFileSync('node',['scripts/build-ib-maths-ms-row-repairs.mjs',research,'--check'],{stdio:'pipe'});
 });
});
