// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BANK_CATALOG } from './catalog';
import type { WholePaperManifest } from './whole-paper-types';
import { SUBJECT_SLUGS, bankForSubjectSlug, buildPaperMatrix, chipLabel, fileAliases, matchPapers, paperName, paperSlug, parsePaperQuery, subjectSlugForBank } from './past-paper-catalog';

const papers = (slug: string) => (JSON.parse(readFileSync(join(process.cwd(), 'src/data/paper-archives', `${slug}.json`), 'utf8')) as WholePaperManifest).papers.map(p => p.summary);
const find = (slug: string, id: string) => papers(slug).find(p => p.id === id)!;

describe('public past-paper slugs', () => {
  it('maps every bank to a unique, reversible subject slug', () => {
    expect(new Set(BANK_CATALOG.map(b => subjectSlugForBank(b.slug))).size).toBe(BANK_CATALOG.length);
    for (const b of BANK_CATALOG) expect(bankForSubjectSlug(subjectSlugForBank(b.slug))).toBe(b.slug);
    expect(SUBJECT_SLUGS.igcse).toBe('igcse-maths-0580');
    expect(SUBJECT_SLUGS['ib-hl']).toBe('ib-math-aa-hl');
    expect(bankForSubjectSlug('igcse')).toBeNull();
  });

  it('gives every real paper a unique slug within its bank', () => {
    for (const b of BANK_CATALOG) {
      const list = papers(b.slug);
      const slugs = list.map(paperSlug);
      expect(new Set(slugs).size, b.slug).toBe(list.length);
      for (const s of slugs) expect(s).toMatch(/^\d{4}-[a-z0-9-]+$/);
    }
  });

  it('builds readable IGCSE and IB slugs, chips, names and file names', () => {
    const igcse = find('igcse', '0580-2024-june-42');
    expect(paperSlug(igcse)).toBe('2024-may-june-42');
    expect(chipLabel(igcse)).toBe('42');
    expect(paperName(igcse)).toBe('Paper 42');
    expect(fileAliases(igcse)).toEqual({ question: '0580_s24_qp_42', markscheme: '0580_s24_ms_42' });
    const ib = find('ib-sl', '2017-may-p1-tz1');
    expect(paperSlug(ib)).toBe('2017-may-paper-1-tz1');
    expect(chipLabel(ib)).toBe('TZ1');
    expect(fileAliases(ib)).toBeNull();
    const option = find('ib-hl', '2017-may-tz0-p3-calculus');
    expect(paperSlug(option)).toBe('2017-may-paper-3-calculus');
    expect(chipLabel(option)).toBe('Calculus');
    expect(paperName(option)).toBe('Paper 3 Calculus');
    expect(paperSlug(papers('ib-biology-hl').find(p => p.paper === '1a')!)).toMatch(/-paper-1a(-tz\d)?$/);
    const noZone = find('ib-sl', '2017-november-p1-tzn');
    expect([paperSlug(noZone), chipLabel(noZone), paperName(noZone)]).toEqual(['2017-november-paper-1', 'P1', 'Paper 1']);
  });
});

describe('paper matrix', () => {
  it('groups 0580 by year and session, newest first, with Paper 1-4 columns', () => {
    const m = buildPaperMatrix(papers('igcse'), 'igcse-maths-0580');
    expect(m.columns.map(c => c.label)).toEqual(['Paper 1', 'Paper 2', 'Paper 3', 'Paper 4']);
    expect(m.columns[3]).toMatchObject({ note: 'Extended', href: '/past-papers/igcse-maths-0580/paper-4' });
    expect(m.years[0].year).toBe(2026);
    expect(m.years[0].rows[0]).toMatchObject({ session: 'May/June', latest: true });
    expect(m.years[0].rows.slice(1).every(r => !r.latest)).toBe(true);
    expect(m.years[1].rows.map(r => r.label)).toEqual(['Oct/Nov', 'May/June', 'Feb/March']);
    const may26 = m.years[0].rows[0];
    expect(may26.cells[1].map(l => l.label)).toEqual(['21', '22', '23']);
    expect(may26.cells[0]).toEqual([]);
    expect(may26.cells[1][0]).toMatchObject({ href: '/past-papers/igcse-maths-0580/2026-may-june-21', markPrefix: 'pastpaperprep:marks:igcse:0580-2026-june-21:', route: 'Extended', title: 'Paper 21, May/June 2026' });
    expect(m.total).toBe(216);
    expect(m.tiers).toBe(true);
  });

  it('sorts IB timezones and has no tiers', () => {
    const m = buildPaperMatrix(papers('ib-sl'), 'ib-math-aa-sl');
    expect(m.tiers).toBe(false);
    expect(m.columns.map(c => c.label)).toEqual(['Paper 1', 'Paper 2']);
    const cell = m.years.flatMap(y => y.rows).find(r => r.cells[0].length > 1)!.cells[0].map(l => l.label);
    expect(cell).toEqual([...cell].sort());
  });

  it('sorts split papers after their parent number and marks practicals as shared', () => {
    expect(buildPaperMatrix(papers('ib-biology-hl'), 'ib-biology-hl').columns.map(c => c.paper)).toEqual(['1', '1a', '1b', '2', '3']);
    const chem = buildPaperMatrix(papers('igcse-chemistry-0620'), 'igcse-chemistry-0620');
    expect(chem.columns.map(c => c.note)).toEqual(['Core', 'Extended', 'Core', 'Extended', 'Core & Extended', 'Core & Extended']);
  });
});

describe('paper code search', () => {
  const list = papers('igcse');
  const top = (q: string, n = 3) => matchPapers(list, parsePaperQuery(q), n).map(paperSlug);
  it.each([
    ['0580/42/M/J/24', '2024-may-june-42'],
    ['0580_s24_qp_42', '2024-may-june-42'],
    ['0580_w23_ms_41', '2023-oct-nov-41'],
    ['s24 42', '2024-may-june-42'],
    ['may june 2024 42', '2024-may-june-42'],
    ['feb march 2025 paper 2', '2025-feb-march-22'],
    ['s24 p42', '2024-may-june-42'],
    ['0580 s24 p42', '2024-may-june-42'],
    ['p42 2024 june', '2024-may-june-42'],
    ['0580/42/MJ/24', '2024-may-june-42'],
    ['0580 42 mj 24', '2024-may-june-42'],
    ['june 24 42', '2024-may-june-42'],
    ['42 m/j 24', '2024-may-june-42'],
    ['paper 42 on 23', '2023-oct-nov-42'],
  ])('finds %s', (q, slug) => { expect(top(q)[0]).toBe(slug); });

  it('lists every variant for a partial query', () => {
    expect(top('oct nov 2025 paper 4')).toEqual(['2025-oct-nov-41', '2025-oct-nov-42', '2025-oct-nov-43']);
  });

  it('returns nothing for empty, junk or impossible queries', () => {
    expect(top('')).toEqual([]);
    expect(top('banana')).toEqual([]);
    expect(top('1999 paper 9')).toEqual([]);
    expect(top('asdf 99')).toEqual([]);
    expect(top('0580 7')).toEqual([]);
  });

  it('understands IB sessions and timezones', () => {
    const ib = papers('ib-sl');
    expect(matchPapers(ib, parsePaperQuery('may 2017 paper 1 tz2')).map(paperSlug)[0]).toBe('2017-may-paper-1-tz2');
    const nov = matchPapers(ib, parsePaperQuery('nov 2019 p2'));
    expect(nov.length).toBeGreaterThan(0);
    expect(nov.every(p => p.session === 'November' && p.year === 2019 && p.paper === '2')).toBe(true);
  });
});
