import {test,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {IB_SCIENCE_CROP_REPAIR_BANKS,reviewedMarkschemePaths} from '@/lib/reviewed-mcq-answer-repairs';
import {loadBankQuestions} from '@/lib/question-loader';
import type {BankSlug} from '@/lib/banks';
import {metadataFromRaw} from '../../scripts/generate-bank-index.mjs';
// Question crops follow the separate shared-stimulus overlay (docs/ib-shared-stimulus-repairs.md).
import {reviewedIbQuestionPaths} from '@/lib/reviewed-ib-shared-stimulus';
import {rotatedChemistryMarkschemePaths} from '@/lib/reviewed-ib-chemistry-rotated-ms';
const repairs=JSON.parse(readFileSync('src/data/reviewed-ib-science-crop-repairs.json','utf8'));
// Exact reviewed cohort: bank, question, which answer crops are new, and the public answer-image count after repair.
const cohorts=[
 {bank:'ib-chemistry-hl',id:'2023-may-tz2-hl-p2-q6',replaced:[1],count:2},
 {bank:'ib-chemistry-sl',id:'2025-may-tz1-sl-p2-q4',replaced:[0],count:3},
 // Economics continuation repairs (docs/ib-science-crop-repairs.md): an added continuation page or an extended bottom edge.
 // Combined HL/SL Paper 2 questions are served by both banks, so each bank has its own entry and objects.
 {bank:'ib-economics-hl',id:'2021-may-none-hl-p2-q01',replaced:[4],count:5},
 {bank:'ib-economics-hl',id:'2021-november-none-hl-p3-q01',replaced:[4],count:5},
 {bank:'ib-economics-hl',id:'2022-may-none-hl-p2-q01',replaced:[9],count:10},
 {bank:'ib-economics-hl',id:'2024-may-tz2-hlsl-p2-q01',replaced:[5],count:8},
 {bank:'ib-economics-hl',id:'2025-may-tz1-hlsl-p2-q02',replaced:[2,7],count:14},
 {bank:'ib-economics-hl',id:'2025-may-tz3-hlsl-p2-q02',replaced:[10],count:12},
 {bank:'ib-economics-hl',id:'2026-may-tz3-hlsl-p2-q02',replaced:[4],count:12},
 {bank:'ib-economics-sl',id:'2021-november-none-sl-p2-q01',replaced:[4],count:5},
 {bank:'ib-economics-sl',id:'2022-may-none-sl-p2-q01',replaced:[9],count:10},
 {bank:'ib-economics-sl',id:'2024-may-tz2-hlsl-p2-q01',replaced:[5],count:8},
 {bank:'ib-economics-sl',id:'2025-may-tz1-hlsl-p2-q02',replaced:[2,7],count:14},
 {bank:'ib-economics-sl',id:'2025-may-tz3-hlsl-p2-q02',replaced:[10],count:12},
 {bank:'ib-economics-sl',id:'2026-may-tz3-hlsl-p2-q02',replaced:[4],count:12},
] as const;
const economics=(bank:string)=>bank.startsWith('ib-economics');
const rawOf=(bank:string)=>JSON.parse(readFileSync(`src/data/${economics(bank)?'production':'raw'}/${bank}.json`,'utf8')).questions as {id:string;questionImages?:string[];markschemeImages?:string[];officialMarkscheme?:{images:string[]}}[];
// Some raw rows store absolute source URLs; the loader keys assets by their questions/ or markschemes/ path.
const key=(bank:string,p:string)=>`${bank}/${p.replace(/^https?:\/\/.*?\/(?=(?:questions|markschemes)\/)/,'')}`;
// Economics rows repeat their crops in both lists and are served through the local-preview asset route in tests.
const answerPaths=(bank:string,r:{markschemeImages?:string[];officialMarkscheme?:{images:string[]}})=>{const all=[...(r.markschemeImages??[]),...(r.officialMarkscheme?.images??[])];return economics(bank)?[...new Set(all)]:all;};
const served=(paths:readonly string[]|undefined)=>(paths??[]).map(p=>p.replace(/^\/api\/local-preview-assets\//,''));
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
 expect([...IB_SCIENCE_CROP_REPAIR_BANKS].sort()).toEqual(['ib-chemistry-hl','ib-chemistry-sl','ib-economics-hl','ib-economics-sl']);
});
test.each(cohorts)('$bank: actual loader activates the repair and leaves every other question path unchanged',async({bank,id})=>{
 const raw=rawOf(bank);const before=JSON.stringify(raw);const all=await loadBankQuestions(bank as BankSlug);const byId=new Map(all.map(q=>[q.id,q]));
 expect(served(byId.get(id)?.markschemeAssetPaths)).toEqual(repairs.banks[bank][id].newPaths.map((p:string)=>`${bank}/${p}`));
 const repaired=new Set(Object.keys(repairs.banks[bank]));
 for(const r of raw){const q=byId.get(r.id);
  // This overlay never touches question crops; Economics question paths follow their own runtime rules.
  if(!economics(bank))expect(q?.questionAssetPaths).toEqual(reviewedIbQuestionPaths(bank as BankSlug,r.id,r.questionImages??[]).map(p=>key(bank,p)));
  // The rotated Chemistry re-cuts (docs/ib-crop-repairs-v2.md) are their own overlay, never the same question.
  if(!repaired.has(r.id))expect(served(q?.markschemeAssetPaths)).toEqual((rotatedChemistryMarkschemePaths(bank as BankSlug,r.id,answerPaths(bank,r))??answerPaths(bank,r)).map(p=>key(bank,p)));}
 expect(JSON.stringify(raw)).toBe(before);
});
test.each(cohorts)('$bank $id: index metadata counts the repaired answer images',({bank,id,count})=>{
 const options=economics(bank)?{bank,normalizedProduction:true,localEconomics:true}:{bank};
 expect(metadataFromRaw(rawOf(bank).find(q=>q.id===id),options).markschemeImageCount).toBe(count);
});
