import{describe,test,expect}from'vitest';
import{existsSync,readFileSync}from'node:fs';
import{execFileSync}from'node:child_process';
import{createHash}from'node:crypto';
import{reviewedIbQuestionPaths}from'@/lib/reviewed-ib-shared-stimulus';
import{loadBankQuestions}from'@/lib/question-loader';
import type{BankSlug}from'@/lib/banks';
import{metadataFromRaw}from'../../scripts/generate-bank-index.mjs';
const overlay=JSON.parse(readFileSync('src/data/reviewed-ib-shared-stimulus-repairs.json','utf8'));
type Entry={oldPaths:string[];oldSha256:string[];newPaths:string[];sha256:string[]};
const manifestBytes=readFileSync('data/storage/ib-shared-stimulus-repairs.manifest.json');const manifest=JSON.parse(manifestBytes.toString());
const research='/Users/sakshamgoel/Documents/ProjectsInternships/research/ib-shared-stimulus-audit-20261018/repair';
const banks=overlay.banks as Record<BankSlug,Record<string,Entry>>;
const isNew=(p:string)=>p.startsWith(`${overlay.namespace}/`);
// Storage key of a runtime path: relative paths sit under the bank; extension years use the public source URL.
const key=(bank:string,p:string)=>`${bank}/${p.replace(/^https:\/\/saksham106\.github\.io\/ib-[a-z]+-topic-practice\//,'')}`;
describe('reviewed IB shared-stimulus question crops',()=>{
 test('exact cohort: 23 questions in four banks, 12 new objects, one manifest object per new crop',()=>{
  expect(Object.keys(banks).sort()).toEqual(['ib-biology-hl','ib-biology-sl','ib-chemistry-hl','ib-chemistry-sl']);
  expect(Object.keys(banks['ib-biology-sl']).sort()).toEqual(['2017-november-tz0-sl-p1-q1','2017-november-tz0-sl-p1-q2','2017-november-tz0-sl-p1-q3','2017-november-tz0-sl-p1-q4','2017-november-tz0-sl-p1-q5','2020-november-tz0-sl-p1-q1','2020-november-tz0-sl-p1-q2','2022-november-tz0-sl-p1-q1','2022-november-tz0-sl-p1-q2','2022-november-tz0-sl-p1-q3']);
  expect(Object.keys(banks['ib-biology-hl']).sort()).toEqual(['2017-may-tz2-hl-p1-q22','2017-november-tz0-hl-p1-q1','2017-november-tz0-hl-p1-q2','2017-november-tz0-hl-p1-q3','2017-november-tz0-hl-p1-q4','2021-may-tz1-hl-p1-q1','2021-may-tz1-hl-p1-q2','2021-may-tz1-hl-p1-q23','2021-may-tz1-hl-p1-q24','2021-may-tz1-hl-p1-q25','2021-may-tz1-hl-p1-q3']);
  expect(Object.keys(banks['ib-chemistry-hl'])).toEqual(['2017-may-tz1-hl-p3-q1']);
  expect(Object.keys(banks['ib-chemistry-sl'])).toEqual(['2017-may-tz1-sl-p3-q1']);
  const keys=[...new Set(Object.entries(banks).flatMap(([bank,e])=>Object.values(e).flatMap(x=>x.newPaths.filter(isNew).map(p=>`${bank}/${p}`))))].sort();
  expect(manifest.objects.map((o:{objectKey:string})=>o.objectKey)).toEqual(keys);
  expect([manifest.questionReplacementCount,manifest.objectCount]).toEqual([23,12]);
 });
 test('a shared stimulus comes first and is the same object for every question it serves; kept crops keep their served hash',()=>{
  const s=(bank:BankSlug,qid:string)=>banks[bank][qid].newPaths[0];
  expect(s('ib-biology-sl','2020-november-tz0-sl-p1-q1')).toBe(s('ib-biology-sl','2020-november-tz0-sl-p1-q2'));
  expect(s('ib-biology-hl','2021-may-tz1-hl-p1-q24')).toBe(s('ib-biology-hl','2021-may-tz1-hl-p1-q25'));
  expect(s('ib-biology-hl','2017-november-tz0-hl-p1-q3')).toBe(s('ib-biology-hl','2017-november-tz0-hl-p1-q4'));
  for(const e of Object.values(banks).flatMap(b=>Object.values(b)))e.newPaths.forEach((p,i)=>{
   if(isNew(p))expect(p).toBe(`${overlay.namespace}/${e.sha256[i]}.webp`);
   else expect(e.sha256[i]).toBe(e.oldSha256[e.oldPaths.indexOf(p)]);
  });
  // A crop that held only the stimulus leaves the question before it; q22 and 2021 q1 are re-cut.
  expect(banks['ib-biology-hl']['2021-may-tz1-hl-p1-q23'].newPaths).toEqual(banks['ib-biology-hl']['2021-may-tz1-hl-p1-q23'].oldPaths.slice(0,1));
  expect(banks['ib-biology-sl']['2022-november-tz0-sl-p1-q1'].newPaths).toEqual(banks['ib-biology-sl']['2022-november-tz0-sl-p1-q1'].oldPaths.slice(0,1));
  expect(banks['ib-biology-hl']['2017-may-tz2-hl-p1-q22'].newPaths.every(isNew)).toBe(true);
 });
 test('sealed remote receipt binds every immutable object and the exact manifest',()=>{
  const receipt=JSON.parse(readFileSync('data/storage/ib-shared-stimulus-repairs.receipt.json','utf8'));
  expect(receipt.state).toBe('verified_readback');
  expect(typeof receipt.contentTypeObserved).toBe('boolean');
  expect(receipt.verification).toBe(receipt.contentTypeObserved?'full_get_sha256_size_type':'full_get_sha256_size');
  expect(receipt.manifestSha256).toBe(createHash('sha256').update(manifestBytes).digest('hex'));
  expect(receipt.records).toEqual(manifest.objects.map((o:{objectKey:string;sha256:string;bytes:number})=>({objectKey:o.objectKey,sha256:o.sha256,bytes:o.bytes,contentType:receipt.contentTypeObserved?'image/webp':null})));
 });
 test('every mapping is activated by the actual production loader and the bank index; nothing else moves',async()=>{
  for(const [bank,repairs] of Object.entries(banks) as [BankSlug,Record<string,Entry>][]){
   const raw=JSON.parse(readFileSync(`src/data/production/${bank}.json`,'utf8')).questions;const before=JSON.stringify(raw);
   const after=new Map((await loadBankQuestions(bank)).map(q=>[q.id,q]));
   for(const [qid,entry] of Object.entries(repairs)){
    const q=raw.find((x:{id:string})=>x.id===qid);
    expect(q.questionImages).toEqual(entry.oldPaths);
    expect(reviewedIbQuestionPaths(bank,qid,entry.oldPaths)).toEqual(entry.newPaths);
    expect(after.get(qid)?.questionAssetPaths).toEqual(entry.newPaths.map(p=>key(bank,p)));
    expect(metadataFromRaw(q,{bank,normalizedProduction:true}).questionImageCount).toBe(entry.newPaths.length);
   }
   for(const q of after.values())if(!repairs[q.id])expect(q.questionAssetPaths.some(p=>p.includes('/ib-shared-stimulus-v1-'))).toBe(false);
   expect(JSON.stringify(raw)).toBe(before);
  }
 });
 test('stale old paths fail closed',()=>{
  const [qid,entry]=Object.entries(banks['ib-biology-sl'])[0];
  expect(()=>reviewedIbQuestionPaths('ib-biology-sl',qid,[...entry.oldPaths,'questions/extra.webp'])).toThrow(/disagrees/);
 });
 test.skipIf(!existsSync(research))('builder is reproducible from the research package',()=>{
  execFileSync('node',['scripts/build-reviewed-ib-shared-stimulus-repairs.mjs',research,'--check'],{stdio:'pipe'});
 });
});
