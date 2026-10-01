import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { project0654Sections } from './igcse-0654-official.mjs';
const raw = JSON.parse(readFileSync('src/data/production/igcse-coordinated-sciences-0654.json','utf8')).questions;
const question = (id: string) => raw.find((q: {id:string}) => q.id === id);
describe('0654 source-adjudicated missing secondaries', () => {
 it('retrieves carbon-cycle work even when the old primary was respiration', () => {
  const q=question('0654-2024-summer-41-q10');const p=project0654Sections(q);
  expect(p.codeRefs).toContain('current_2025:B18.3');
  expect(p.subtopics).toContain('Carbon cycle');
  expect(p.subtopics).toEqual(expect.arrayContaining(q.subtopics));
 });
 it('recognises the physics nucleus, not a biological cell nucleus', () => {
  const p=project0654Sections(question('0654-2024-summer-12-q39'));
  expect(p.codeRefs).toContain('current_2025:P5.1');
  expect(p.subtopics).toContain('The nucleus');
 });
 it('includes the explicitly asked principal energy source, not incidental energy-flow wording', () => {
  expect(project0654Sections(question('0654-2021-winter-33-q4')).codeRefs).toContain('current_2025:B18.1');
  expect(project0654Sections(question('0654-2023-march-22-q12')).codeRefs).not.toContain('current_2025:B18.1');
 });
 it('adds assessed antibiotic use but not incidental atropine context', () => {
  expect(project0654Sections(question('0654-2025-summer-32-q1')).codeRefs).toContain('current_2025:B14.1');
  expect(project0654Sections(question('0654-2021-winter-23-q9')).codeRefs).not.toContain('current_2025:B14.1');
 });
});
