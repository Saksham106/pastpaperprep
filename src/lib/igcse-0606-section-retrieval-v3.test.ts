import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {normalizeBankQuestions} from './questions';
import {filterQuestions} from './question-filter';
import seal from '../../docs/0606-legacy-filter-seal-v3.json';
import {project0606ApprovedSections,OVERLAY_0606_V3} from './igcse-0606-section-retrieval-v3.mjs';
import {metadataFromRaw} from '../../scripts/generate-bank-index.mjs';
import {toPublicQuestionMetadata} from './question-index';
import {getSubtopicGroups,getTopicOptions} from './taxonomy-router';
import {split0606Raw} from './igcse-0606-additions.mjs';
const rawPayload=JSON.parse(readFileSync('src/data/raw/igcse-additional.json','utf8'));
const raw=rawPayload.questions;
// Historical seal rows plus the hash-pinned reviewed additions carrying each label.
const {added}=split0606Raw(rawPayload);
const sealed=(label:string,ids:string[])=>[...ids,...added.filter((r:{subtopics:string[]})=>r.subtopics.includes(label)).map((r:{id:string})=>r.id)].sort();
const registry=JSON.parse(readFileSync('src/data/igcse-0606-numbered-subtopics.json','utf8'));
describe('0606 additive official statement retrieval',()=>{
 it('preserves all17served fine-filter sets, including Calculus454',()=>{
  const rows=normalizeBankQuestions('igcse-additional',raw);
  for(const [label,ids]of Object.entries(seal.fineFilterIds))expect(filterQuestions(rows,{subtopics:[label]}).map(r=>r.id).sort(),label).toEqual(sealed(label,ids));
  expect(seal.fineFilterIds.Calculus).toHaveLength(454);expect(filterQuestions(rows,{subtopics:['Calculus']})).toHaveLength(461);
 });
 it('rejects source drift and does not invent links for unresolved rows',()=>{
  const r=raw.find((r:{id:string})=>r.id===OVERLAY_0606_V3.rows[0].id);
  expect(()=>project0606ApprovedSections({...r,accessibleText:r.accessibleText+' changed'})).toThrow(/drift/);
  const ids=new Set(OVERLAY_0606_V3.rows.map(r=>r.id));const held=raw.find((r:{id:string})=>!ids.has(r.id));expect(project0606ApprovedSections(held)).toBeNull();
 });
 it('keeps every runtime classification payload identical to the public projector',()=>{
  const rows=normalizeBankQuestions('igcse-additional',raw);const originals=new Map<string,Record<string,unknown>>(raw.map((r:{id:string})=>[r.id,r]));
  for(const r of rows){const publicRow=metadataFromRaw(originals.get(r.id),{bank:'igcse-additional'});const runtime=toPublicQuestionMetadata(r);expect(publicRow.subtopics,r.id).toEqual(runtime.subtopics);expect(publicRow.skills,r.id).toEqual(runtime.skills);expect(publicRow.secondaryTopics,r.id).toEqual(runtime.secondaryTopics);expect(publicRow.officialCodeRefs??[],r.id).toEqual(runtime.officialCodeRefs??[]);}
 });
 it('retrieves all source-reviewed kinematics and exponential-substitution secondaries',()=>{
  const rows=normalizeBankQuestions('igcse-additional',raw);
  for(const code of ['14.14','14.3','4.3','6.3']){
   const title=registry.sections.find((s:{code:string})=>s.code===code).displayTitle;
   expect(filterQuestions(rows,{subtopics:[title]}).map(r=>r.id),code).toContain('0606-2023-november-22-q7');
  }
 });
 it('shows all67statements in teaching order beside every original17finefilter',()=>{
  const rows=normalizeBankQuestions('igcse-additional',raw);const options=getSubtopicGroups(rows,[],[]).all;
  expect(rows).toHaveLength(1656);expect(options.slice(0,67)).toEqual(registry.sections.map((s:{displayTitle:string})=>s.displayTitle));expect(options).toHaveLength(84);
  for(const label of new Set<string>(raw.flatMap((r:{subtopics:string[]})=>r.subtopics)))expect(options).toContain(label);
  expect(getTopicOptions(rows)).toContain('Earlier syllabus topics');
 });
 it('links each reviewed 2026 March row to exactly its reviewed statements with model-review provenance',()=>{
  const review=JSON.parse(readFileSync('docs/0606-2026-march-addition-sections-v4.json','utf8'));
  expect(review.reviews.map((r:{id:string})=>r.id)).toEqual(added.map((r:{id:string})=>r.id));
  for(const r of review.reviews){
   const codes=[...new Set<string>(r.parts.flatMap((p:{codes:string[]})=>p.codes))];
   const result=project0606ApprovedSections(added.find((row:{id:string})=>row.id===r.id));
   if(!result)throw new Error(`Missing reviewed projection: ${r.id}`);
   expect(result.codeRefs.filter((ref:string)=>ref.startsWith('current_2025:')).map((ref:string)=>ref.slice(13)).sort(),r.id).toEqual(codes.sort());
   expect(result.codeRefs.filter((ref:string)=>!ref.startsWith('current_2025:')).every((ref:string)=>ref.startsWith('source_image_model_0606_v4:')),r.id).toBe(true);
  }
  expect(OVERLAY_0606_V3.rows.filter(r=>added.some((row:{id:string})=>row.id===r.id))).toHaveLength(23);
 });
});
