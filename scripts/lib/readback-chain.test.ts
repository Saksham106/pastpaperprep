// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { FREE_PAPER_ORIGIN, validPublicReadback, type PublicReadback } from '../../src/lib/whole-paper-public';
import { chainedReceipt, checkedBaseReceipt, incrementalTargets, type ApprovedObjects } from './readback-chain';

const sha = (n: number) => n.toString(16).padStart(64, '0');
const digest = (c: string) => c.repeat(64);
function approved(entries: [number, number, string][], d = 'a'): ApprovedObjects {
  return { objects: new Map(entries.map(([n, bytes, name]) => [sha(n), { bytes, name }])), objectsSha256: digest(d), mappingSha256: digest(d) };
}
const receipt = (a: ApprovedObjects, verifiedAt = '2026-11-01T00:00:00.000Z'): PublicReadback => ({
  version: 3, status: 'verified_public_readback', origin: FREE_PAPER_ORIGIN, prefix: 'papers/v1/', verifiedAt,
  objectCount: a.objects.size, objectsSha256: a.objectsSha256, mappingSha256: a.mappingSha256,
});
const base = approved([[1, 10, 'a.pdf'], [2, 20, 'b.pdf'], [3, 30, 'c.pdf'], [4, 40, 'd.pdf']]);

describe('checkedBaseReceipt', () => {
  it('accepts only a valid receipt that covers exactly the base manifests', () => {
    expect(checkedBaseReceipt(receipt(base), base)).toEqual(receipt(base));
    expect(() => checkedBaseReceipt(null, base)).toThrow(/missing or malformed/);
    expect(() => checkedBaseReceipt({ ...receipt(base), extra: 1 }, base)).toThrow(/missing or malformed/);
    for (const stale of [{ objectCount: 3 }, { objectsSha256: digest('b') }, { mappingSha256: digest('b') }]) {
      expect(() => checkedBaseReceipt({ ...receipt(base), ...stale }, base)).toThrow(/doesn't match the base manifests/);
    }
  });
});

describe('incrementalTargets', () => {
  it('fetches every added object and a sample of kept ones, and reports removed ones', () => {
    const now = approved([[2, 20, 'b.pdf'], [3, 30, 'c.pdf'], [4, 40, 'd.pdf'], [6, 60, 'f.pdf'], [5, 50, 'e.pdf']], 'b');
    const t = incrementalTargets(base, now, 2, () => 0);
    expect(t.added).toEqual([sha(5), sha(6)]);
    expect(t.removed).toEqual([sha(1)]);
    expect(t.sampled).toHaveLength(2);
    for (const s of t.sampled) expect([sha(2), sha(3), sha(4)]).toContain(s);
  });

  it('samples without repeats and caps the sample at the kept objects', () => {
    const now = approved([[1, 10, 'a.pdf'], [2, 20, 'b.pdf'], [3, 30, 'c.pdf'], [4, 40, 'd.pdf']]);
    const all = incrementalTargets(base, now, 99);
    expect(all.sampled).toEqual([sha(1), sha(2), sha(3), sha(4)]);
    expect(all.added).toEqual([]);
    expect(incrementalTargets(base, now, 0).sampled).toEqual([]);
    const picks = incrementalTargets(base, now, 3, max => max - 1);
    expect(new Set(picks.sampled).size).toBe(3);
  });

  it('refuses when an object approved at base changes size or download name', () => {
    expect(() => incrementalTargets(base, approved([[1, 11, 'a.pdf'], [2, 20, 'b.pdf']]), 0)).toThrow(new RegExp(`changed size or filename.*${sha(1)}`));
    expect(() => incrementalTargets(base, approved([[1, 10, 'a.pdf'], [2, 20, 'renamed.pdf']]), 0)).toThrow(new RegExp(sha(2)));
    expect(() => incrementalTargets(base, base, -1)).toThrow(/Invalid sample/);
  });
});

describe('chainedReceipt', () => {
  it('describes the current manifests and records the receipt it chains from', () => {
    const now = approved([[1, 10, 'a.pdf'], [2, 20, 'b.pdf'], [3, 30, 'c.pdf'], [4, 40, 'd.pdf'], [5, 50, 'e.pdf']], 'c');
    const first = chainedReceipt(now, receipt(base), { added: [sha(5)], sampled: [sha(1), sha(2)], removed: [] }, '2026-11-24T00:00:00.000Z');
    expect(validPublicReadback(first)).toBe(true);
    expect(first).toMatchObject({
      objectCount: 5, objectsSha256: digest('c'), mappingSha256: digest('c'), verifiedAt: '2026-11-24T00:00:00.000Z',
      incremental: { since: { verifiedAt: '2026-11-01T00:00:00.000Z', objectCount: 4, objectsSha256: digest('a'), mappingSha256: digest('a') }, fullReadbackAt: '2026-11-01T00:00:00.000Z', added: 1, sampled: 2 },
    });
    // A chain of incremental receipts keeps pointing at the last full readback.
    const second = chainedReceipt(now, first, { added: [], sampled: [sha(3)], removed: [] }, '2026-11-25T00:00:00.000Z');
    expect(validPublicReadback(second)).toBe(true);
    expect(second.incremental).toMatchObject({ since: { verifiedAt: '2026-11-24T00:00:00.000Z' }, fullReadbackAt: '2026-11-01T00:00:00.000Z', added: 0, sampled: 1 });
  });
});
