import { beforeEach, describe, expect, it, vi } from 'vitest';
const read=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/whole-paper-archive',()=>({getWholePaperDocument:read}));
import { GET } from './route';
const args={params:Promise.resolve({bankSlug:'ib-ai-sl',paperId:'2025-may-p1'})};
beforeEach(()=>vi.resetAllMocks());
describe('whole-paper document route',()=>{
 it('serves only the exact allowlisted paired document without source-path leakage',async()=>{
  read.mockResolvedValue({bytes:Buffer.from('%PDF-test-fixture'),filename:'ib-ai-sl-2025-may-p1-question.pdf'});
  const r=await GET(new Request('http://localhost/past-papers/ib-ai-sl/2025-may-p1/document?kind=question'),args);
  expect(r.status).toBe(200);expect(r.headers.get('content-type')).toBe('application/pdf');
  expect(r.headers.get('cache-control')).toContain('no-store');expect(r.headers.get('x-robots-tag')).toContain('noindex');
  expect(read).toHaveBeenCalledWith('ib-ai-sl','2025-may-p1','question');
  expect(await r.text()).toBe('%PDF-test-fixture');
 });
 it('returns 404 for absent or denied source bytes',async()=>{
  read.mockResolvedValue(null);
  expect((await GET(new Request('http://localhost/document?kind=markscheme'),args)).status).toBe(404);
 });
 it('rejects arbitrary kind tokens before invoking document delivery',async()=>{
  expect((await GET(new Request('http://localhost/document?kind=../../secret'),args)).status).toBe(404);
  expect(read).not.toHaveBeenCalled();
 });
});
