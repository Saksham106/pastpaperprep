import { describe, expect, test } from 'vitest';
import repairs from '@/data/reviewed-maths-source-answer-repairs.json';
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync('data/storage/maths-source-answer-repairs.manifest.json','utf8')) as {heldQuestionIds:Record<string,string[]>};
const maths = JSON.parse(readFileSync('src/data/raw/igcse.json','utf8'));
const additional = JSON.parse(readFileSync('src/data/raw/igcse-additional.json','utf8'));
import { reviewedMarkschemePaths } from '@/lib/reviewed-mcq-answer-repairs';
import { loadBankQuestions } from '@/lib/question-loader';
import { normalizeBankQuestions } from '@/lib/questions';
import type { BankSlug } from '@/lib/banks';

describe('reviewed IGCSE maths source-answer repairs', () => {
  test('all 2007 exact source-bound replacements project in order without mutating raw records', () => {
    let count = 0;
    for (const bank of ['igcse','igcse-additional'] as const) {
      const raw = (bank === 'igcse' ? maths : additional) as unknown as { questions: {id:string; markschemeImages:string[];[key:string]:unknown}[] };
      const rows = raw.questions;
      const before = JSON.stringify(rows);
      const normalized = new Map(normalizeBankQuestions(bank,rows,{applyReviewedBlankPages:true}).map(q=>[q.id,q]));
      for (const [qid, entry] of Object.entries(repairs[bank])) {
        const row=rows.find(q=>q.id===qid)!;
        expect(reviewedMarkschemePaths(bank,qid,row.markschemeImages)).toEqual(entry.newPaths);
        expect(normalized.get(qid)?.markschemeAssetPaths).toEqual(entry.newPaths.map(p=>`${bank}/${p}`));
        expect(normalized.get(qid)?.markschemeImageCount).toBe(entry.newPaths.length);
        count++;
      }
      expect(JSON.stringify(rows)).toBe(before);
      for(const id of manifest.heldQuestionIds[bank]) {
        const row=rows.find(q=>q.id===id)!;
        expect(reviewedMarkschemePaths(bank,id,row.markschemeImages)).toEqual(row.markschemeImages);
      }
    }
    expect(count).toBe(2007);
  });
  test('actual legacy-bank loader used by the live signer activates all reviewed answers',async()=> {
    for(const bank of ['igcse','igcse-additional'] as const){
      const loaded=new Map((await loadBankQuestions(bank)).map(q=>[q.id,q]));
      const raw=(bank==='igcse'?maths:additional).questions;
      const original=new Map(normalizeBankQuestions(bank,raw).map(q=>[q.id,q]));
      for(const [qid,q]of loaded)expect(q.questionAssetPaths).toEqual(original.get(qid)?.questionAssetPaths);
      for(const [qid,entry]of Object.entries(repairs[bank]))expect(loaded.get(qid)?.markschemeAssetPaths).toEqual(entry.newPaths.map(p=>`${bank}/${p}`));
    }
  });
  test('stale exact old paths fail closed',()=> {
    const [id]=Object.keys(repairs.igcse);
    expect(()=>reviewedMarkschemePaths('igcse',id,['markschemes/stale.webp'])).toThrow();
  });
  test('unrelated bank is not affected',()=> {
    expect(reviewedMarkschemePaths('ib-hl' as BankSlug,'unrelated',['markschemes/original.webp'])).toEqual(['markschemes/original.webp']);
  });
});
