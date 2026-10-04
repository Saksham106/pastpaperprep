import {describe,it,expect} from 'vitest';
import raw from '@/data/raw/igcse.json';
import overlay from '@/data/igcse-0580-section-retrieval-v3.json';
import {IGCSE_0580_TOPICS,IGCSE_0580_SECTIONS,project0580Sections} from '@/lib/igcse-0580-section-retrieval-v3.mjs';
import {normalizeBankQuestions} from '@/lib/questions';
import {readFileSync} from 'node:fs';
import seal from '../../docs/0580-section-legacy-filter-seal-v3.json';
import {toPublicQuestionMetadata,publicBankIndexUrl} from '@/lib/question-index';
import {filterQuestions} from '@/lib/question-filter';
import {getControlledSubtopics,getSubtopicGroups,getTopicOptions} from '@/lib/taxonomy-router';
type SourceQuestion=Record<string,unknown>&{id:string;subtopics:string[];accessibleText:string};
const source=(raw as unknown as {questions:SourceQuestion[]}).questions;
describe('0580 additive official retrieval',()=>{
 it('keeps the existing nine topic names and teaches 72 official sections in order',()=>{
  expect(IGCSE_0580_TOPICS).toEqual(['Number','Algebra and graphs','Coordinate geometry','Geometry','Mensuration','Trigonometry','Transformations and vectors','Probability','Statistics']);
  expect(IGCSE_0580_SECTIONS).toHaveLength(72);
 });
 it('retains all 3967 questions and all 51 original fine labels including the live180 set',()=>{
  const rows=normalizeBankQuestions('igcse',source);expect(rows).toHaveLength(3967);expect(new Set(rows.map(r=>r.id)).size).toBe(3967);
  const labels=[...new Set(source.flatMap(r=>r.subtopics))];expect(labels).toHaveLength(51);
  for(const label of labels){const before=source.filter(r=>r.subtopics.includes(label)).map(r=>r.id).sort();const after=rows.filter(r=>r.subtopics.includes(label)).map(r=>r.id).sort();if(label==='Indices and surds')expect(after).toHaveLength(180);expect(after).toEqual(label==='Indices and surds'?[...new Set([...before,'0580-2025-march-22-q18','0580-2025-november-22-q17'])].sort():before);}
  expect(getTopicOptions(rows)).toEqual(IGCSE_0580_TOPICS);
  const groups=getSubtopicGroups(rows,[],[]);expect(groups.all.slice(0,72)).toEqual(IGCSE_0580_SECTIONS.map(s=>s.displayTitle));expect(groups.all).toHaveLength(123);
 });
 it('shows legacy filters beside the official sections under their unchanged topic',()=>{
  expect(getControlledSubtopics('igcse','Number')).toContain('Indices and surds');expect(getControlledSubtopics('igcse','Number')).toContain('1.7 Indices I');
 });
 it('retains every served fine-filter ID set through the actual retrieval predicate',()=>{
  const rows=normalizeBankQuestions('igcse',source);
  for(const [label,ids]of Object.entries(seal.fineFilterIds))expect(filterQuestions(rows,{subtopics:[label]}).map(r=>r.id).sort(),label).toEqual(ids);
 });
 it('matches full public metadata to runtime classifications while preserving sealed asset counts',()=>{
  const rows=normalizeBankQuestions('igcse',source);
  const index=JSON.parse(readFileSync(`${process.cwd()}/public${publicBankIndexUrl('igcse')}`,'utf8'));
  const generated=new Map(index.questions.map((q:{id:string})=>[q.id,q]));
  const counts=seal.imageCounts as Record<string,number[]>;
  // Historical generator counts can double-count duplicate MS references; unchanged here.
  for(const row of rows)expect(generated.get(row.id),row.id).toEqual({...toPublicQuestionMetadata(row),questionImageCount:counts[row.id][0],markschemeImageCount:counts[row.id][1]});
 });
 it('keeps official sections under their own parents rather than leaking cross-topic labels',()=>{
  const groups=getSubtopicGroups(normalizeBankQuestions('igcse',source),['Number'],[]);
  expect(groups.relevant).toContain('1.7 Indices I');expect(groups.relevant).toContain('Indices and surds');expect(groups.relevant).not.toContain('2.4 Indices II');
 });
 it('does not launder an unreviewed secondary into source-reviewed evidence',()=>{
  const rows=overlay.rows as unknown as {id:string;sectionCodes:string[];evidenceByCode:Record<string,string>}[];
  const mixed=rows.find(r=>new Set(Object.values(r.evidenceByCode)).size>1&&Object.values(r.evidenceByCode).includes('source-reviewed'))!;
  expect(mixed).toBeDefined();const projected=project0580Sections(source.find(r=>r.id===mixed.id)!)!;
  for(const code of mixed.sectionCodes)expect(projected.codeRefs.includes(`source_reviewed_v3:${code}`)).toBe(mixed.evidenceByCode[code]==='source-reviewed');
 });
 it('rejects changed accepted inputs and leaves unresolved rows unmodified',()=>{
  const r=source.find(r=>r.id===overlay.rows[0].id)!;expect(project0580Sections(r)).not.toBeNull();expect(()=>project0580Sections({...r,accessibleText:r.accessibleText+' changed'})).toThrow(/drift/);
  const ids=new Set(overlay.rows.map(r=>r.id));const untouched=source.find(r=>!ids.has(r.id))!;expect(project0580Sections(untouched)).toBeNull();
 });
});
