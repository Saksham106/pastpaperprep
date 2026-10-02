import{describe,test,expect,vi}from'vitest';
import{readFileSync}from'node:fs';
import{createHash}from'node:crypto';
import{reviewedMarkschemePaths}from'@/lib/reviewed-mcq-answer-repairs';
import{loadBankQuestions}from'@/lib/question-loader';
import{getPrivateBankObjectPrefix}from'@/lib/private-runtime-mapping';
import{metadataFromRaw}from'../../scripts/generate-bank-index.mjs';
import{normalizeBankQuestions}from'@/lib/questions';
const repairs=JSON.parse(readFileSync('src/data/reviewed-economics-written-answer-repairs.json','utf8'))as Record<string,Record<string,{oldPaths:string[];newPaths:string[];sha256:string[]}>>;
const held=JSON.parse(readFileSync('data/storage/economics-written-answer-repairs.manifest.json','utf8')).heldQuestionIds as Record<string,string[]>;
describe('reviewed Economics written-answer crops',()=>{
 test('sealed receipt binds every approved object to the exact immutable manifest',()=>{
  const bytes=readFileSync('data/storage/economics-written-answer-repairs.manifest.json');const manifest=JSON.parse(bytes.toString());const receipt=JSON.parse(readFileSync('data/storage/economics-written-answer-repairs.receipt.json','utf8'));
  expect(receipt.state).toBe('verified_readback');expect(receipt.manifestSha256).toBe(createHash('sha256').update(bytes).digest('hex'));expect(receipt.records).toHaveLength(673);expect(new Set(receipt.records.map((r:{objectKey:string})=>r.objectKey)).size).toBe(673);
  expect(receipt.records).toEqual(manifest.objects.map((o:{objectKey:string;sha256:string;bytes:number})=>({objectKey:o.objectKey,sha256:o.sha256,bytes:o.bytes,contentType:'image/webp'})).sort((a:{objectKey:string},b:{objectKey:string})=>a.objectKey.localeCompare(b.objectKey)));
 });
 for(const bank of ['igcse-economics-0455']as const){
  test(`${bank}: exact all written-answer mappings activated by actual production loader; QP and held MS unchanged`,async()=>{
   vi.stubEnv('PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS','true');vi.stubEnv('PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED','true');
   try{
    const raw=JSON.parse(readFileSync(`src/data/production/${bank}.json`,'utf8')).questions;
    const old=new Map(normalizeBankQuestions(bank,raw,{economicsAssetMode:'private',applyReviewedBlankPages:true}).map(q=>[q.id,q]));const before=JSON.stringify(raw);const after=new Map((await loadBankQuestions(bank)).map(q=>[q.id,q]));
    for(const [qid,entry]of Object.entries(repairs[bank])){
     expect(reviewedMarkschemePaths(bank,qid,entry.oldPaths)).toEqual(entry.newPaths);
     expect(after.get(qid)?.markschemeAssetPaths).toEqual(entry.newPaths.map(p=>getPrivateBankObjectPrefix(bank)+p));
     expect(after.get(qid)?.markschemeImageCount).toBe(entry.newPaths.length);
     expect(metadataFromRaw(raw.find((q:{id:string})=>q.id===qid),{bank,normalizedProduction:true}).markschemeImageCount).toBe(entry.newPaths.length);
     expect(after.get(qid)?.questionAssetPaths).toEqual(old.get(qid)?.questionAssetPaths);
    }
    for(const qid of held[bank])expect(after.get(qid)?.markschemeAssetPaths).toEqual(old.get(qid)?.markschemeAssetPaths);
    expect(JSON.stringify(raw)).toBe(before);
   }finally{vi.unstubAllEnvs();}
  });
 }
 test('stale old answer paths fail closed',()=>{const bank='igcse-economics-0455';const id=Object.keys(repairs[bank])[0];expect(()=>reviewedMarkschemePaths(bank,id,['markschemes/stale.webp'])).toThrow();});
});
