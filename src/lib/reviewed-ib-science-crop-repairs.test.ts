import {test,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {IB_SCIENCE_CROP_REPAIR_BANKS,reviewedMarkschemePaths} from '@/lib/reviewed-mcq-answer-repairs';
import {loadBankQuestions} from '@/lib/question-loader';
import type {BankSlug} from '@/lib/banks';
import {metadataFromRaw} from '../../scripts/generate-bank-index.mjs';
// Question crops follow the separate shared-stimulus overlay (docs/ib-shared-stimulus-repairs.md).
import {reviewedIbQuestionPaths} from '@/lib/reviewed-ib-shared-stimulus';
const repairs=JSON.parse(readFileSync('src/data/reviewed-ib-science-crop-repairs.json','utf8'));
// Exact reviewed cohort: bank, question, which answer crops are new, and the public answer-image count after repair.
const cohorts=[
 {bank:'ib-chemistry-hl',id:'2023-may-tz2-hl-p2-q6',replaced:[1],count:2},
 {bank:'ib-chemistry-sl',id:'2025-may-tz1-sl-p2-q4',replaced:[0],count:3},
] as const;
const rawOf=(bank:string)=>JSON.parse(readFileSync(`src/data/raw/${bank}.json`,'utf8')).questions as {id:string;questionImages?:string[];markschemeImages?:string[];officialMarkscheme?:{images:string[]}}[];
// Some raw rows store absolute source URLs; the loader keys assets by their questions/ or markschemes/ path.
const key=(bank:string,p:string)=>`${bank}/${p.replace(/^https?:\/\/.*?\/(?=(?:questions|markschemes)\/)/,'')}`;
test('sealed receipt binds the exact reviewed cohort and every fully read-back object',()=>{
 const bytes=readFileSync('data/storage/ib-science-crop-repairs.manifest.json');const manifest=JSON.parse(bytes.toString());const receipt=JSON.parse(readFileSync('data/storage/ib-science-crop-repairs.receipt.json','utf8'));
 expect(manifest.banks).toEqual(repairs.banks);
 expect(Object.entries(repairs.banks).flatMap(([bank,entries])=>Object.keys(entries as object).map(id=>`${bank}:${id}`)).sort()).toEqual(cohorts.map(c=>`${c.bank}:${c.id}`).sort());
 expect(manifest.cohorts.map((c:{bank:string;questionId:string})=>`${c.bank}:${c.questionId}`).sort()).toEqual(cohorts.map(c=>`${c.bank}:${c.id}`).sort());
 const expected=cohorts.flatMap(c=>c.replaced.map(i=>({objectKey:`${c.bank}/${repairs.banks[c.bank][c.id].newPaths[i]}`,sha256:repairs.banks[c.bank][c.id].sha256[i]})));
 expect(manifest.objects.map((o:{objectKey:string;sha256:string})=>({objectKey:o.objectKey,sha256:o.sha256})).sort((a:{objectKey:string},b:{objectKey:string})=>a.objectKey.localeCompare(b.objectKey))).toEqual(expected.sort((a,b)=>a.objectKey.localeCompare(b.objectKey)));
 expect(manifest.objectCount).toBe(expected.length);
 expect(receipt.state).toBe('verified_readback');expect(receipt.manifestSha256).toBe(createHash('sha256').update(bytes).digest('hex'));
 expect(receipt.records).toEqual([...manifest.objects].sort((a:{objectKey:string},b:{objectKey:string})=>a.objectKey.localeCompare(b.objectKey)).map((o:{objectKey:string;sha256:string;bytes:number})=>({objectKey:o.objectKey,sha256:o.sha256,bytes:o.bytes,contentType:'image/webp'})));
});
test.each(cohorts)('$bank $id: only the reviewed answer crops change; stale source paths fail closed',({bank,id,replaced})=>{
 const row=rawOf(bank).find(q=>q.id===id)!;const entry=repairs.banks[bank][id];
 expect(row.officialMarkscheme?.images).toEqual(entry.oldPaths);
 const active=reviewedMarkschemePaths(bank as BankSlug,id,row.officialMarkscheme!.images);
 expect(active).toEqual(entry.newPaths);
 active.forEach((p,i)=>{if((replaced as readonly number[]).includes(i))expect(p).toMatch(/^repairs\/ib-science-crop-v1-[a-f0-9]{16}\/[a-f0-9]{64}\.webp$/);else expect(entry.oldPaths).toContain(p);});
 expect(()=>reviewedMarkschemePaths(bank as BankSlug,id,['markschemes/stale.webp'])).toThrow();
 expect(reviewedMarkschemePaths('ib-physics-hl',id,row.officialMarkscheme!.images)).toEqual(row.officialMarkscheme!.images);
});
test('the repair set applies only to the banks it lists',()=>{
 expect([...IB_SCIENCE_CROP_REPAIR_BANKS].sort()).toEqual(['ib-chemistry-hl','ib-chemistry-sl']);
});
test.each(cohorts)('$bank: actual loader activates the repair and leaves every other question path unchanged',async({bank,id})=>{
 const raw=rawOf(bank);const before=JSON.stringify(raw);const all=await loadBankQuestions(bank as BankSlug);const byId=new Map(all.map(q=>[q.id,q]));
 expect(byId.get(id)?.markschemeAssetPaths).toEqual(repairs.banks[bank][id].newPaths.map((p:string)=>`${bank}/${p}`));
 for(const r of raw){const q=byId.get(r.id);expect(q?.questionAssetPaths).toEqual(reviewedIbQuestionPaths(bank as BankSlug,r.id,r.questionImages??[]).map(p=>key(bank,p)));
  if(r.id!==id)expect(q?.markschemeAssetPaths).toEqual([...(r.markschemeImages??[]),...(r.officialMarkscheme?.images??[])].map(p=>key(bank,p)));}
 expect(JSON.stringify(raw)).toBe(before);
});
test.each(cohorts)('$bank $id: index metadata counts the repaired answer images',({bank,id,count})=>{
 expect(metadataFromRaw(rawOf(bank).find(q=>q.id===id),{bank}).markschemeImageCount).toBe(count);
});
