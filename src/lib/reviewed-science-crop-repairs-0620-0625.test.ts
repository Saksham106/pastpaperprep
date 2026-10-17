import{describe,test,expect,vi}from'vitest';
import{existsSync,readFileSync}from'node:fs';
import{execFileSync}from'node:child_process';
import{createHash}from'node:crypto';
import{reviewedMarkschemePaths}from'@/lib/reviewed-mcq-answer-repairs';
import{reviewedScienceQuestionPaths}from'@/lib/reviewed-science-question-crops';
import{cleanSourceCropPaths}from'@/lib/clean-source-crops';
import{loadBankQuestions}from'@/lib/question-loader';
import{getPrivateBankObjectPrefix}from'@/lib/private-runtime-mapping';
import{metadataFromRaw}from'../../scripts/generate-bank-index.mjs';
const overlay=JSON.parse(readFileSync('src/data/reviewed-science-crop-repairs-0620-0625.json','utf8'));
type Entry={oldPaths:string[];newPaths:string[];sha256:string[]};
const manifestBytes=readFileSync('data/storage/science-crop-repairs-0620-0625.manifest.json');const manifest=JSON.parse(manifestBytes.toString());
const research='/Users/sakshamgoel/Documents/ProjectsInternships/research/science-ms-crop-audit-20261017';
const banks=['igcse-chemistry-0620','igcse-physics-0625']as const;
const qpBank='igcse-physics-0625',qpId='0625-2020-w-52-q1';
const rawAnswers=(q:{markschemeImages?:string[];officialMarkscheme?:{images?:string[]}})=>[...new Set([...(q.markschemeImages??[]),...(q.officialMarkscheme?.images??[])])];
describe('reviewed 0620/0625 crop repairs',()=>{
 test('exact cohort, one manifest object per new crop',()=>{
  expect(Object.keys(overlay.banks)).toEqual([...banks]);
  expect(Object.keys(overlay.banks['igcse-chemistry-0620'])).toHaveLength(49);expect(Object.keys(overlay.banks['igcse-physics-0625'])).toHaveLength(7);
  const keys=new Set<string>();
  for(const bank of banks)for(const e of Object.values(overlay.banks[bank])as Entry[])for(const p of e.newPaths)keys.add(getPrivateBankObjectPrefix(bank)+p);
  for(const e of Object.values(overlay.questionRepairs[qpBank])as Entry[])e.newPaths.filter(p=>p.startsWith('repairs/')).forEach(p=>keys.add(getPrivateBankObjectPrefix(qpBank)+p));
  expect(manifest.objects.map((o:{objectKey:string})=>o.objectKey).sort()).toEqual([...keys].sort());
  expect([manifest.answerReplacementCount,manifest.questionReplacementCount,manifest.objectCount]).toEqual([56,1,92]);
 });
 test('sealed remote receipt binds every immutable object and the exact manifest',()=>{
  const receipt=JSON.parse(readFileSync('data/storage/science-crop-repairs-0620-0625.receipt.json','utf8'));
  expect(receipt.state).toBe('verified_readback');
  // Wrangler readback cannot observe Content-Type; the receipt must say so instead of asserting it.
  expect(typeof receipt.contentTypeObserved).toBe('boolean');
  expect(receipt.verification).toBe(receipt.contentTypeObserved?'full_get_sha256_size_type':'full_get_sha256_size');expect(receipt.manifestSha256).toBe(createHash('sha256').update(manifestBytes).digest('hex'));
  expect(receipt.records).toEqual(manifest.objects.map((o:{objectKey:string;sha256:string;bytes:number})=>({objectKey:o.objectKey,sha256:o.sha256,bytes:o.bytes,contentType:receipt.contentTypeObserved?'image/webp':null})).sort((a:{objectKey:string},b:{objectKey:string})=>a.objectKey.localeCompare(b.objectKey)));
 });
 for(const bank of banks){
  test(`${bank}: every mapping is activated by the actual production loader; everything else unchanged`,async()=>{
   vi.stubEnv('PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS','true');vi.stubEnv('PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED','true');
   try{
    const raw=JSON.parse(readFileSync(`src/data/production/${bank}.json`,'utf8')).questions;const before=JSON.stringify(raw);
    const after=new Map((await loadBankQuestions(bank)).map(q=>[q.id,q]));
    const repairs=overlay.banks[bank]as Record<string,Entry>;const qp=(overlay.questionRepairs[bank]??{})as Record<string,Entry>;
    for(const [qid,entry]of Object.entries(repairs)){
     const q=raw.find((x:{id:string})=>x.id===qid);
     expect(rawAnswers(q)).toEqual(entry.oldPaths);
     expect(reviewedMarkschemePaths(bank,qid,entry.oldPaths)).toEqual(entry.newPaths);
     expect(after.get(qid)?.markschemeAssetPaths).toEqual(entry.newPaths.map(p=>getPrivateBankObjectPrefix(bank)+p));
     expect(metadataFromRaw(q,{bank,normalizedProduction:true}).markschemeImageCount).toBe(entry.newPaths.length);
    }
    for(const q of after.values()){
     if(!repairs[q.id])expect(q.markschemeAssetPaths.some(p=>p.includes('/science-ms-rows-v2-'))).toBe(false);
     if(!qp[q.id])expect(q.questionAssetPaths.some(p=>p.includes('/science-ms-rows-v2-'))).toBe(false);
    }
    for(const [qid,entry]of Object.entries(qp)){
     const q=raw.find((x:{id:string})=>x.id===qid);
     expect(q.questionImages).toEqual(entry.oldPaths);
     expect(after.get(qid)?.questionAssetPaths).toEqual(cleanSourceCropPaths(bank,entry.newPaths).map(p=>getPrivateBankObjectPrefix(bank)+p));
    }
    expect(JSON.stringify(raw)).toBe(before);
   }finally{vi.unstubAllEnvs();}
  });
 }
 test('stale old paths fail closed',()=>{
  const id=Object.keys(overlay.banks['igcse-chemistry-0620'])[0];
  expect(()=>reviewedMarkschemePaths('igcse-chemistry-0620',id,['markschemes/stale.webp'])).toThrow();
  expect(()=>reviewedScienceQuestionPaths(qpBank,qpId,['questions/stale.webp'])).toThrow();
  expect(reviewedScienceQuestionPaths('igcse-chemistry-0620',qpId,['questions/x.webp'])).toEqual(['questions/x.webp']);
 });
 test.skipIf(!existsSync(research))('overlay and manifest rebuild byte-identically from the research package',()=>{
  execFileSync('node',['scripts/build-science-crop-repairs-0620-0625.mjs',research,'--check'],{stdio:'pipe'});
 });
});
