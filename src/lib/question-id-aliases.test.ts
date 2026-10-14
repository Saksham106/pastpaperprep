import { describe, expect, it } from 'vitest';
import aliases from '@/data/question-id-aliases.json';
import { currentQuestionId, currentQuestionIds, retiredQuestionIds } from '@/lib/question-id-aliases';
import { loadBankQuestionMap } from '@/lib/question-loader';
import type { BankSlug } from '@/lib/banks';

const banks = aliases.banks as Record<string, Record<string, string>>;

describe('retired question id aliases', () => {
  it('maps a retired id to its replacement and leaves others alone', () => {
    expect(currentQuestionId('ib-hl', '2026-may-tza-p1-q1')).toBe('2026-may-tz1-p1-q1');
    expect(currentQuestionId('ib-sl', 'm26-math-aasl-p1-c-q3')).toBe('2026-may-p1-tz3-q3');
    expect(currentQuestionId('ib-hl', '2025-may-tz1-p1-q1')).toBe('2025-may-tz1-p1-q1');
    expect(currentQuestionId('ib-sl', '2026-may-tza-p1-q1')).toBe('2026-may-tza-p1-q1');
    expect(currentQuestionId('ib-hl', 'constructor')).toBe('constructor');
  });

  it('maps lists in order and drops duplicates created by mapping', () => {
    expect(currentQuestionIds('ib-hl', ['2025-may-tz1-p1-q2', '2026-may-tza-p2-q4', '2026-may-tz1-p2-q4'])).toEqual(['2025-may-tz1-p1-q2', '2026-may-tz1-p2-q4']);
  });

  it('lists the retired ids behind a current id', () => {
    expect(retiredQuestionIds('ib-sl', '2026-may-p2-tz3-q9')).toEqual(['m26-math-aasl-p2-tzc-q9']);
    expect(retiredQuestionIds('ib-hl', '2025-may-tz1-p1-q1')).toEqual([]);
  });

  it('covers exactly the retired 2026 donated ids, one to one, onto live questions', async () => {
    expect(Object.keys(banks).sort()).toEqual(['ib-hl', 'ib-sl']);
    expect(Object.keys(banks['ib-hl'])).toHaveLength(26);
    expect(Object.keys(banks['ib-sl'])).toHaveLength(36);
    for (const [bank, map] of Object.entries(banks)) {
      const live = await loadBankQuestionMap(bank as BankSlug);
      expect(new Set(Object.values(map)).size).toBe(Object.keys(map).length);
      for (const [oldId, newId] of Object.entries(map)) {
        expect(live.has(oldId)).toBe(false);
        expect(live.has(newId)).toBe(true);
      }
    }
  });
});
