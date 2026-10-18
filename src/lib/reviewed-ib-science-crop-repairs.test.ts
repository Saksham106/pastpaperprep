import {test,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {IB_SCIENCE_CROP_REPAIR_BANKS,reviewedMarkschemePaths} from '@/lib/reviewed-mcq-answer-repairs';
import {loadBankQuestions} from '@/lib/question-loader';
import {metadataFromRaw} from '../../scripts/generate-bank-index.mjs';
// Question crops follow the separate shared-stimulus overlay (docs/ib-shared-stimulus-repairs.md).
import {reviewedIbQuestionPaths} from '@/lib/reviewed-ib-shared-stimulus';
const raw=JSON.parse(readFileSync('src/data/raw/ib-chemistry-sl.json','utf8')).questions;
const id='2025-may-tz1-sl-p2-q4';
const row=raw.find((q:{id:string})=>q.id===id);
const repairs=JSON.parse(readFileSync('src/data/reviewed-ib-science-crop-repairs.json','utf8'));
const entry=repairs.banks['ib-chemistry-sl'][id];
// Some raw rows store absolute source URLs; the loader keys assets by their questions/ or markschemes/ path.
const key=(p:string)=>`ib-chemistry-sl/${p.replace(/^https?:\/\/.*?\/(?=(?:questions|markschemes)\/)/,'')}`;
test('sealed receipt binds the exact reviewed cohort and its one fully read-back object',()=>{
 const bytes=readFileSync('data/storage/ib-science-crop-repairs.manifest.json');const manifest=JSON.parse(bytes.toString());const receipt=JSON.parse(readFileSync('data/storage/ib-science-crop-repairs.receipt.json','utf8'));
 expect(manifest.banks).toEqual(repairs.banks);expect(Object.keys(repairs.banks)).toEqual(['ib-chemistry-sl']);expect(Object.keys(repairs.banks['ib-chemistry-sl'])).toEqual([id]);
 expect(manifest.objects).toEqual([expect.objectContaining({objectKey:`ib-chemistry-sl/${entry.newPaths[0]}`,sha256:entry.sha256[0]})]);
 expect(receipt.state).toBe('verified_readback');expect(receipt.manifestSha256).toBe(createHash('sha256').update(bytes).digest('hex'));
 expect(receipt.records).toEqual(manifest.objects.map((o:{objectKey:string;sha256:string;bytes:number})=>({objectKey:o.objectKey,sha256:o.sha256,bytes:o.bytes,contentType:'image/webp'})));
});
test('only the clipped first answer crop is replaced; stale source paths fail closed',()=>{
 expect(row.officialMarkscheme.images).toEqual(entry.oldPaths);
 const active=reviewedMarkschemePaths('ib-chemistry-sl',id,row.officialMarkscheme.images);
 expect(active[0]).toMatch(/^repairs\/ib-science-crop-v1-[a-f0-9]{16}\/[a-f0-9]{64}\.webp$/);
 expect(active.slice(1)).toEqual(row.officialMarkscheme.images.slice(1));
 expect(()=>reviewedMarkschemePaths('ib-chemistry-sl',id,['markschemes/stale.webp'])).toThrow();
 expect(reviewedMarkschemePaths('ib-chemistry-hl',id,row.officialMarkscheme.images)).toEqual(row.officialMarkscheme.images);
 expect([...IB_SCIENCE_CROP_REPAIR_BANKS]).toEqual(['ib-chemistry-sl']);
});
test('actual loader activates the repair and leaves every other question path unchanged',async()=>{
 const before=JSON.stringify(raw);const all=await loadBankQuestions('ib-chemistry-sl');const byId=new Map(all.map(q=>[q.id,q]));
 expect(byId.get(id)?.markschemeAssetPaths).toEqual(entry.newPaths.map((p:string)=>`ib-chemistry-sl/${p}`));
 for(const r of raw){const q=byId.get(r.id);expect(q?.questionAssetPaths).toEqual(reviewedIbQuestionPaths('ib-chemistry-sl',r.id,r.questionImages).map(key));
  if(r.id!==id)expect(q?.markschemeAssetPaths).toEqual([...(r.markschemeImages??[]),...(r.officialMarkscheme?.images??[])].map(key));}
 expect(JSON.stringify(raw)).toBe(before);
});
test('index metadata keeps the same answer image count',()=>{
 expect(metadataFromRaw(row,{bank:'ib-chemistry-sl'}).markschemeImageCount).toBe(3);
});
