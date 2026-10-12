import { describe, expect, it } from 'vitest';
import { parseCover, reconcileQuestions, inventorySources, sourceQuestionMarks } from './build-chemistry-paper-archive.mjs';

describe('source paper metadata', () => {
  it('accounts for all 628 originals with exact complete pairs', async () => {
    const sources = await inventorySources();
    expect(sources).toHaveLength(314);
    expect(new Set(sources.map(s=>s.id)).size).toBe(314);
    expect(sources.every(s=>s.question && s.markscheme)).toBe(true);
  });
  it('derives identity, duration and maximum from the actual cover', () => {
    expect(parseCover('CHEMISTRY 0620/32 Paper 3 Theory (Core) February/March 2026 1 hour 15 minutes The total mark for this paper is 80.', '0620-2026-m-32', 'question')).toMatchObject({durationMinutes:75,maxMarks:80,identityValid:true});
  });
  it('decodes the source cover’s offset-encoded embedded font without OCR', () => {
    const encoded = 'CHEMISTRY 0620/23 Paper 2 Multiple Choice (Extended) May/June 2026 45 minutes The total mark for this paper is 40.'.split('').map(c=>String.fromCharCode(c.charCodeAt(0)-29)).join('');
    expect(parseCover(encoded,'0620-2026-s-23','question')).toMatchObject({identityValid:true,durationMinutes:45,maxMarks:40});
  });
  it('reads standalone planning/table questions with no printed Total label', () => {
    expect(sourceQuestionMarks('3 Plan an investigation. [6]')).toBe(6);
    expect(sourceQuestionMarks('2 Complete Table 2.1. [5]')).toBe(5);
    expect(sourceQuestionMarks('1 (a) [2] (b) [3] [Total: 5]')).toBe(5);
  });
  it('accepts split-font year digits in the mark-scheme cover', () => {
    expect(parseCover('CHEMISTRY 0620 / 1 1 Paper 1 Multiple Choice (Core) October / November 20 2 2 MARK SCHEME Maximum Mark: 40','0620-2022-w-11','markscheme').identityValid).toBe(true);
  });
  it('keeps only the title when newer covers extract the date before the paper name', () => {
    expect(parseCover('CHEMISTRY 0620/12 February/March 2026 45 minutes Paper 1 Multiple Choice (Core) You must answer all questions.','0620-2026-m-12','question').paperName).toBe('Multiple Choice (Core)');
  });
  it('rejects source identity mismatches', () => {
    expect(parseCover('CHEMISTRY 0620/42 May/June 2025 1 hour 15 minutes', '0620-2026-m-32', 'question').identityValid).toBe(false);
  });
  it('repairs an exact missing maximum only using the printed question total', () => {
    const rows = [{id:'0620-2026-m-32-q1', number:1, maxMarks:null}];
    expect(reconcileQuestions(rows, [14], 14, 3)).toMatchObject({available:true, marks:[14], corrections:[{id:rows[0].id,from:null,to:14}]});
  });
  it('holds incomplete or wrong question inventories rather than granting a partial report', () => {
    expect(reconcileQuestions([{id:'q1',number:1,maxMarks:10}], [10,10], 20, 3).available).toBe(false);
    expect(reconcileQuestions([{id:'q1',number:1,maxMarks:9}], [10], 10, 3)).toMatchObject({available:true,marks:[10],corrections:[{id:'q1',from:9,to:10}]});
  });
});
