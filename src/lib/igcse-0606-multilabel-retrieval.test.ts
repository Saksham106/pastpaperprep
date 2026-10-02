import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {project0606Sections} from './igcse-0606-subtopics.mjs';

const raw=JSON.parse(readFileSync('src/data/raw/igcse-additional.json','utf8')).questions;
const q=(id:string)=>raw.find((r:{id:string})=>r.id===id);
describe('0606 multi-label assessed operations',()=>{
 it('retains the candidate secondary parent relationship offline',()=>{
  const r=project0606Sections(q('0606-2026-june-22-q4'));
  expect(r.topics).toContain('Functions');
 });
 it('recognises product differentiation from the expression, without product-rule wording',()=>{
  expect(project0606Sections(q('0606-2022-june-23-q8')).codeRefs).toContain('current_2025:14.4');
 });
 it('retrieves a linear-argument sine integral',()=>{
  expect(project0606Sections(q('0606-2016-june-22-q9')).codeRefs).toContain('current_2025:14.12');
 });
 it('recovers modulus inequalities despite lost modulus/comparison glyphs',()=>{
  expect(project0606Sections(q('0606-2018-november-12-q3')).codeRefs).toContain('current_2025:4.2');
 });
 it('preserves old filters and rejects changed input',()=>{
  const r=q('0606-2022-june-23-q8');expect(project0606Sections(r).subtopics).toEqual(expect.arrayContaining(r.subtopics));
  expect(()=>project0606Sections({...r,accessibleText:r.accessibleText+'changed'})).toThrow(/drift/);
 });
 it('does not treat derivative notation alone as integration',()=>{
  expect(project0606Sections({id:'negative-only-derivative',subtopics:['Calculus'],accessibleText:'Find dy/dx for the given function.'}).codes).not.toContain('14.10');
 });
});
