import { beforeEach, describe, expect, it, vi } from 'vitest';
const archive = vi.hoisted(() => ({ read: vi.fn(), find: vi.fn() }));
vi.mock('@/lib/whole-paper-archive', () => ({ getWholePaperDocument: archive.read, findWholePaperBySlug: archive.find }));
import { GET } from './route';
const args = (slug = 'ib-math-ai-sl', entry = '2025-may-paper-1-tz1') => ({ params: Promise.resolve({ slug, entry }) });
beforeEach(() => { vi.resetAllMocks(); archive.find.mockReturnValue({ summary: { id: '2025-may-p1-tz1' } }); });
describe('whole-paper document route', () => {
  it('resolves the public slug and serves only the exact allowlisted document', async () => {
    archive.read.mockResolvedValue({ bytes: Buffer.from('%PDF-test-fixture'), filename: '2025-may-p1-tz1-question.pdf' });
    const r = await GET(new Request('http://localhost/past-papers/ib-math-ai-sl/2025-may-paper-1-tz1/document?kind=question'), args());
    expect(r.status).toBe(200); expect(r.headers.get('content-type')).toBe('application/pdf');
    expect(r.headers.get('cache-control')).toContain('no-store'); expect(r.headers.get('x-robots-tag')).toContain('noindex');
    expect(archive.find).toHaveBeenCalledWith('ib-ai-sl', '2025-may-paper-1-tz1');
    expect(archive.read).toHaveBeenCalledWith('ib-ai-sl', '2025-may-p1-tz1', 'question');
    expect(await r.text()).toBe('%PDF-test-fixture');
  });
  it('returns 404 for absent or denied source bytes', async () => {
    archive.read.mockResolvedValue(null);
    expect((await GET(new Request('http://localhost/document?kind=markscheme'), args())).status).toBe(404);
  });
  it('returns 404 for unknown subjects or papers before reading anything', async () => {
    expect((await GET(new Request('http://localhost/document?kind=question'), args('ib-ai-sl'))).status).toBe(404);
    archive.find.mockReturnValue(null);
    expect((await GET(new Request('http://localhost/document?kind=question'), args())).status).toBe(404);
    expect(archive.read).not.toHaveBeenCalled();
  });
  it('rejects arbitrary kind tokens before invoking document delivery', async () => {
    expect((await GET(new Request('http://localhost/document?kind=../../secret'), args())).status).toBe(404);
    expect(archive.read).not.toHaveBeenCalled();
  });
});
