import{describe,test,expect,vi}from'vitest';
import{existsSync,readFileSync}from'node:fs';
import{execFileSync}from'node:child_process';
import{createHash}from'node:crypto';
import{reviewedCs0478QuestionPaths}from'@/lib/reviewed-cs-0478-mask-repairs';
import{loadBankQuestions}from'@/lib/question-loader';
import{getPrivateBankObjectPrefix}from'@/lib/private-runtime-mapping';
import{metadataFromRaw}from'../../scripts/generate-bank-index.mjs';
const overlay=JSON.parse(readFileSync('src/data/reviewed-cs-0478-mask-repairs.json','utf8'));
type Entry={oldPaths:string[];oldSha256:string[];newPaths:string[];sha256:string[];falseMaskCount:number};
const manifestBytes=readFileSync('data/storage/cs-0478-mask-repairs.manifest.json');const manifest=JSON.parse(manifestBytes.toString());
const research='/Users/sakshamgoel/Documents/ProjectsInternships/research/cs-0478-false-barcode-masks';
const bank='igcse-computer-science-0478' as const;
const questions=overlay.questions as Record<string,Entry>;
const isNew=(p:string)=>p.startsWith(`${overlay.namespace}/`);
describe('reviewed CS 0478 false-mask repairs',()=>{
 test('exact cohort: five questions, one repaired crop each, one manifest object per new crop',()=>{
  expect(overlay.bank).toBe(bank);
  expect(Object.keys(questions)).toEqual(['0478-2020-w-12-q5','0478-2022-w-23-q4','0478-2024-m-12-q3','0478-2024-s-12-q5','0478-2024-s-12-q6']);
  expect(Object.values(questions).map(e=>e.falseMaskCount)).toEqual([1,1,8,3,2]);
  const keys=Object.values(questions).flatMap(e=>e.newPaths.filter(isNew).map(p=>getPrivateBankObjectPrefix(bank)+p)).sort();
  expect(manifest.objects.map((o:{objectKey:string})=>o.objectKey)).toEqual(keys);
  expect([manifest.questionReplacementCount,manifest.objectCount]).toEqual([5,5]);
  for(const e of Object.values(questions))e.newPaths.forEach((p,i)=>{
   if(isNew(p))expect(p).toBe(`${overlay.namespace}/${e.sha256[i]}.webp`);
   else expect([p,e.sha256[i]]).toEqual([e.oldPaths[i],e.oldSha256[i]]);
  });
 });
 test('sealed remote receipt binds every immutable object and the exact manifest',()=>{
  const receipt=JSON.parse(readFileSync('data/storage/cs-0478-mask-repairs.receipt.json','utf8'));
  expect(receipt.state).toBe('verified_readback');
  expect(receipt.verification).toBe(receipt.contentTypeObserved?'full_get_sha256_size_type':'full_get_sha256_size');
  expect(receipt.manifestSha256).toBe(createHash('sha256').update(manifestBytes).digest('hex'));
  expect(receipt.records).toEqual(manifest.objects.map((o:{objectKey:string;sha256:string;bytes:number})=>({objectKey:o.objectKey,sha256:o.sha256,bytes:o.bytes,contentType:receipt.contentTypeObserved?'image/webp':null})));
 });
 test('the production loader serves the repaired crops; counts and every other question are unchanged',async()=>{
  vi.stubEnv('PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS','true');vi.stubEnv('PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED','true');
  try{
   const raw=JSON.parse(readFileSync(`src/data/production/${bank}.json`,'utf8')).questions;const before=JSON.stringify(raw);
   const after=new Map((await loadBankQuestions(bank)).map(q=>[q.id,q]));
   for(const [qid,entry]of Object.entries(questions)){
    const q=raw.find((x:{id:string})=>x.id===qid);
    expect([q.questionImages,q.questionImageHashes]).toEqual([entry.oldPaths,entry.oldSha256]);
    expect(after.get(qid)?.questionAssetPaths).toEqual(entry.newPaths.map(p=>getPrivateBankObjectPrefix(bank)+p));
    expect(metadataFromRaw(q,{bank,normalizedProduction:true}).questionImageCount).toBe(entry.newPaths.length);
   }
   for(const q of after.values())if(!questions[q.id])expect(q.questionAssetPaths.some(p=>p.includes('/cs-0478-false-masks-v1-'))).toBe(false);
   expect(JSON.stringify(raw)).toBe(before);
  }finally{vi.unstubAllEnvs();}
 });
 test('stale input fails closed; other banks are untouched',()=>{
  const [qid,entry]=Object.entries(questions)[0];
  expect(()=>reviewedCs0478QuestionPaths(bank,qid,[...entry.oldPaths,'questions/extra.webp'])).toThrow(/disagrees/);
  expect(reviewedCs0478QuestionPaths('igcse-biology-0610',qid,entry.oldPaths)).toEqual(entry.oldPaths);
 });
 test.skipIf(!existsSync(research))('overlay and manifest rebuild byte-identically from the research package',()=>{
  execFileSync('node',['scripts/build-reviewed-cs-0478-mask-repairs.mjs',research,'--check'],{stdio:'pipe'});
 });
});
