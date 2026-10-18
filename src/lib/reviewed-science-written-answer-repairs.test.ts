import{describe,test,expect,vi}from'vitest';
import{readFileSync}from'node:fs';
import{createHash}from'node:crypto';
import{reviewedMarkschemePaths}from'@/lib/reviewed-mcq-answer-repairs';
import{cleanSourceCropPaths}from'@/lib/clean-source-crops';
import{loadBankQuestions}from'@/lib/question-loader';
import{getPrivateBankObjectPrefix}from'@/lib/private-runtime-mapping';
import{metadataFromRaw}from'../../scripts/generate-bank-index.mjs';
import{normalizeBankQuestions}from'@/lib/questions';
const repairs=JSON.parse(readFileSync('src/data/reviewed-science-written-answer-repairs.json','utf8'))as Record<string,Record<string,{oldPaths:string[];newPaths:string[];sha256:string[]}>>;
// Later reviewed row repairs replace some of these crops again (docs/science-crop-repairs-0620-0625.md,
// docs/science-ms-continuation-repairs.md).
const later=['src/data/reviewed-science-crop-repairs-0620-0625.json','src/data/reviewed-science-ms-continuation-repairs.json'].map(f=>JSON.parse(readFileSync(f,'utf8')).banks as Record<string,Record<string,unknown>>);
const superseded=Object.fromEntries(['igcse-chemistry-0620','igcse-physics-0625'].map(b=>[b,Object.assign({},...later.map(o=>o[b]??{}))])) as Record<string,Record<string,unknown>>;
const held=JSON.parse(readFileSync('data/storage/science-written-answer-repairs.manifest.json','utf8')).heldQuestionIds as Record<string,string[]>;
describe('reviewed science written-answer source repairs',()=>{
 test('sealed remote receipt binds every immutable object and exact manifest',()=>{
  const bytes=readFileSync('data/storage/science-written-answer-repairs.manifest.json');const manifest=JSON.parse(bytes.toString());
  const receipt=JSON.parse(readFileSync('data/storage/science-written-answer-repairs.receipt.json','utf8'));
  expect(receipt.state).toBe('verified_readback');expect(receipt.manifestSha256).toBe(createHash('sha256').update(bytes).digest('hex'));
  expect(receipt.records).toHaveLength(2350);expect(new Set(receipt.records.map((r:{objectKey:string})=>r.objectKey)).size).toBe(2350);
  expect(receipt.records).toEqual(manifest.objects.map((o:{objectKey:string;sha256:string;bytes:number})=>({objectKey:o.objectKey,sha256:o.sha256,bytes:o.bytes,contentType:'image/webp'})).sort((a:{objectKey:string},b:{objectKey:string})=>a.objectKey.localeCompare(b.objectKey)));
 });
 for(const bank of ['igcse-chemistry-0620','igcse-physics-0625','igcse-coordinated-sciences-0654']as const){
  test(`${bank}: exact all written-answer mappings activated by actual production loader; QP and held MS unchanged`,async()=>{
   vi.stubEnv('PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS','true');vi.stubEnv('PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED','true');
   try{
    const raw=JSON.parse(readFileSync(`src/data/production/${bank}.json`,'utf8')).questions;
    const old=new Map(normalizeBankQuestions(bank,raw,{economicsAssetMode:'private',applyReviewedBlankPages:true}).map(q=>[q.id,q]));const before=JSON.stringify(raw);const after=new Map((await loadBankQuestions(bank)).map(q=>[q.id,q]));
    for(const [qid,entry]of Object.entries(repairs[bank])){
     if(superseded[bank]?.[qid]){expect(after.get(qid)?.markschemeAssetPaths.every(p=>/\/science-ms-(rows-v2|continuation-v1)-/.test(p))).toBe(true);continue;}
     expect(reviewedMarkschemePaths(bank,qid,entry.oldPaths)).toEqual(entry.newPaths);
     expect(after.get(qid)?.markschemeAssetPaths).toEqual(cleanSourceCropPaths(bank,entry.newPaths).map(p=>getPrivateBankObjectPrefix(bank)+p));
     expect(after.get(qid)?.markschemeImageCount).toBe(entry.newPaths.length);
     expect(metadataFromRaw(raw.find((q:{id:string})=>q.id===qid),{bank,normalizedProduction:true}).markschemeImageCount).toBe(entry.newPaths.length);
     expect(after.get(qid)?.questionAssetPaths).toEqual(old.get(qid)?.questionAssetPaths);
    }
    for(const qid of held[bank].filter(id=>!superseded[bank]?.[id]))expect(after.get(qid)?.markschemeAssetPaths).toEqual(old.get(qid)?.markschemeAssetPaths);
    expect(JSON.stringify(raw)).toBe(before);
   }finally{vi.unstubAllEnvs();}
  });
 }
 test('stale old answer paths fail closed',()=>{const bank='igcse-physics-0625';const id=Object.keys(repairs[bank])[0];expect(()=>reviewedMarkschemePaths(bank,id,['markschemes/stale.webp'])).toThrow();});
});
