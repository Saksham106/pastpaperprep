import{describe,test,expect,vi}from'vitest';
import{existsSync,readFileSync}from'node:fs';
import{execFileSync}from'node:child_process';
import{createHash}from'node:crypto';
import{reviewedMarkschemePaths}from'@/lib/reviewed-mcq-answer-repairs';
import{cleanSourceCropPaths}from'@/lib/clean-source-crops';
import{loadBankQuestions}from'@/lib/question-loader';
import{getPrivateBankObjectPrefix}from'@/lib/private-runtime-mapping';
import{metadataFromRaw}from'../../scripts/generate-bank-index.mjs';
import{normalizeBankQuestions}from'@/lib/questions';
const bank='igcse-coordinated-sciences-0654';
const overlay=JSON.parse(readFileSync('src/data/reviewed-science-ms-row-repairs.json','utf8'));
const repairs=overlay.banks[bank]as Record<string,{oldPaths:string[];newPaths:string[];sha256:string[]}>;
const manifestBytes=readFileSync('data/storage/science-ms-row-repairs.manifest.json');const manifest=JSON.parse(manifestBytes.toString());
const pkg='/Users/sakshamgoel/Documents/ProjectsInternships/research/0654-ms-crop-audit-20261017/build-a/repairs.json';
describe('reviewed science mark-scheme row repairs (0654)',()=>{
 test('exact cohort, disjoint from the earlier written-answer overlay, one manifest object per new crop',()=>{
  expect(Object.keys(overlay.banks)).toEqual([bank]);expect(Object.keys(repairs)).toHaveLength(234);
  const earlier=JSON.parse(readFileSync('src/data/reviewed-science-written-answer-repairs.json','utf8'))[bank];
  for(const qid of Object.keys(repairs))expect(earlier[qid]).toBeUndefined();
  const keys=[...new Set(Object.values(repairs).flatMap(e=>e.newPaths))].map(p=>getPrivateBankObjectPrefix(bank)+p).sort();
  expect(manifest.objects.map((o:{objectKey:string})=>o.objectKey).sort()).toEqual(keys);
  expect([manifest.logicalReplacementCount,manifest.imageReferenceCount,manifest.objectCount]).toEqual([234,442,402]);
 });
 test('sealed remote receipt binds every immutable object and the exact manifest',()=>{
  const receipt=JSON.parse(readFileSync('data/storage/science-ms-row-repairs.receipt.json','utf8'));
  expect(receipt.state).toBe('verified_readback');
  // Wrangler readback cannot observe Content-Type; the receipt must say so instead of asserting it.
  expect(typeof receipt.contentTypeObserved).toBe('boolean');
  expect(receipt.verification).toBe(receipt.contentTypeObserved?'full_get_sha256_size_type':'full_get_sha256_size');expect(receipt.manifestSha256).toBe(createHash('sha256').update(manifestBytes).digest('hex'));
  expect(receipt.records).toEqual(manifest.objects.map((o:{objectKey:string;sha256:string;bytes:number})=>({objectKey:o.objectKey,sha256:o.sha256,bytes:o.bytes,contentType:receipt.contentTypeObserved?'image/webp':null})).sort((a:{objectKey:string},b:{objectKey:string})=>a.objectKey.localeCompare(b.objectKey)));
 });
 test('every mapping is activated by the actual production loader; question paths and other answers unchanged',async()=>{
  vi.stubEnv('PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS','true');vi.stubEnv('PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED','true');
  try{
   const raw=JSON.parse(readFileSync(`src/data/production/${bank}.json`,'utf8')).questions;const before=JSON.stringify(raw);
   const after=new Map((await loadBankQuestions(bank)).map(q=>[q.id,q]));
   const normalized=new Map(normalizeBankQuestions(bank,raw,{economicsAssetMode:'private',applyReviewedBlankPages:true}).map(q=>[q.id,q]));
   for(const [qid,entry]of Object.entries(repairs)){
    const q=raw.find((x:{id:string})=>x.id===qid);
    expect(q.markschemeImages).toEqual(entry.oldPaths);
    expect(reviewedMarkschemePaths(bank,qid,entry.oldPaths)).toEqual(entry.newPaths);
    expect(after.get(qid)?.markschemeAssetPaths).toEqual(cleanSourceCropPaths(bank,entry.newPaths).map(p=>getPrivateBankObjectPrefix(bank)+p));
    expect(after.get(qid)?.markschemeImageCount).toBe(entry.newPaths.length);
    expect(metadataFromRaw(q,{bank,normalizedProduction:true}).markschemeImageCount).toBe(entry.newPaths.length);
    expect(after.get(qid)?.questionAssetPaths).toEqual(normalized.get(qid)?.questionAssetPaths);
   }
   for(const q of after.values())if(!repairs[q.id])expect(q.markschemeAssetPaths.some(p=>p.includes('/science-ms-rows-v1-'))).toBe(false);
   expect(JSON.stringify(raw)).toBe(before);
  }finally{vi.unstubAllEnvs();}
 });
 test('stale old answer paths fail closed',()=>{const id=Object.keys(repairs)[0];expect(()=>reviewedMarkschemePaths(bank,id,['markschemes/stale.webp'])).toThrow();});
 test.skipIf(!existsSync(pkg))('overlay and manifest rebuild byte-identically from the research package',()=>{
  execFileSync('node',['scripts/build-science-ms-row-repairs.mjs',pkg,'--check'],{stdio:'pipe'});
 });
});
