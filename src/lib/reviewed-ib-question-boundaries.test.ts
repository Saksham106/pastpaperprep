import{describe,test,expect}from'vitest';
import{existsSync,readFileSync}from'node:fs';
import{execFileSync}from'node:child_process';
import{createHash}from'node:crypto';
import{reviewedIbBoundaryMarks,reviewedIbBoundaryPaths}from'@/lib/reviewed-ib-question-boundaries';
import{loadBankQuestions}from'@/lib/question-loader';
import type{BankSlug}from'@/lib/banks';
import{metadataFromRaw}from'../../scripts/generate-bank-index.mjs';
const overlay=JSON.parse(readFileSync('src/data/reviewed-ib-question-boundary-repairs.json','utf8'));
type Entry={oldPaths:string[];oldSha256:string[];newPaths:string[];sha256:string[];marks:{old:number;new:number}};
const manifestBytes=readFileSync('data/storage/ib-question-boundary-repairs.manifest.json');const manifest=JSON.parse(manifestBytes.toString());
const research='/Users/sakshamgoel/Documents/ProjectsInternships/research/ib-bio-hl-2024-p3-q1-repair';
const banks=overlay.banks as Record<BankSlug,Record<string,Entry>>;
const isNew=(p:string)=>p.startsWith(`${overlay.namespace}/`);
const key=(bank:string,p:string)=>`${bank}/${p.replace(/^https:\/\/saksham106\.github\.io\/ib-[a-z]+-topic-practice\//,'')}`;
const PAPERS={'ib-biology-hl':['2017-november-tz0-hl-p2','2017-november-tz0-hl-p3','2024-may-tz1-hl-p3'],'ib-biology-sl':['2017-november-tz0-sl-p3','2018-november-tz0-sl-p2']};
describe('reviewed IB question-boundary repairs',()=>{
 test('exact cohort: Q1 and Q2 of five Biology papers; one manifest object per new crop',()=>{
  for(const [bank,papers] of Object.entries(PAPERS))expect(Object.keys(banks[bank as BankSlug]).sort()).toEqual(papers.flatMap(p=>[`${p}-q1`,`${p}-q2`]).sort());
  const keys=[...new Set(Object.entries(banks).flatMap(([bank,e])=>Object.values(e).flatMap(x=>x.newPaths.filter(isNew).map(p=>`${bank}/${p}`))))].sort();
  expect(manifest.objects.map((o:{objectKey:string})=>o.objectKey)).toEqual(keys);
  expect([manifest.questionReplacementCount,manifest.objectCount]).toEqual([10,20]);
 });
 test('each pair keeps its total; the 2024 Paper 3 split is 5 and 5',()=>{
  for(const [bank,papers] of Object.entries(PAPERS))for(const p of papers){
   const [q1,q2]=[banks[bank as BankSlug][`${p}-q1`],banks[bank as BankSlug][`${p}-q2`]];
   expect(q1.marks.new+q2.marks.new).toBe(q1.marks.old+q2.marks.old);
  }
  expect(banks['ib-biology-hl']['2024-may-tz1-hl-p3-q1'].marks).toEqual({old:3,new:5});
  expect(banks['ib-biology-hl']['2024-may-tz1-hl-p3-q2'].marks).toEqual({old:7,new:5});
  for(const e of Object.values(banks).flatMap(b=>Object.values(b)))e.newPaths.forEach((p,i)=>{
   if(isNew(p))expect(p).toBe(`${overlay.namespace}/${e.sha256[i]}.webp`);
   else expect(e.sha256[i]).toBe(e.oldSha256[e.oldPaths.indexOf(p)]);
  });
 });
 test('sealed remote receipt binds every immutable object and the exact manifest',()=>{
  const receipt=JSON.parse(readFileSync('data/storage/ib-question-boundary-repairs.receipt.json','utf8'));
  expect(receipt.state).toBe('verified_readback');
  expect(receipt.manifestSha256).toBe(createHash('sha256').update(manifestBytes).digest('hex'));
  expect(receipt.records).toEqual(manifest.objects.map((o:{objectKey:string;sha256:string;bytes:number})=>({objectKey:o.objectKey,sha256:o.sha256,bytes:o.bytes,contentType:receipt.contentTypeObserved?'image/webp':null})));
 });
 test('the production loader and bank index serve the repaired crops and marks; nothing else moves',async()=>{
  for(const [bank,repairs] of Object.entries(banks) as [BankSlug,Record<string,Entry>][]){
   const raw=JSON.parse(readFileSync(`src/data/production/${bank}.json`,'utf8')).questions;const before=JSON.stringify(raw);
   const after=new Map((await loadBankQuestions(bank)).map(q=>[q.id,q]));
   for(const [qid,entry] of Object.entries(repairs)){
    const q=raw.find((x:{id:string})=>x.id===qid);
    expect(q.questionImages).toEqual(entry.oldPaths);
    expect(after.get(qid)?.questionAssetPaths).toEqual(entry.newPaths.map(p=>key(bank,p)));
    expect(after.get(qid)?.marks).toBe(entry.marks.new);
    expect(metadataFromRaw(q,{bank,normalizedProduction:true})).toMatchObject({questionImageCount:entry.newPaths.length,marks:entry.marks.new});
   }
   for(const q of after.values())if(!repairs[q.id])expect(q.questionAssetPaths.some(p=>p.includes('/ib-question-boundary-v1-'))).toBe(false);
   expect(JSON.stringify(raw)).toBe(before);
  }
 });
 test('stale input fails closed',()=>{
  const [qid,entry]=Object.entries(banks['ib-biology-hl'])[0];
  expect(()=>reviewedIbBoundaryPaths('ib-biology-hl',qid,[...entry.oldPaths,'questions/extra.webp'])).toThrow(/disagrees/);
  expect(()=>reviewedIbBoundaryMarks('ib-biology-hl',qid,entry.marks.old+1)).toThrow(/disagrees/);
 });
 test.skipIf(!existsSync(research))('builder is reproducible from the research package',()=>{
  execFileSync('node',['scripts/build-reviewed-ib-question-boundary-repairs.mjs',research,'--check'],{stdio:'pipe'});
 });
});
