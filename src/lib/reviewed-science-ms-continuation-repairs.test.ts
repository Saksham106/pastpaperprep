import{describe,test,expect,vi}from'vitest';
import{existsSync,readFileSync}from'node:fs';
import{execFileSync}from'node:child_process';
import{createHash}from'node:crypto';
import{reviewedMarkschemePaths}from'@/lib/reviewed-mcq-answer-repairs';
import{loadBankQuestions}from'@/lib/question-loader';
import{getPrivateBankObjectPrefix}from'@/lib/private-runtime-mapping';
import{metadataFromRaw}from'../../scripts/generate-bank-index.mjs';
const overlay=JSON.parse(readFileSync('src/data/reviewed-science-ms-continuation-repairs.json','utf8'));
const written=JSON.parse(readFileSync('src/data/reviewed-science-written-answer-repairs.json','utf8'));
type Entry={oldPaths:string[];newPaths:string[];sha256:string[];missingRows:string[]};
const manifestBytes=readFileSync('data/storage/science-ms-continuation-repairs.manifest.json');const manifest=JSON.parse(manifestBytes.toString());
const research='/Users/sakshamgoel/Documents/ProjectsInternships/research/science-ms-crop-audit-20261017/continuation-repair';
const bank='igcse-chemistry-0620';
const rawAnswers=(q:{markschemeImages?:string[];officialMarkscheme?:{images?:string[]}})=>[...new Set([...(q.markschemeImages??[]),...(q.officialMarkscheme?.images??[])])];
describe('reviewed mark-scheme continuation repairs',()=>{
 test('exact cohort: three 0620-2025-w-33 answers, two crops each, one manifest object per crop',()=>{
  expect(Object.keys(overlay.banks)).toEqual([bank]);
  expect(Object.keys(overlay.banks[bank])).toEqual(['0620-2025-w-33-q4','0620-2025-w-33-q5','0620-2025-w-33-q7']);
  const keys=Object.values(overlay.banks[bank]as Record<string,Entry>).flatMap(e=>e.newPaths.map(p=>getPrivateBankObjectPrefix(bank)+p));
  expect(manifest.objects.map((o:{objectKey:string})=>o.objectKey)).toEqual([...keys].sort());
  expect([manifest.answerReplacementCount,manifest.objectCount]).toEqual([3,6]);
 });
 test('the first crop is today\'s crop byte for byte; only the continuation rows are added',()=>{
  for(const [qid,e]of Object.entries(overlay.banks[bank]as Record<string,Entry>)){
   expect(e.newPaths).toHaveLength(2);
   expect(written[bank][qid].sha256).toEqual([e.sha256[0]]);
  }
  expect((overlay.banks[bank]['0620-2025-w-33-q7']as Entry).missingRows).toEqual(['7(f)']);
 });
 test('sealed remote receipt binds every immutable object and the exact manifest',()=>{
  const receipt=JSON.parse(readFileSync('data/storage/science-ms-continuation-repairs.receipt.json','utf8'));
  expect(receipt.state).toBe('verified_readback');
  expect(typeof receipt.contentTypeObserved).toBe('boolean');
  expect(receipt.verification).toBe(receipt.contentTypeObserved?'full_get_sha256_size_type':'full_get_sha256_size');
  expect(receipt.manifestSha256).toBe(createHash('sha256').update(manifestBytes).digest('hex'));
  expect(receipt.records).toEqual(manifest.objects.map((o:{objectKey:string;sha256:string;bytes:number})=>({objectKey:o.objectKey,sha256:o.sha256,bytes:o.bytes,contentType:receipt.contentTypeObserved?'image/webp':null})));
 });
 test('every mapping is activated by the actual production loader; everything else unchanged',async()=>{
  vi.stubEnv('PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS','true');vi.stubEnv('PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED','true');
  try{
   const raw=JSON.parse(readFileSync(`src/data/production/${bank}.json`,'utf8')).questions;const before=JSON.stringify(raw);
   const after=new Map((await loadBankQuestions(bank)).map(q=>[q.id,q]));
   const repairs=overlay.banks[bank]as Record<string,Entry>;
   for(const [qid,entry]of Object.entries(repairs)){
    const q=raw.find((x:{id:string})=>x.id===qid);
    expect(rawAnswers(q)).toEqual(entry.oldPaths);
    expect(reviewedMarkschemePaths(bank,qid,entry.oldPaths)).toEqual(entry.newPaths);
    expect(after.get(qid)?.markschemeAssetPaths).toEqual(entry.newPaths.map(p=>getPrivateBankObjectPrefix(bank)+p));
    expect(metadataFromRaw(q,{bank,normalizedProduction:true}).markschemeImageCount).toBe(2);
   }
   for(const q of after.values())if(!repairs[q.id])expect(q.markschemeAssetPaths.some(p=>p.includes('/science-ms-continuation-v1-'))).toBe(false);
   expect(JSON.stringify(raw)).toBe(before);
  }finally{vi.unstubAllEnvs();}
 });
 test('stale old paths fail closed',()=>{
  const [qid,entry]=Object.entries(overlay.banks[bank]as Record<string,Entry>)[0];
  expect(()=>reviewedMarkschemePaths(bank,qid,[entry.oldPaths[0]])).toThrow(/disagrees/);
 });
 test.skipIf(!existsSync(research))('builder is reproducible from the research package',()=>{
  execFileSync('node',['scripts/build-science-ms-continuation-repairs.mjs',research,'--check'],{stdio:'pipe'});
 });
});
