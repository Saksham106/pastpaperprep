import {test,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {normalizeBankQuestions} from './questions';
import {getSubtopicGroups} from './taxonomy-router';
import {filterQuestions} from './question-filter';
import {displayedQuestionSubtopics} from './presentation';
import {ADDED_0606_QUESTION_IDS} from './igcse-0606-additions.mjs';
const rows=(file:string)=>JSON.parse(readFileSync(file,'utf8')).questions;
test('0580 additive numbered mapping preserves the complete legacy retrieval split',()=>{
 const qs=normalizeBankQuestions('igcse',rows('src/data/raw/igcse.json'));
 expect(qs).toHaveLength(3967);
 const labels=getSubtopicGroups(qs,[],[]).all;
 expect(labels).toContain('Indices and surds');
 expect(labels).toContain('1.18 Surds');
 expect(labels.filter(label=>/^\d+\.\d+\s/.test(label))).toHaveLength(72);
 // The 178 restored legacy IDs remain; two source-confirmed geometric surds are additive descendants.
 expect(filterQuestions(qs,{subtopics:['Indices and surds']})).toHaveLength(180);
 expect(qs.flatMap(displayedQuestionSubtopics).some(label=>/^\d+\.\d+\s/.test(label))).toBe(false);
});
test('0606 additive official statements preserve original fine filters',()=>{
 const qs=normalizeBankQuestions('igcse-additional',rows('src/data/raw/igcse-additional.json'));
 expect(qs).toHaveLength(1656);
 const labels=getSubtopicGroups(qs,[],[]).all;
 expect(labels).toHaveLength(84);
 expect(labels.filter(label=>/^\d+\.\d+\s/.test(label))).toHaveLength(67);
 // Historical Calculus 454, plus exactly the seven reviewed Feb/March 2026 calculus rows.
 const calculus=filterQuestions(qs,{subtopics:["Calculus"]});
 expect(calculus.filter(q=>!ADDED_0606_QUESTION_IDS.includes(q.id))).toHaveLength(454);
 expect(calculus).toHaveLength(461);
 expect(qs.flatMap(displayedQuestionSubtopics).some(label=>/^\d+\.\d+\s/.test(label))).toBe(false);
});
