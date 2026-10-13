// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { FREE_PAPER_ORIGIN, approvedPapers, objectDownloadNames, paperDownloadName, paperMappingDigest, paperObjectKey, paperObjectUrl, paperObjectsDigest, sharedDownloadName, validPublicReadback } from './whole-paper-public';
import type { WholePaperManifest, WholePaperSummary } from './whole-paper-types';

const sha = 'a'.repeat(64);
const igcse = { id: 'paper-2023-42', syllabusCode: '0580', qualification: 'Cambridge IGCSE', sessionCode: 's', year: 2023, component: '42' } as WholePaperSummary;
const ib = { id: '2021-may-tz1-p1', bankSlug: 'ib-hl', syllabusCode: 'Mathematics AA HL', qualification: 'IB Diploma', session: 'May', sessionCode: 'may', year: 2021, paper: '1', component: '1', variant: 'TZ1' } as WholePaperSummary;

describe('public paper objects', () => {
  it('addresses each PDF by content on the public free origin', () => {
    expect(FREE_PAPER_ORIGIN).toBe('https://free.pastpaperprep.com');
    expect(paperObjectKey(sha)).toBe(`papers/v1/${sha}.pdf`);
    expect(paperObjectUrl(sha)).toBe(`https://free.pastpaperprep.com/papers/v1/${sha}.pdf`);
    expect(() => paperObjectKey('../secret')).toThrow();
  });
  it('names downloads the way students search for them', () => {
    expect(paperDownloadName(igcse, 'question')).toBe('0580_s23_qp_42.pdf');
    expect(paperDownloadName(igcse, 'markscheme')).toBe('0580_s23_ms_42.pdf');
    expect(paperDownloadName(ib, 'markscheme')).toBe('ib-math-aa-hl-2021-may-paper-1-tz1_ms.pdf');
  });
  it('digests the approved set independent of order and sensitive to every byte count', () => {
    const b = 'b'.repeat(64);
    const one = paperObjectsDigest(new Map([[sha, 10], [b, 20]]));
    expect(paperObjectsDigest(new Map([[b, 20], [sha, 10]]))).toBe(one);
    expect(one).toBe(createHash('sha256').update(`${sha} 10\n${b} 20\n`).digest('hex'));
    expect(paperObjectsDigest(new Map([[sha, 10], [b, 21]]))).not.toBe(one);
  });
  it('seals each bank/paper/role assignment, so swapping question and mark scheme changes the seal', () => {
    const b = 'b'.repeat(64);
    const refs = [{ bankSlug: 'ib-economics-sl', paperId: 'p2', kind: 'question' as const, sha256: sha, bytes: 10 }, { bankSlug: 'ib-economics-sl', paperId: 'p2', kind: 'markscheme' as const, sha256: b, bytes: 20 }];
    const swapped = [{ ...refs[0], sha256: b, bytes: 20 }, { ...refs[1], sha256: sha, bytes: 10 }];
    expect(paperMappingDigest([...refs].reverse())).toBe(paperMappingDigest(refs));
    expect(paperMappingDigest(swapped)).not.toBe(paperMappingDigest(refs));
    expect(paperObjectsDigest(new Map(swapped.map(r => [r.sha256, r.bytes])))).toBe(paperObjectsDigest(new Map(refs.map(r => [r.sha256, r.bytes]))));
  });
  it('gives a PDF shared by HL and SL one level-neutral name', () => {
    expect(sharedDownloadName(['ib-economics-hl-2024-may-paper-2-tz1_qp.pdf', 'ib-economics-sl-2024-may-paper-2-tz1_qp.pdf'])).toBe('ib-economics-2024-may-paper-2-tz1_qp.pdf');
    expect(sharedDownloadName(['0580_s23_qp_42.pdf', '0580_s23_qp_42.pdf'])).toBe('0580_s23_qp_42.pdf');
    expect(() => sharedDownloadName(['0580_s23_qp_42.pdf', '0580_s23_qp_43.pdf'])).toThrow();
  });
});

describe('public readback receipt', () => {
  const receipt = { version: 3, status: 'verified_public_readback', origin: FREE_PAPER_ORIGIN, prefix: 'papers/v1/', verifiedAt: '2026-10-13T00:00:00.000Z', objectCount: 2, objectsSha256: sha, mappingSha256: sha };
  it('accepts only a complete public readback for the free origin', () => {
    expect(validPublicReadback(receipt)).toBe(true);
    for (const bad of [{ ...receipt, status: 'pending_upload' }, { ...receipt, origin: 'https://example.com' }, { ...receipt, prefix: 'images/' }, { ...receipt, version: 2 }, { ...receipt, mappingSha256: undefined }, { ...receipt, objectCount: 0 }, { ...receipt, objectsSha256: 'A'.repeat(64) }, { ...receipt, verifiedAt: 'soon' }, { ...receipt, extra: true }, null, []]) {
      expect(validPublicReadback(bad)).toBe(false);
    }
  });
});

describe('committed public readback', () => {
  it('covers exactly the PDFs and bank/paper/role assignments the committed manifests approve (re-publish and re-verify after any manifest change)', () => {
    const dir = 'src/data/paper-archives';
    const manifests = readdirSync(dir).filter(f => f.endsWith('.json')).map(file => JSON.parse(readFileSync(join(dir, file), 'utf8')) as WholePaperManifest);
    const { sizes, refs } = approvedPapers(manifests);
    const receipt: unknown = JSON.parse(readFileSync('src/data/paper-archive-readback.json', 'utf8'));
    expect(validPublicReadback(receipt)).toBe(true);
    expect(receipt).toMatchObject({ objectCount: sizes.size, objectsSha256: paperObjectsDigest(sizes), mappingSha256: paperMappingDigest(refs) });
  });
  it('names every shared PDF without a level', () => {
    const dir = 'src/data/paper-archives';
    const manifests = readdirSync(dir).filter(f => f.endsWith('.json')).map(file => JSON.parse(readFileSync(join(dir, file), 'utf8')) as WholePaperManifest);
    const papers = approvedPapers(manifests);
    const names = objectDownloadNames(papers);
    const shared = [...papers.names].filter(([, all]) => new Set(all).size > 1);
    expect(shared.length).toBeGreaterThan(0);
    for (const [sha] of shared) expect(names.get(sha)).not.toMatch(/-(hl|sl)-/);
  });
});
