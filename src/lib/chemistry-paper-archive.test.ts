// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getChemistryPaperSummaries, getChemistryPaper, getChemistryPaperDocument } from './chemistry-paper-archive';
import { existsSync } from 'node:fs';
// Needs private source files that exist only on the owner's machine; CI skips these cases.
const HAS_PRIVATE_SOURCES = existsSync('private/chemistry-paper-archive/archive.json');

afterEach(()=>vi.unstubAllEnvs());
const enable=()=>{vi.stubEnv('NODE_ENV','development');vi.stubEnv('LOCAL_PAPER_PREVIEW','true');};
describe('server-only Chemistry source archive',()=>{
  it('denies metadata and bytes in production despite opt-in',async()=>{
    vi.stubEnv('NODE_ENV','production');vi.stubEnv('LOCAL_PAPER_PREVIEW','true');
    expect(await getChemistryPaperSummaries()).toEqual([]);
    expect(await getChemistryPaper('0620-2025-m-42')).toBeNull();
    expect(await getChemistryPaperDocument('0620-2025-m-42','question')).toBeNull();
  });
  it('requires explicit development opt-in',async()=>{
    vi.stubEnv('NODE_ENV','development');vi.stubEnv('LOCAL_PAPER_PREVIEW','false');
    expect(await getChemistryPaperSummaries()).toEqual([]);
  });
  it.skipIf(!HAS_PRIVATE_SOURCES)('projects all originals without protected fields',async()=>{
    enable();const summaries=await getChemistryPaperSummaries();expect(summaries).toHaveLength(314);
    for(const s of summaries)expect(Object.keys(s)).not.toEqual(expect.arrayContaining(['questions','source','evidence']));
    const detail=await getChemistryPaper('0620-2026-m-32');expect(detail?.questions.find(q=>q.number===3)?.maxMarks).toBe(14);
    const serialized=JSON.stringify([summaries,detail]);
    for(const token of ['"accessibleText":','"answer":','"questionImages":','"markschemeImages":','/Users/','raw-extension/','"sha256":'])expect(serialized).not.toContain(token);
    expect(detail?.questions.reduce((s,q)=>s+q.maxMarks,0)).toBe(detail?.maxMarks);
  });
  it.skipIf(!HAS_PRIVATE_SOURCES)('retains unclassified original papers with an explicit report holdback',async()=>{
    enable();const p=await getChemistryPaper('0620-2019-w-53');expect(p?.reportAvailable).toBe(false);expect(p?.reportReason).toMatch(/classifications/);expect(p?.questions).toEqual([]);
  });
  it.skipIf(!HAS_PRIVATE_SOURCES)('rejects unknown IDs, traversal and arbitrary document kinds',async()=>{
    enable();for(const id of ['../0620-2025-m-42','0620-9999-m-42','https://example.com','0620-2025-m-42.pdf'])expect(await getChemistryPaper(id)).toBeNull();
    expect(await getChemistryPaperDocument('0620-2025-m-42','../question')).toBeNull();
  });
  it.skipIf(!HAS_PRIVATE_SOURCES)('reads only pinned original bytes on demand',async()=>{
    enable();const doc=await getChemistryPaperDocument('0620-2025-m-42','question');expect(doc).not.toBeNull();expect(doc?.bytes.subarray(0,5).toString()).toBe('%PDF-');
  });
});
