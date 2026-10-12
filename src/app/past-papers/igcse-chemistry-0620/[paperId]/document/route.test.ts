// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { GET } from './route';

afterEach(()=>vi.unstubAllEnvs());
const call = (id='0620-2025-m-42',kind='question',extra='') => GET(new Request(`http://localhost/past-papers/igcse-chemistry-0620/${id}/document?kind=${encodeURIComponent(kind)}${extra}`),{params:Promise.resolve({paperId:id})});
const enable = ()=>{vi.stubEnv('NODE_ENV','development');vi.stubEnv('LOCAL_PAPER_PREVIEW','true');};
describe('local-only allowlisted original-paper route',()=>{
  it('denies production even with the flag',async()=>{vi.stubEnv('NODE_ENV','production');vi.stubEnv('LOCAL_PAPER_PREVIEW','true');expect((await call()).status).toBe(404);});
  it('denies development without explicit flag',async()=>{vi.stubEnv('NODE_ENV','development');vi.stubEnv('LOCAL_PAPER_PREVIEW','false');expect((await call()).status).toBe(404);});
  it('rejects unknown identities, kinds and arbitrary URL/path queries',async()=>{
    enable();for(const id of ['..','0620-9999-m-42','0620-2025-m-42.pdf'])expect((await call(id)).status).toBe(404);
    for(const kind of ['../../secret','https://example.com','answers',''])expect((await call(undefined,kind)).status).toBe(404);
    expect((await call(undefined,undefined,'&url=https://example.com')).status).toBe(404);
    expect((await call(undefined,undefined,'&kind=markscheme')).status).toBe(404);
  });
  it('serves matching pinned source bytes with inline, no-store and noindex headers',async()=>{
    enable();const archive=JSON.parse(await fs.readFile('private/chemistry-paper-archive/archive.json','utf8'));
    for(const kind of ['question','markscheme']){
      const response=await call('0620-2025-m-42',kind);expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/pdf');expect(response.headers.get('cache-control')).toContain('no-store');expect(response.headers.get('x-robots-tag')).toContain('noindex');expect(response.headers.get('content-disposition')).toContain('inline');
      const bytes=Buffer.from(await response.arrayBuffer());expect(bytes.subarray(0,5).toString()).toBe('%PDF-');
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(archive.papers.find((p:{summary:{id:string}})=>p.summary.id==='0620-2025-m-42').evidence[kind].sha256);
    }
  });
});
