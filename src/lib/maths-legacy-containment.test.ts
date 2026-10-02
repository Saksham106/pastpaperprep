import {test,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {normalizeBankQuestions} from './questions';
import {getSubtopicGroups} from './taxonomy-router';
import {filterQuestions} from './question-filter';
import {displayedQuestionSubtopics} from './presentation';
const rows=(file:string)=>JSON.parse(readFileSync(file,'utf8')).questions;
test('0580 student retrieval uses the preserved complete legacy split while numbered mapping is offline',()=>{
 const qs=normalizeBankQuestions('igcse',rows('src/data/raw/igcse.json'));
 expect(qs).toHaveLength(3967);
 const labels=getSubtopicGroups(qs,[],[]).all;
 expect(labels).toContain('Indices and surds');
 expect(labels).not.toContain('1.18 Surds');
 expect(labels.some(label=>/^\d+\.\d+\s/.test(label))).toBe(false);
 expect(filterQuestions(qs,{subtopics:['Indices and surds']})).toHaveLength(178);
 expect(qs.flatMap(displayedQuestionSubtopics).some(label=>/^\d+\.\d+\s/.test(label))).toBe(false);
});
test('0606 preserves original subtopic filters while experimental numbered assignments stay offline',()=>{
 const qs=normalizeBankQuestions('igcse-additional',rows('src/data/raw/igcse-additional.json'));
 expect(qs).toHaveLength(1633);
 const labels=getSubtopicGroups(qs,[],[]).all;
 expect(labels).toHaveLength(17);
 expect(labels.some(label=>/^\d+\.\d+\s/.test(label))).toBe(false);
 expect(qs.flatMap(displayedQuestionSubtopics).some(label=>/^\d+\.\d+\s/.test(label))).toBe(false);
});
