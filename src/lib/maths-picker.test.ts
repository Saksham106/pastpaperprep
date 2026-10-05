import {describe,it,expect} from 'vitest';
import {loadBankQuestions} from './question-fixtures';
import {filterQuestions} from './question-filter';
import {generatePaper} from './paper-builder';
import {getMathsPickerGroups as getSubtopicGroups,getMathsPickerTopics as getTopicOptions} from './maths-picker';
import {getMathsPickerSections,isEarlierMathsQuestion,mathsEarlierToken,mathsSubtopicMatches,mathsPickerLabel} from './maths-picker';
const banks=['igcse','igcse-additional'] as const;
describe('one clean syllabus-aligned maths picker',()=>{
 it.each(banks)('makes every %s question reachable without mutating classifications',bank=>{
  const rows=loadBankQuestions(bank);const before=JSON.stringify(rows);const groups=getSubtopicGroups(rows,[],[]);
  const uncovered=rows.filter(q=>!groups.all.some(v=>mathsSubtopicMatches(q,v)));
  expect(uncovered.map(q=>q.id)).toEqual([]);expect(JSON.stringify(rows)).toBe(before);
  expect(groups.all).not.toContain(bank==='igcse'?'Indices and surds':'Calculus');
 });
 it.each(banks)('shows only officially owned subtopics within each selected %s topic',bank=>{
  const rows=loadBankQuestions(bank);const sections=getMathsPickerSections(bank);
  for(const topic of new Set(sections.map(s=>s.topic))){const groups=getSubtopicGroups(rows,[topic],[]);
   const current=groups.relevant.filter(v=>!v.startsWith('earlier-only:'));
   expect(current).toEqual(sections.filter(s=>s.topic===topic).map(s=>s.value));
  }
 });
 it('preserves exact old broad indices retrieval while historical tokens are distinct',()=>{
  const rows=loadBankQuestions('igcse');expect(filterQuestions(rows,{subtopics:['Indices and surds']})).toHaveLength(180);
  const token=mathsEarlierToken('igcse','Matrix operations and algebra');const result=filterQuestions(rows,{subtopics:[token]});
  expect(result.length).toBeGreaterThan(0);expect(result.every(isEarlierMathsQuestion)).toBe(true);
 });
 it.each(banks)('provides named earlier-only choices and a working virtual earlier topic for %s',bank=>{
  const rows=loadBankQuestions(bank);const historical=rows.filter(isEarlierMathsQuestion);const result=filterQuestions(rows,{topics:['Earlier syllabus']});
  expect(result.map(q=>q.id).sort()).toEqual(historical.map(q=>q.id).sort());
  expect(getTopicOptions(rows)).toContain('Earlier syllabus');const groups=getSubtopicGroups(rows,['Earlier syllabus'],[]);
  expect(groups.relevant.length).toBeGreaterThan(0);expect(groups.relevant.every(v=>v.startsWith('earlier-only:'))).toBe(true);
  expect(groups.relevant.map(v=>mathsPickerLabel(bank,v))).not.toContain('Other');
 });
 it.each(banks)('builds real historical %s papers through the same visible tokens',bank=>{
  const rows=loadBankQuestions(bank);const q=rows.find(q=>isEarlierMathsQuestion(q)&&q.marks!>0)!;
  const token=mathsEarlierToken(bank,q.subtopics[0]);const expected=filterQuestions(rows,{topics:['Earlier syllabus'],subtopics:[token],papers:[String(q.paper)]});
  const generated=generatePaper(rows,{bank,mode:'questions',targets:[{paper:q.paper,amount:1}],seed:7,topics:['Earlier syllabus'],subtopics:[token]});
  expect(expected.map(q=>q.id)).toContain(generated.questions[0].id);
 });
 it('keeps old selected aliases as chips, never context-leaking options',()=>{
  const rows=loadBankQuestions('igcse-additional');const groups=getSubtopicGroups(rows,['Functions'],['Indices and surds']);
  expect(groups.selectedOutsideContext).toContain('Indices and surds');expect(groups.relevant).not.toContain('Indices and surds');
  expect(filterQuestions(rows,{subtopics:['Matrices']}).length).toBeGreaterThan(filterQuestions(rows,{subtopics:[mathsEarlierToken('igcse-additional','Matrices')]}).length);
 });
 it('removes visual codes and distinguishes numerical from algebraic indices',()=>{
  expect(mathsPickerLabel('igcse','1.7 Indices I')).toBe('Numerical indices');expect(mathsPickerLabel('igcse','2.4 Indices II')).toBe('Algebraic indices');
  expect(mathsPickerLabel('igcse-additional','14.11 Integrating powers and reciprocal functions')).toBe('Integrating powers and reciprocal functions');
  expect(mathsPickerLabel('igcse-additional',mathsEarlierToken('igcse-additional','Matrices'))).toBe('Matrices');
 });
});
