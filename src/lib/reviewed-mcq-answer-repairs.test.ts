import { describe, expect, it, vi } from 'vitest';
import { authorizeAssetRequests } from '@/lib/asset-access';
import { BANK_PRODUCTS } from '@/lib/access';
import { reviewedMarkschemePaths } from '@/lib/reviewed-mcq-answer-repairs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import runtime from '@/data/production/igcse-biology-0610.json';
import repairs from '@/data/reviewed-mcq-answer-repairs.json';
import { normalizeBankQuestions } from '@/lib/questions';
const sha = (v: Buffer) => createHash('sha256').update(v).digest('hex');

describe('source-verified MCQ answer crop repair projection', () => {
  it('projects the actual Q1 repaired asset for viewer and PDF without changing the sealed source row', () => {
    const raw = runtime.questions.find(q => q.id === '0610-2026-m-12-q1')!;
    const before=JSON.stringify(raw);
    const [q]=normalizeBankQuestions('igcse-biology-0610',[raw as Record<string, unknown>],{economicsAssetMode:'private',applyReviewedBlankPages:true});
    const entry=repairs.entries[raw.id as keyof typeof repairs.entries];
    expect(q.markschemeAssetPaths).toEqual(entry.newPaths.map(path=>'igcse-biology-0610/releases/combined4913-v1-9e97cd0c0455/'+path));
    expect(JSON.stringify(raw)).toBe(before);
  });
  it('preserves 4913 IDs and the exact 99 MCQ repairs alongside reviewed written repairs', () => {
    const before=normalizeBankQuestions('igcse-biology-0610',runtime.questions as Array<Record<string,unknown>>,{economicsAssetMode:'private'});
    const after=normalizeBankQuestions('igcse-biology-0610',runtime.questions as Array<Record<string,unknown>>,{economicsAssetMode:'private',applyReviewedBlankPages:true});
    expect(after.map(q=>q.id)).toEqual(before.map(q=>q.id));
    expect(after).toHaveLength(4913);
    const changed=after.filter((q,i)=>JSON.stringify(q.markschemeAssetPaths)!==JSON.stringify(before[i].markschemeAssetPaths));
    const writtenIds=Object.keys(JSON.parse(readFileSync('src/data/reviewed-biology-written-answer-repairs.json','utf8')));
    expect(changed.map(q=>q.id).sort()).toEqual([...Object.keys(repairs.entries),...writtenIds].sort());
    const mcqChanged=changed.filter(q=>Object.hasOwn(repairs.entries,q.id));
    expect(mcqChanged).toHaveLength(99);
    expect(changed).toHaveLength(Object.keys(repairs.entries).length+writtenIds.length);
    const ignored=new Set(['markschemeImages','markschemeAssetPaths','markschemeImageCount','questionImages','questionAssetPaths','questionImageCount']);
    const stable=(q: typeof after[number])=>Object.fromEntries(Object.entries(q).filter(([key])=>!ignored.has(key)));
    for(let i=0;i<after.length;i++) expect(stable(after[i])).toEqual(stable(before[i]));
  });
  it('keeps authorization server-side and gives the signer the same corrected path', async () => {
    vi.stubEnv('PASTPAPERPREP_ENABLE_IGCSE_RELEASE_BANKS','true');
    vi.stubEnv('PASTPAPERPREP_IGCSE_RELEASE_ASSETS_VERIFIED','true');
    try {
      const request=[{questionId:'0610-2026-m-12-q1',kind:'answer' as const}];
      await expect(authorizeAssetRequests('igcse-biology-0610',request,[])).rejects.toThrow();
      const signed=await authorizeAssetRequests('igcse-biology-0610',request,[{productId:BANK_PRODUCTS['igcse-biology-0610']!,status:'active',startsAt:'2020-01-01T00:00:00.000Z',expiresAt:null}]);
      expect(signed[0].paths[0]).toContain(repairs.entries['0610-2026-m-12-q1'].newPaths[0]);
    } finally { vi.unstubAllEnvs(); }
  });
  it('rejects stale source paths and never repairs another bank', () => {
    expect(()=>reviewedMarkschemePaths('igcse-biology-0610','0610-2026-m-12-q1',['markschemes/wrong.webp'])).toThrow(/disagrees/);
    expect(reviewedMarkschemePaths('igcse-physics-0625','0610-2026-m-12-q1',['markschemes/fixture.webp'])).toEqual(['markschemes/fixture.webp']);
  });
  it('seals the complete create-only upload receipt to all 99 projection paths and digests', () => {
    const file=readFileSync('data/storage/igcse-biology-0610.mcq-repairs.manifest.json');
    const manifest=JSON.parse(file.toString());
    const receipt=JSON.parse(readFileSync('data/storage/igcse-biology-0610.mcq-repairs.receipt.json','utf8'));
    expect(receipt.state).toBe('verified_readback');
    expect(receipt.manifestSha256).toBe(sha(file));
    expect(receipt.count).toBe(99);expect(receipt.completed).toHaveLength(99);
    expect(manifest.assets).toHaveLength(99);
    for(const asset of manifest.assets) {
      expect(receipt.completed.find((r: {objectKey:string})=>r.objectKey===asset.objectKey)).toEqual(expect.objectContaining({sha256:asset.sha256,size:asset.size,contentType:'image/webp'}));
      expect(repairs.entries[asset.questionId as keyof typeof repairs.entries]).toEqual({oldPaths:asset.oldRelativePaths,newPaths:[asset.relativePath],sha256:asset.sha256});
    }
  });
});
