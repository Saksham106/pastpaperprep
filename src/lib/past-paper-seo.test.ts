// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getCatalogBank } from './catalog';
import { breadcrumbJsonLd, collectionJsonLd, faqJsonLd, hubCopy, paperCopy, paperJsonLd, paperNumberCopy, subjectCopy, subjectFaq, subjectSearchName, yearCopy } from './past-paper-seo';
import type { WholePaperSummary } from './whole-paper-types';

const ext: WholePaperSummary = { id: '0580-2024-june-42', bankSlug: 'igcse', title: 'Mathematics 0580 · May/June 2024 · Paper 42', qualification: 'Cambridge IGCSE', subject: 'Mathematics', syllabusCode: '0580', year: 2024, session: 'May/June', sessionCode: 's', component: '42', paper: '4', variant: '2', route: 'Extended', durationMinutes: 150, maxMarks: 130, questionCount: 20, reportAvailable: true, metadataVerified: true };
const core: WholePaperSummary = { ...ext, id: '0580-2016-june-12', year: 2016, component: '12', paper: '1', variant: '2', route: 'Core', durationMinutes: 60, maxMarks: 56 };
const ib: WholePaperSummary = { ...ext, id: '2024-may-tz1-p1', bankSlug: 'ib-hl', title: 'IB Mathematics AA Higher Level · May 2024 · Paper P1', qualification: 'IB Diploma', subject: 'Mathematics AA', syllabusCode: 'AA', session: 'May', sessionCode: 'may', component: 'P1', paper: '1', variant: 'tz1', route: 'HL', durationMinutes: 120, maxMarks: 110 };
const bank = getCatalogBank('igcse')!;
const titles = [hubCopy(2463), subjectCopy(bank, [ext, core]), yearCopy(bank, 2024, [ext]), paperNumberCopy(bank, '4', [ext]), paperCopy(bank, ext)].map(c => c.title);

describe('names students search for', () => {
  it.each([
    ['igcse', 'IGCSE Maths 0580'],
    ['igcse-additional', 'IGCSE Additional Maths 0606'],
    ['igcse-chemistry-0620', 'IGCSE Chemistry 0620'],
    ['ib-hl', 'IB Math AA HL'],
    ['ib-ai-sl', 'IB Math AI SL'],
    ['ib-chemistry-sl', 'IB Chemistry SL'],
  ] as const)('%s → %s', (slug, name) => { expect(subjectSearchName(getCatalogBank(slug)!)).toBe(name); });
});

describe('page copy', () => {
  it('writes titles from real counts without the layout suffix', () => {
    expect(titles).toEqual([
      'Free IGCSE & IB Past Papers with Mark Schemes',
      'IGCSE Maths 0580 Past Papers & Mark Schemes (2016–2024)',
      'IGCSE Maths 0580 Past Papers 2024: All Sessions & Mark Schemes',
      'IGCSE Maths 0580 Paper 4 Past Papers (Extended), All Years',
      '0580/42 May/June 2024: IGCSE Maths Paper 4 & Mark Scheme',
    ]);
    for (const title of titles) expect(title).not.toMatch(/PastPaperPrep/);
  });

  it('answers the query in the first sentence', () => {
    expect(subjectCopy(bank, [ext, core]).answer).toBe('2 Cambridge IGCSE Mathematics (0580) past papers from 2016 to 2024, each with its mark scheme. Free, no sign-up.');
    expect(subjectCopy(bank, [ext]).answer).toBe('1 Cambridge IGCSE Mathematics (0580) past paper from 2024, with its mark scheme. Free, no sign-up.');
    expect(subjectCopy(bank, [ext, core]).h1).toBe('IGCSE Maths 0580 past papers');
    expect(yearCopy(bank, 2024, [ext, { ...ext, session: 'October/November', sessionCode: 'w' }]).answer).toBe('2 Cambridge IGCSE Mathematics (0580) past papers from 2024: May/June and October/November, each with its mark scheme.');
  });

  it('names IB papers with their timezone', () => {
    const copy = paperCopy(getCatalogBank('ib-hl')!, ib);
    expect(copy.title).toBe('IB Math AA HL May 2024 Paper 1 TZ1: Paper & Markscheme');
    expect(copy.h1).toBe('May 2024 Paper 1 TZ1');
  });

  it('mentions duration and marks only when verified', () => {
    expect(paperCopy(bank, ext).description).toBe('Cambridge IGCSE Mathematics 0580 Paper 42, May/June 2024, with its mark scheme. 2 hours 30 minutes, 130 marks. Time it, mark it and see which topics to fix.');
    expect(paperCopy(bank, { ...ext, durationMinutes: null, maxMarks: null }).description).toBe('Cambridge IGCSE Mathematics 0580 Paper 42, May/June 2024, with its mark scheme. Time it, mark it and see which topics to fix.');
  });

  it('labels a qualification hub', () => {
    expect(hubCopy(1200, 'igcse')).toMatchObject({ title: 'Cambridge IGCSE Past Papers with Mark Schemes', h1: 'Cambridge IGCSE past papers' });
    expect(hubCopy(1200, 'ib').title).toBe('IB Past Papers with Markschemes');
  });
});

describe('FAQ', () => {
  it('builds answers only from the papers', () => {
    const faq = subjectFaq(bank, [ext, core]);
    expect(faq.map(f => f.q)).toEqual([
      'Where can I find 0580 past papers with mark schemes?',
      'What do the 0580 paper numbers mean?',
      'Which 0580 papers do Core and Extended students take?',
      'How do I mark a past paper here?',
    ]);
    expect(faq[2].a).toBe('Core students take Paper 1. Extended students take Paper 4.');
  });

  it('explains shared papers and IB timezones', () => {
    const shared = { ...core, id: '0620-2024-june-62', bankSlug: 'igcse-chemistry-0620' as const, syllabusCode: '0620', subject: 'Chemistry', component: '62', paper: '6', route: 'Shared' as const };
    const chem = getCatalogBank('igcse-chemistry-0620')!;
    const faq = subjectFaq(chem, [{ ...ext, bankSlug: 'igcse-chemistry-0620', syllabusCode: '0620', subject: 'Chemistry' }, { ...core, bankSlug: 'igcse-chemistry-0620', syllabusCode: '0620', subject: 'Chemistry' }, shared]);
    expect(faq[2].a).toBe('Core students take Paper 1. Extended students take Paper 4. Paper 6 is taken by both.');
    const ibFaq = subjectFaq(getCatalogBank('ib-hl')!, [ib]);
    expect(ibFaq.map(f => f.q)).toContain('What do TZ1 and TZ2 mean on IB papers?');
    expect(ibFaq.some(f => f.q.includes('Core'))).toBe(false);
  });
});

describe('structured data', () => {
  it('describes a paper as a free learning resource without claiming authorship', () => {
    const ld = paperJsonLd(bank, ext, '/past-papers/igcse-maths-0580/2024-may-june-42');
    expect(ld).toMatchObject({ '@context': 'https://schema.org', '@type': 'LearningResource', isAccessibleForFree: true, timeRequired: 'PT2H30M', inLanguage: 'en', learningResourceType: 'Past exam paper', url: 'https://pastpaperprep.com/past-papers/igcse-maths-0580/2024-may-june-42' });
    expect(ld).not.toHaveProperty('author');
    expect(paperJsonLd(bank, { ...ext, durationMinutes: null }, '/x')).not.toHaveProperty('timeRequired');
  });

  it('builds breadcrumb, collection and FAQ objects', () => {
    expect(breadcrumbJsonLd([{ name: 'Past papers', path: '/past-papers' }, { name: 'IGCSE Maths 0580', path: '/past-papers/igcse-maths-0580' }])).toMatchObject({ '@type': 'BreadcrumbList', itemListElement: [{ position: 1, name: 'Past papers', item: 'https://pastpaperprep.com/past-papers' }, { position: 2 }] });
    const copy = subjectCopy(bank, [ext]);
    expect(collectionJsonLd(copy, '/past-papers/igcse-maths-0580', [{ name: 'Paper 42', path: '/p' }])).toMatchObject({ '@type': 'CollectionPage', name: copy.title, mainEntity: { '@type': 'ItemList', numberOfItems: 1, itemListElement: [{ '@type': 'ListItem', position: 1, url: 'https://pastpaperprep.com/p' }] } });
    expect(faqJsonLd([{ q: 'Q?', a: 'A.' }])).toMatchObject({ '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'Q?', acceptedAnswer: { '@type': 'Answer', text: 'A.' } }] });
  });
});
