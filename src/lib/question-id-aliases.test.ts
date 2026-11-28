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

  it('covers exactly the retired 2026 donated ids and the A Level duplicate variants onto live questions', async () => {
    expect(Object.keys(banks).sort()).toEqual(['a-level-biology-9700', 'a-level-chemistry-9701', 'a-level-computer-science-9618', 'a-level-economics-9708', 'a-level-further-maths-9231', 'a-level-maths-9709', 'a-level-physics-9702', 'cbse-10-science', 'cbse-12-chemistry', 'ib-hl', 'ib-sl']);
    expect(Object.keys(banks['a-level-physics-9702'])).toHaveLength(184);
    expect(Object.keys(banks['a-level-chemistry-9701'])).toHaveLength(381);
    expect(Object.keys(banks['a-level-biology-9700'])).toHaveLength(60);
    expect(Object.keys(banks['a-level-economics-9708'])).toHaveLength(250);
    expect(Object.keys(banks['a-level-computer-science-9618'])).toHaveLength(124);
    expect(Object.keys(banks['a-level-further-maths-9231'])).toHaveLength(365);
    expect(Object.keys(banks['ib-hl'])).toHaveLength(26);
    expect(Object.keys(banks['ib-sl'])).toHaveLength(36);
    expect(Object.keys(banks['a-level-maths-9709'])).toHaveLength(149);
    // CBSE: a question printed in up to three sets of a region maps the other sets' copies onto one canonical question.
    expect(Object.keys(banks['cbse-12-chemistry'])).toHaveLength(997);
    expect(Object.keys(banks['cbse-10-science'])).toHaveLength(966);
    // One to one, except 9618 May/June 2021 Paper 3: Cambridge printed one paper as variants 31, 32 and 33, so 32 and 33
    // both map onto 31.
    const triple = Object.entries(banks['a-level-computer-science-9618']).filter(([oldId]) => /^9618-2021-s-3[23]-/.test(oldId));
    expect(triple).toHaveLength(18);
    for (const [oldId, newId] of triple) expect(newId).toBe(oldId.replace(/^9618-2021-s-3[23]-/, '9618-2021-s-31-'));
    expect(retiredQuestionIds('a-level-computer-science-9618', '9618-2021-s-31-q1')).toEqual(['9618-2021-s-32-q1', '9618-2021-s-33-q1']);
    for (const [bank, map] of Object.entries(banks)) {
      const live = await loadBankQuestionMap(bank as BankSlug);
      if (!bank.startsWith('cbse-')) expect(new Set(Object.values(map)).size).toBe(Object.keys(map).length - (bank === 'a-level-computer-science-9618' ? 9 : 0));
      for (const [oldId, newId] of Object.entries(map)) {
        expect(live.has(oldId)).toBe(false);
        expect(live.has(newId)).toBe(true);
      }
    }
  });
});
