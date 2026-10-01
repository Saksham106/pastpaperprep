import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {project0580Sections} from './igcse-0580-official.mjs';
const raw=JSON.parse(readFileSync('src/data/raw/igcse.json','utf8')).questions;
const q=(id:string)=>raw.find((r:{id:string})=>r.id===id);
describe('0580 additive multi-label retrieval',()=>{
 it('adds numeric indices while keeping the old combined filter',()=>{
  const r=q('0580-2026-june-21-q1');const p=project0580Sections(r);
  expect(p.codeRefs).toContain('current_2025:E1.7');
  expect(p.subtopics).toContain('Indices and surds');
 });
 it('adds algebraic indices as a second assessed operation',()=>{
  expect(project0580Sections(q('0580-2021-june-11-q17')).codeRefs).toContain('current_2025:C2.4');
 });
 it('adds conditional probability even when a different section already exists',()=>{
  expect(project0580Sections(q('0580-2019-june-23-q20')).codeRefs).toContain('current_2025:E8.4');
 });
 it('does not mistake lost algebraic power notation for surds',()=>{
  expect(project0580Sections(q('0580-2024-november-23-q17')).codeRefs).not.toContain('current_2025:E1.18');
 });
 it('rejects changed model input',()=>{
  const r=q('0580-2026-june-21-q1');expect(()=>project0580Sections({...r,accessibleText:r.accessibleText+'changed'})).toThrow(/drift/);
 });
});
