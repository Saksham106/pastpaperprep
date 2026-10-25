import { describe, expect, test, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { reviewedEconomicsQuestionPaths } from '@/lib/reviewed-economics-question-crops';
import { loadBankQuestions } from '@/lib/question-loader';
import { normalizeBankQuestions } from '@/lib/questions';
import { getPrivateBankObjectPrefix } from '@/lib/private-runtime-mapping';
import { isPreviewQuestion } from '@/lib/access';
import { metadataFromRaw } from '../../scripts/generate-bank-index.mjs';

type Entry = { oldPaths: string[]; oldSha256: string[]; newPaths: string[]; sha256: string[]; sourcePdfSha256: string };
type Row = { id: string; paper: number; number: number; questionImages: string[]; questionImageHashes: string[]; markschemeImages: string[] };
const bank = 'igcse-economics-0455';
const overlay = JSON.parse(readFileSync('src/data/reviewed-economics-question-crop-repairs.json', 'utf8')) as { bank: string; namespace: string; sourceReceiptSha256: string; entries: Record<string, Entry> };
const manifestBytes = readFileSync('data/storage/economics-q1-source-repairs.manifest.json');
const manifest = JSON.parse(manifestBytes.toString());
const runtime = JSON.parse(readFileSync(`src/data/production/${bank}.json`, 'utf8')) as { questions: Row[] };
const LIVE_IDS = [
  '0455-2020-w-23-q1', '0455-2022-m-22-q1', '0455-2022-s-22-q1', '0455-2022-w-21-q1', '0455-2024-s-22-q1',
  '0455-2024-w-21-q1', '0455-2024-w-22-q1', '0455-2024-w-23-q1', '0455-2025-m-22-q1', '0455-2025-s-21-q1',
  '0455-2025-s-22-q1', '0455-2025-w-21-q1', '0455-2025-w-22-q1',
];
const normalize = (rows: Row[]) => normalizeBankQuestions(bank, rows as unknown as Array<Record<string, unknown>>, { economicsAssetMode: 'private', applyReviewedBlankPages: true });

describe('reviewed 0455 Paper 2 Q1 source-material crops', () => {
  test('overlay binds exactly the 13 live Q1 rows, one SHA-named anchor-page crop each', () => {
    expect(overlay.bank).toBe(bank);
    expect(overlay.namespace).toBe(`repairs/economics-q1-source-v1-${overlay.sourceReceiptSha256.slice(0, 16)}`);
    expect(Object.keys(overlay.entries)).toEqual(LIVE_IDS);
    const rows = new Map(runtime.questions.map((q) => [q.id, q]));
    for (const [id, entry] of Object.entries(overlay.entries)) {
      const row = rows.get(id)!;
      expect([row.paper, row.number]).toEqual([2, 1]);
      expect(entry.oldPaths).toEqual(row.questionImages);
      expect(entry.oldSha256).toEqual(row.questionImageHashes);
      const changed = entry.newPaths.map((path, i) => path !== entry.oldPaths[i]);
      expect(changed.filter(Boolean)).toHaveLength(1);
      const i = changed.indexOf(true);
      expect(entry.oldPaths[i]).toBe(`questions/${id.replace(/-q1$/, '')}/q1-2-3.webp`);
      expect(entry.newPaths[i]).toBe(`${overlay.namespace}/${entry.sha256[i]}.webp`);
      expect(entry.sha256.filter((h, j) => j !== i)).toEqual(entry.oldSha256.filter((h, j) => j !== i));
      expect(reviewedEconomicsQuestionPaths(bank, id, row.questionImages)).toEqual(entry.newPaths);
      // 2019-2021 rows are free years, so their repaired crop is copied to the free bucket too.
      expect(isPreviewQuestion(bank, id)).toBe(Number(id.slice(5, 9)) <= 2021);
    }
  });

  test('storage manifest and verified readback receipt cover exactly the new objects', () => {
    const prefix = getPrivateBankObjectPrefix(bank);
    expect(manifest.objectPrefix).toBe(prefix);
    expect(manifest.namespace).toBe(overlay.namespace);
    expect(manifest.sourceReceiptSha256).toBe(overlay.sourceReceiptSha256);
    expect(manifest.sourceRowsNotLive).toEqual(['0455-2021-s-22-q1']);
    const expected = Object.entries(overlay.entries).map(([id, e]) => {
      const i = e.newPaths.findIndex((p, j) => p !== e.oldPaths[j]);
      return { questionId: id, objectKey: prefix + e.newPaths[i], sha256: e.sha256[i], supersedes: { objectKey: prefix + e.oldPaths[i], sha256: e.oldSha256[i] } };
    });
    expect(manifest.objects.map((o: Record<string, unknown>) => ({ questionId: o.questionId, objectKey: o.objectKey, sha256: o.sha256, supersedes: o.supersedes }))).toEqual(expected);
    const receipt = JSON.parse(readFileSync('data/storage/economics-q1-source-repairs.receipt.json', 'utf8'));
    expect(receipt.state).toBe('verified_readback');
    expect(receipt.preExistingConflictsDetected).toBe(0);
    expect(receipt.guarantee).toMatch(/Not an atomic create/);
    expect(receipt.manifestSha256).toBe(createHash('sha256').update(manifestBytes).digest('hex'));
    expect(receipt.records.map((r: { objectKey: string; sha256: string; bytes: number; contentType: string; cacheControl: string }) => [r.objectKey, r.sha256, r.bytes, r.contentType, r.cacheControl]))
      .toEqual([...manifest.objects].sort((a, b) => a.objectKey.localeCompare(b.objectKey)).map((o: { objectKey: string; sha256: string; bytes: number }) => [o.objectKey, o.sha256, o.bytes, 'image/webp', 'private, max-age=31536000, immutable']));
    const log = readFileSync('docs/economics-q1-source-repairs-r2-upload-log.jsonl');
    expect(receipt.logSha256).toBe(createHash('sha256').update(log).digest('hex'));
  });

  test('production loader serves the repaired crops; every other field, question and answer path is unchanged', async () => {
    vi.stubEnv('PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS', 'true');
    vi.stubEnv('PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED', 'true');
    try {
      const frozen = JSON.stringify(runtime.questions);
      const after = await loadBankQuestions(bank);
      expect(after.map((q) => q.id)).toEqual(normalize(JSON.parse(frozen)).map((q) => q.id));
      // Baseline: the identical normalization with this overlay emptied.
      vi.resetModules();
      vi.doMock('@/data/reviewed-economics-question-crop-repairs.json', () => ({ default: { ...overlay, entries: {} } }));
      const unprojected = await import('@/lib/questions');
      const before = unprojected.normalizeBankQuestions(bank, JSON.parse(frozen), { economicsAssetMode: 'private', applyReviewedBlankPages: true });
      vi.doUnmock('@/data/reviewed-economics-question-crop-repairs.json');
      const prefix = getPrivateBankObjectPrefix(bank);
      const ignored = new Set(['questionAssetPaths', 'questionImages']);
      const stable = (q: object) => Object.fromEntries(Object.entries(q).filter(([k]) => !ignored.has(k)));
      expect(after).toHaveLength(runtime.questions.length);
      const rows = new Map(runtime.questions.map((q) => [q.id, q]));
      let swapped = 0;
      for (let i = 0; i < after.length; i++) {
        const row = rows.get(after[i].id)!;
        expect(before[i].id).toBe(row.id);
        expect(stable(after[i])).toEqual(stable(before[i]));
        expect(after[i].markschemeAssetPaths).toEqual(before[i].markschemeAssetPaths);
        const entry = overlay.entries[row.id];
        expect(before[i].questionAssetPaths).toEqual(row.questionImages.map((p) => prefix + p));
        expect(after[i].questionAssetPaths).toEqual((entry ? entry.newPaths : row.questionImages).map((p) => prefix + p));
        expect(after[i].questionImages.length).toBe(before[i].questionImages.length);
        expect(metadataFromRaw(row, { bank, normalizedProduction: true }).questionImageCount).toBe(row.questionImages.length);
        swapped += after[i].questionAssetPaths.filter((p, j) => p !== before[i].questionAssetPaths[j]).length;
      }
      expect(swapped).toBe(13);
      expect(JSON.stringify(runtime.questions)).toBe(frozen);
    } finally { vi.unstubAllEnvs(); }
  });

  test('other banks, unlisted rows and stale paths', () => {
    const [id, entry] = Object.entries(overlay.entries)[0];
    expect(reviewedEconomicsQuestionPaths('igcse-biology-0610', id, entry.oldPaths)).toEqual(entry.oldPaths);
    expect(reviewedEconomicsQuestionPaths(bank, '0455-2025-s-23-q1', ['questions/x.webp'])).toEqual(['questions/x.webp']);
    expect(() => reviewedEconomicsQuestionPaths(bank, id, ['questions/stale.webp'])).toThrow(/disagrees/);
    expect(() => reviewedEconomicsQuestionPaths(bank, id, [...entry.oldPaths].reverse())).toThrow(/disagrees/);
  });

  test.skipIf(!existsSync('/Users/sakshamgoel/Documents/ProjectsInternships/igcse-economics-0455-topic-practice/data/segmentation/p2-q1-source-repair/repair-receipt.json'))(
    'source receipt digest matches the overlay namespace', () => {
      const bytes = readFileSync('/Users/sakshamgoel/Documents/ProjectsInternships/igcse-economics-0455-topic-practice/data/segmentation/p2-q1-source-repair/repair-receipt.json');
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(overlay.sourceReceiptSha256);
    });
});
