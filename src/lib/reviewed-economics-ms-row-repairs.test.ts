import{describe,test,expect,vi}from'vitest';
import{existsSync,readFileSync}from'node:fs';
import{execFileSync}from'node:child_process';
import{createHash}from'node:crypto';
import{reviewedMarkschemePaths}from'@/lib/reviewed-mcq-answer-repairs';
import{loadBankQuestions}from'@/lib/question-loader';
import{getPrivateBankObjectPrefix}from'@/lib/private-runtime-mapping';
import{metadataFromRaw}from'../../scripts/generate-bank-index.mjs';
import{normalizeBankQuestions}from'@/lib/questions';
import loaded from'@/data/reviewed-economics-ms-row-repairs.json';
// docs/economics-ms-row-repairs.md
const overlay=JSON.parse(readFileSync('src/data/reviewed-economics-ms-row-repairs.json','utf8'));
const written=JSON.parse(readFileSync('src/data/reviewed-economics-written-answer-repairs.json','utf8'));
type Entry={oldPaths:string[];oldSha256:string[];newPaths:string[];sha256:string[]};
const entries=overlay.entries as Record<string,Entry>;
const manifestBytes=readFileSync('data/storage/economics-ms-row-repairs.manifest.json');const manifest=JSON.parse(manifestBytes.toString());
const receiptFile='data/storage/economics-ms-row-repairs.receipt.json';
const research='/Users/sakshamgoel/Documents/ProjectsInternships/research/economics-ms-row-repair-20261023';
const bank='igcse-economics-0455';
const prefix=getPrivateBankObjectPrefix(bank);
const rawAnswers=(q:{markschemeImages?:string[];officialMarkscheme?:{images?:string[]}})=>[...new Set([...(q.markschemeImages??[]),...(q.officialMarkscheme?.images??[])])];
describe('reviewed Economics mark-scheme row repairs',()=>{
 test('exact cohort: 0455-2022-s-21 q2, q3, q4; one manifest object per new crop',()=>{
  expect(overlay.bank).toBe(bank);
  expect(Object.keys(entries)).toEqual(['0455-2022-s-21-q2','0455-2022-s-21-q3','0455-2022-s-21-q4']);
  const fresh=Object.values(entries).flatMap(e=>e.newPaths.filter(p=>p.startsWith(overlay.namespace+'/')));
  expect(manifest.objects.map((o:{objectKey:string})=>o.objectKey)).toEqual(fresh.map(p=>prefix+p).sort());
  expect([manifest.answerReplacementCount,manifest.objectCount]).toEqual([3,4]);
 });
 test('each answer loses or gains only the misassigned rows',()=>{
  const [q2,q3,q4]=Object.values(entries);
  // Q2 and Q3 keep three released crops and replace their last one.
  for(const e of [q2,q3]){expect(e.newPaths.slice(0,3)).toEqual(e.oldPaths.slice(0,3));expect(e.sha256.slice(0,3)).toEqual(e.oldSha256.slice(0,3));expect(e.newPaths[3]).not.toBe(e.oldPaths[3]);}
  // Q4 gains the 4(a) row before today's page-19 crop, byte for byte.
  expect(q4.newPaths).toHaveLength(2);
  expect(q4.sha256[1]).toBe(written[bank]['0455-2022-s-21-q4'].sha256[0]);
  expect(overlay.officialSchemeGaps['0455-2022-s-21-q4'].missingRows).toEqual(['4(d)']);
 });
 test('sealed remote receipt binds every immutable object and the exact manifest',()=>{
  const receipt=JSON.parse(readFileSync(receiptFile,'utf8'));
  expect([receipt.state,receipt.bucket,receipt.objectCount]).toEqual(['verified_readback','pastpaperprep-assets',4]);
  expect(receipt.manifestSha256).toBe(createHash('sha256').update(manifestBytes).digest('hex'));
  expect(receipt.records.map(({objectKey,sha256,bytes}:{objectKey:string;sha256:string;bytes:number})=>({objectKey,sha256,bytes}))).toEqual(manifest.objects);
 });
 test('every mapping is activated by the actual production loader; everything else unchanged',async()=>{
  vi.stubEnv('PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS','true');vi.stubEnv('PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED','true');
  try{
   const runtime=JSON.parse(readFileSync(`src/data/production/${bank}.json`,'utf8'));const raw=runtime.questions;const before=JSON.stringify(raw);
   // As in the written-answer test: a pending storage release stays closed through the loader, so the same normalization is used.
   const pending=runtime.runtimeArtifact?.assetVerification!=='verified_readback';
   const after=new Map((pending?normalizeBankQuestions(bank,JSON.parse(before),{economicsAssetMode:'private',applyReviewedBlankPages:true}):await loadBankQuestions(bank)).map(q=>[q.id,q]));
   for(const [qid,entry]of Object.entries(entries)){
    const q=raw.find((x:{id:string})=>x.id===qid);
    expect(rawAnswers(q)).toEqual(entry.oldPaths);
    expect(q.markschemeImageHashes).toEqual(entry.oldSha256);
    expect(reviewedMarkschemePaths(bank,qid,entry.oldPaths)).toEqual(entry.newPaths);
    expect(after.get(qid)?.markschemeAssetPaths).toEqual(entry.newPaths.map(p=>prefix+p));
    expect(after.get(qid)?.markschemeImageCount).toBe(entry.newPaths.length);
    expect(metadataFromRaw(q,{bank,normalizedProduction:true}).markschemeImageCount).toBe(entry.newPaths.length);
   }
   for(const q of after.values())if(!entries[q.id])expect(q.markschemeAssetPaths.some(p=>p.includes('/economics-ms-rows-v1-'))).toBe(false);
   expect(JSON.stringify(raw)).toBe(before);
  }finally{vi.unstubAllEnvs();}
 });
 test('stale old paths and a tampered hash fail closed',()=>{
  const [qid,entry]=Object.entries(entries)[0];
  expect(()=>reviewedMarkschemePaths(bank,qid,entry.oldPaths.slice(1))).toThrow(/disagrees/);
  // The runtime reads the imported module, so tamper with that copy.
  const live=(loaded.entries as Record<string,Entry>)[qid];const saved=live.oldSha256[0];live.oldSha256[0]='0'.repeat(64);
  try{expect(()=>reviewedMarkschemePaths(bank,qid,entry.oldPaths)).toThrow(/disagrees/);}finally{live.oldSha256[0]=saved;}
 });
 test.skipIf(!existsSync(research))('builder is reproducible from the research package',()=>{
  execFileSync('node',['scripts/build-economics-ms-row-repairs.mjs',research,'--check'],{stdio:'pipe'});
 });
});
