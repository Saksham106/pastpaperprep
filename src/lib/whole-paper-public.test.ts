// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { FREE_PAPER_ORIGIN, paperDownloadName, paperObjectKey, paperObjectUrl, paperObjectsDigest, validPublicReadback } from './whole-paper-public';
import type { WholePaperSummary } from './whole-paper-types';

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
});

describe('public readback receipt', () => {
  const receipt = { version: 2, status: 'verified_public_readback', origin: FREE_PAPER_ORIGIN, prefix: 'papers/v1/', verifiedAt: '2026-10-13T00:00:00.000Z', objectCount: 2, objectsSha256: sha };
  it('accepts only a complete public readback for the free origin', () => {
    expect(validPublicReadback(receipt)).toBe(true);
    for (const bad of [{ ...receipt, status: 'pending_upload' }, { ...receipt, origin: 'https://example.com' }, { ...receipt, prefix: 'images/' }, { ...receipt, version: 1 }, { ...receipt, objectCount: 0 }, { ...receipt, objectsSha256: 'A'.repeat(64) }, { ...receipt, verifiedAt: 'soon' }, { ...receipt, extra: true }, null, []]) {
      expect(validPublicReadback(bad)).toBe(false);
    }
  });
});
