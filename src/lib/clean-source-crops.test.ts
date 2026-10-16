import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { BankSlug } from '@/lib/banks';
import { cleanSourceCropPaths } from '@/lib/clean-source-crops';
import { normalizeBankQuestions, type UnifiedQuestion } from '@/lib/questions';
import chemistry from '@/data/production/igcse-chemistry-0620.json';

type Entry = { oldSha256: string; sha256: string };
const projection = JSON.parse(readFileSync('src/data/reviewed-clean-source-crops.json', 'utf8')) as { namespace: string; banks: Record<string, Record<string, Entry>> };
const entries = projection.banks['igcse-chemistry-0620'];
const prefix = 'igcse-chemistry-0620/releases/candidate-v2-6eeb3fccddb4/';
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const ignored = new Set(['questionImages', 'questionAssetPaths', 'markschemeImages', 'markschemeAssetPaths']);
const stable = (q: UnifiedQuestion) => Object.fromEntries(Object.entries(q).filter(([k]) => !ignored.has(k)));
const normalize = () => normalizeBankQuestions('igcse-chemistry-0620', chemistry.questions as Array<Record<string, unknown>>, { economicsAssetMode: 'private', applyReviewedBlankPages: true });

describe('clean source crops for PapaCambridge-watermarked May/June 2026 Chemistry', () => {
  it('names a content-addressed namespace and only 0620 May/June 2026 crops', () => {
    expect(Object.keys(projection.banks)).toEqual(['igcse-chemistry-0620']);
    const canonical = Object.fromEntries(Object.keys(entries).sort().map((k) => [k, { oldSha256: entries[k].oldSha256, sha256: entries[k].sha256 }]));
    const digest = sha(Buffer.from(JSON.stringify({ 'igcse-chemistry-0620': canonical })));
    expect(projection.namespace).toMatch(/^repairs\/clean-source-v1-[a-f0-9]{16}$/);
    expect(projection.namespace.endsWith(digest.slice(0, 16))).toBe(true);
    expect(Object.keys(entries)).toHaveLength(1025);
    for (const path of Object.keys(entries)) expect(path).toMatch(/^(?:(?:questions|markschemes)\/0620-2026-s-\d\d\/|repairs\/(?:mcq-answer-v2|science-written-v1)-[a-f0-9]{16}\/)/);
  });

  it('moves every watermarked live image of the 303 questions and nothing else', () => {
    const frozen = JSON.stringify(chemistry);
    const after = normalize();
    const replaced = new Set(Object.keys(entries).map((path) => prefix + path));
    const moved = after.flatMap((q) => [...q.questionAssetPaths, ...q.markschemeAssetPaths]).filter((key) => key.startsWith(prefix + projection.namespace + '/'));
    // 29 clean re-renders are of BLANK PAGE images, which the 2026-10-15 audit hides altogether.
    const blank = JSON.parse(readFileSync('src/data/reviewed-blank-qp.json', 'utf8')).entries['igcse-chemistry-0620'] as Record<string, Array<{ path: string }>>;
    const hidden = new Set(Object.values(blank).flat().map((item) => item.path));
    const hiddenClean = Object.keys(entries).filter((path) => hidden.has(path));
    expect(hiddenClean).toHaveLength(29);
    expect(hiddenClean.every((path) => path.startsWith('questions/0620-2026-s-'))).toBe(true);
    expect(moved).toHaveLength(1025 - hiddenClean.length);
    for (const q of after) {
      for (const key of [...q.questionAssetPaths, ...q.markschemeAssetPaths]) {
        expect(replaced.has(key)).toBe(false);
        if (key.includes('/clean-source-v1-')) expect(q.id).toMatch(/^0620-2026-s-/);
      }
    }
    expect(after.filter((q) => q.id.startsWith('0620-2026-s-'))).toHaveLength(303);
    expect(JSON.stringify(chemistry)).toBe(frozen);
  });

  it('keeps question order, counts and every non-image field, and swaps only reviewed paths', async () => {
    const after = normalize();
    vi.resetModules();
    vi.doMock('@/data/reviewed-clean-source-crops.json', () => ({ default: { namespace: projection.namespace, banks: {} } }));
    const unprojected = await import('@/lib/questions');
    const before = unprojected.normalizeBankQuestions('igcse-chemistry-0620', chemistry.questions as Array<Record<string, unknown>>, { economicsAssetMode: 'private', applyReviewedBlankPages: true });
    vi.doUnmock('@/data/reviewed-clean-source-crops.json');
    expect(after.map((q) => q.id)).toEqual(before.map((q) => q.id));
    const swapped = (key: string) => {
      const entry = entries[key.slice(prefix.length)];
      return entry ? `${prefix}${projection.namespace}/${entry.sha256}.webp` : key;
    };
    for (let i = 0; i < after.length; i++) {
      expect(stable(after[i])).toEqual(stable(before[i]));
      expect(after[i].questionAssetPaths).toEqual(before[i].questionAssetPaths.map(swapped));
      expect(after[i].markschemeAssetPaths).toEqual(before[i].markschemeAssetPaths.map(swapped));
    }
  });

  it('passes other banks and unknown paths through', () => {
    for (const bank of ['igcse-biology-0610', 'igcse-physics-0625', 'igcse'] as BankSlug[]) {
      expect(cleanSourceCropPaths(bank, ['questions/0620-2026-s-41/q2-4-1.webp'])).toEqual(['questions/0620-2026-s-41/q2-4-1.webp']);
    }
    expect(cleanSourceCropPaths('igcse-chemistry-0620', ['questions/0620-2025-s-41/q2-4-1.webp', 'constructor'])).toEqual(['questions/0620-2025-s-41/q2-4-1.webp', 'constructor']);
    expect(cleanSourceCropPaths('igcse-chemistry-0620', ['questions/0620-2026-s-41/q2-4-1.webp'])).toEqual([`${projection.namespace}/${entries['questions/0620-2026-s-41/q2-4-1.webp'].sha256}.webp`]);
  });

  it('records the old live hashes from the sealed storage manifests', () => {
    const live = new Map<string, string>();
    for (const file of ['igcse-chemistry-0620', 'science-mcq-row-repairs', 'science-written-answer-repairs']) {
      const manifest = JSON.parse(readFileSync(`data/storage/${file}.manifest.json`, 'utf8')) as { assets?: Array<{ objectKey: string; sha256: string }>; objects?: Array<{ objectKey: string; sha256: string }> };
      for (const asset of manifest.assets ?? manifest.objects ?? []) live.set(asset.objectKey, asset.sha256);
    }
    for (const [path, entry] of Object.entries(entries)) expect(live.get(prefix + path)).toBe(entry.oldSha256);
  });

  it('pins every clean object to a complete remote readback receipt', () => {
    const bytes = readFileSync('data/storage/clean-source-crops.manifest.json');
    const manifest = JSON.parse(bytes.toString()) as { objectCount: number; objects: Array<{ objectKey: string; sha256: string; bytes: number }> };
    const receipt = JSON.parse(readFileSync('data/storage/clean-source-crops.receipt.json', 'utf8')) as { state: string; manifestSha256: string; records: Array<{ objectKey: string; sha256: string; bytes: number; contentType: string }> };
    expect(receipt.state).toBe('verified_readback');
    expect(receipt.manifestSha256).toBe(sha(bytes));
    const remote = new Map(receipt.records.map((r) => [r.objectKey, r]));
    expect(remote.size).toBe(manifest.objectCount);
    for (const o of manifest.objects) expect(remote.get(o.objectKey)).toEqual({ objectKey: o.objectKey, sha256: o.sha256, bytes: o.bytes, contentType: 'image/webp' });
    for (const entry of Object.values(entries)) expect(remote.has(`${prefix}${projection.namespace}/${entry.sha256}.webp`)).toBe(true);
  });
});
