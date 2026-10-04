import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {createHash} from 'node:crypto';
import { normalizeBankQuestions } from './questions';
import { filterQuestions } from './question-filter';
import { getSubtopicGroups } from './taxonomy-router';
import { verified0580RetrievalAdditions } from './igcse-0580-source-retrieval.mjs';
import { metadataFromRaw } from '../../scripts/generate-bank-index.mjs';
const raw = JSON.parse(readFileSync('src/data/raw/igcse.json','utf8')).questions;
const targetIds = ['0580-2025-march-22-q18','0580-2025-november-22-q17'];
test('source-owned geometric surds remain geometry questions and also retrieve under the existing Number filter',()=>{
 const before=JSON.stringify(raw);
 const qs=normalizeBankQuestions('igcse',raw);
 const oldIds=raw.filter((q:{subtopics:string[]})=>q.subtopics.includes('Indices and surds')).map((q:{id:string})=>q.id);
 expect(oldIds).toHaveLength(178);
 const expected=[...oldIds,...targetIds].sort();
 expect(filterQuestions(qs,{subtopics:['Indices and surds']}).map(q=>q.id).sort()).toEqual(expected);
 for(const id of targetIds){
  const q=qs.find(q=>q.id===id)!;
  const source=raw.find((q:{id:string})=>q.id===id);
  expect(q.primaryTopic).toBe(source.primaryTopic);
  expect(q.secondaryTopics).toContain('Number');
  expect(q.subtopics.slice(0,source.subtopics.length+1)).toEqual([...source.subtopics,'Indices and surds']);
  expect(filterQuestions(qs,{topics:['Number'],subtopics:['Indices and surds']}).some(q=>q.id===id)).toBe(true);
  const indexed=metadataFromRaw(source,{bank:'igcse'});
  expect(indexed.secondaryTopics).toEqual(q.secondaryTopics);
  expect(indexed.subtopics).toEqual(q.subtopics);
  expect(indexed.skills).toEqual(q.skills);
 }
 expect(qs).toHaveLength(3967);
 expect(getSubtopicGroups(qs,[],[]).all.filter(label=>!/^\d+\.\d+\s/.test(label))).toHaveLength(51);
 expect(JSON.stringify(raw)).toBe(before);
});
test('source retrieval additions reject drift and leave metadata for every other bank alone',()=>{
 const target=raw.find((q:{id:string})=>q.id===targetIds[0]);
 expect(()=>verified0580RetrievalAdditions({...target,accessibleText:target.accessibleText+' drift'})).toThrow('source drift');
 expect(()=>verified0580RetrievalAdditions({...target,questionImages:['replacement.webp']})).toThrow('source drift');
 const other=metadataFromRaw(target,{bank:'unrelated-fixture'});
 expect(other.secondaryTopics).toEqual(target.secondaryTopics);
 expect(other.subtopics).toEqual(target.subtopics);
});
test('changes only the declared runtime fields, with no aliases and independent pristine skills evidence',()=>{
 const sealed=JSON.parse(readFileSync('docs/0580-source-surd-runtime-baseline.json','utf8'));
 const qs=normalizeBankQuestions('igcse',raw);
 const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
 // Replay the historical repair view after subtracting only this release's additions.
 const legacyView=qs.map(q=>{
  const source=raw.find((r:{id:string})=>r.id===q.id);
  const addition=verified0580RetrievalAdditions(source);
  const view={...q,subtopics:q.subtopics.filter(t=>!/^\d+\.\d+\s/.test(t)),skills:q.skills.filter(t=>!/^\d+\.\d+\s/.test(t)),secondaryTopics:[...new Set([...source.secondaryTopics,...(addition?.secondaryTopics??[])])],officialCodeRefs:source.officialCodeRefs??[]};
  view.searchText=[view.primaryTopic,...view.secondaryTopics,...view.subtopics,...view.skills,view.summary,view.accessibleText,view.solution??''].join(' ').toLocaleLowerCase();
  return view;
 });
 expect(hash(legacyView.filter(q=>!targetIds.includes(q.id)))).toBe(sealed.unaffectedRowsSha256);
 for(const before of sealed.records){
  const q=legacyView.find(q=>q.id===before.id)!;
  expect(Object.keys(q).sort()).toEqual(before.keys);
  expect(Object.hasOwn(q,'aliases')).toBe(false);
  expect(q.skills).toEqual([...before.skills,'Indices and surds']);
  expect(q.subtopics).toEqual([...before.subtopics,'Indices and surds']);
  expect(q.secondaryTopics).toEqual([...before.secondaryTopics,'Number']);
  expect(hash(Object.fromEntries(Object.entries(q).filter(([key])=>!sealed.excludedFields.includes(key))))).toBe(before.immutableFieldsSha256);
  // Search text is the existing derived union of tags/text; its extension is intentional.
  expect(q.searchText).toBe([q.primaryTopic,...q.secondaryTopics,...q.subtopics,...q.skills,q.summary,q.accessibleText,q.solution??''].join(' ').toLocaleLowerCase());
  expect(q.searchText).toContain('indices and surds');
  const indexed=metadataFromRaw(raw.find((r:{id:string})=>r.id===q.id),{bank:'igcse'});
  expect(Object.hasOwn(indexed,'aliases')).toBe(false);
 }
});

