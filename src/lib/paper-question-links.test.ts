import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { archivePaperKey, fullPaperHrefs, fullPaperQuestionHref, paperTopicSummary, questionPaperKey, questionPages } from './paper-question-links';
import type { WholePaperManifest } from './whole-paper-types';

const archiveDir = join(process.cwd(), 'src/data/paper-archives');
const manifests = readdirSync(archiveDir).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(join(archiveDir, f), 'utf8')) as WholePaperManifest);

describe('paper question links', () => {
  it('resolves bank question ids and full-paper ids to the same paper key', () => {
    expect(questionPaperKey('0620-2019-m-12-q7')).toBe('0620-2019-m-12');
    expect(questionPaperKey('2021-may-none-hl-p2-q01')).toBe('2021-may-none-hl-p2');
    expect(archivePaperKey('ib-economics-hl', 'economics-2021-may-none-hl-p2-english')).toBe('2021-may-none-hl-p2');
    expect(archivePaperKey('ib-computer-science-hl', 'computer-science-2021-may-tz0-hl-p1')).toBe('ib-cs-2021-may-hl-p1-tz0');
    expect(archivePaperKey('igcse', '0580-2016-june-21')).toBe('0580-2016-june-21');
  });

  it('matches every archived question list to its paper key', () => {
    let checked = 0;
    for (const m of manifests) for (const p of m.papers) for (const q of p.questions) {
      expect(questionPaperKey(q.id), `${m.bankSlug} ${p.summary.id}`).toBe(archivePaperKey(m.bankSlug, p.summary.id));
      checked++;
    }
    expect(checked).toBeGreaterThan(30_000);
  });

  it('links a card to its paper at the question, and nothing for unknown papers', () => {
    const papers = manifests.find(m => m.bankSlug === 'igcse-chemistry-0620')!.papers.map(p => p.summary);
    const hrefs = fullPaperHrefs(papers);
    expect(fullPaperQuestionHref(hrefs, '0620-2019-m-12-q7', 7)).toMatch(/^\/past-papers\/[a-z0-9-]+\/[a-z0-9-]+#q7$/);
    expect(fullPaperQuestionHref(hrefs, '0620-1999-m-12-q7', 7)).toBeUndefined();
    expect(fullPaperQuestionHref(undefined, '0620-2019-m-12-q7', 7)).toBeUndefined();
  });

  it('maps question numbers to pages only where the page is known', () => {
    expect(questionPages([{ id: 'a-q1', number: 1, marks: 2, topics: [], page: 3 }, { id: 'a-q2', number: 2, marks: 2, topics: [] }])).toEqual({ 1: 3 });
  });

  it('summarises topics most-tested first, keeping paper order for ties', () => {
    const q = (number: number, topics: string[]) => ({ id: `p-q${number}`, number, marks: 1, topics });
    expect(paperTopicSummary([q(2, ['Metals', 'Acids']), q(1, ['Acids']), q(3, ['Rates'])])).toEqual([
      { topic: 'Acids', numbers: [1, 2] }, { topic: 'Metals', numbers: [2] }, { topic: 'Rates', numbers: [3] },
    ]);
  });
});
