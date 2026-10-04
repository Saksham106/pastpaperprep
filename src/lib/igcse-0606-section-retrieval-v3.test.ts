import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {normalizeBankQuestions} from './questions';
import {filterQuestions} from './question-filter';
import seal from '../../docs/0606-legacy-filter-seal-v3.json';
import {project0606ApprovedSections,OVERLAY_0606_V3} from './igcse-0606-section-retrieval-v3.mjs';
import {metadataFromRaw} from '../../scripts/generate-bank-index.mjs';
import {toPublicQuestionMetadata} from './question-index';
import {getSubtopicGroups,getTopicOptions} from './taxonomy-router';
const raw=JSON.parse(readFileSync('src/data/raw/igcse-additional.json','utf8')).questions;
const registry=JSON.parse(readFileSync('src/data/igcse-0606-numbered-subtopics.json','utf8'));
describe('0606 additive official statement retrieval',()=>{
 it('preserves all17served fine-filter sets, including Calculus454',()=>{
  const rows=normalizeBankQuestions('igcse-additional',raw);
  for(const [label,ids]of Object.entries(seal.fineFilterIds))expect(filterQuestions(rows,{subtopics:[label]}).map(r=>r.id).sort(),label).toEqual(ids);
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
  expect(rows).toHaveLength(1633);expect(options.slice(0,67)).toEqual(registry.sections.map((s:{displayTitle:string})=>s.displayTitle));expect(options).toHaveLength(84);
  for(const label of new Set<string>(raw.flatMap((r:{subtopics:string[]})=>r.subtopics)))expect(options).toContain(label);
  expect(getTopicOptions(rows)).toContain('Earlier syllabus topics');
 });
});
