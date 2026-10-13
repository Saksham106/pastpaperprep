import { beforeEach, describe, expect, it, vi } from 'vitest';
const pages = vi.hoisted(() => ({ pastPaperSitemapPaths: vi.fn() }));
vi.mock('@/lib/past-paper-pages', () => pages);
import sitemap from '@/app/sitemap';

beforeEach(() => pages.pastPaperSitemapPaths.mockReset());
describe('sitemap: free past papers', () => {
  it('lists the past-paper pages the resolver publishes', async () => {
    pages.pastPaperSitemapPaths.mockResolvedValue(['/past-papers', '/past-papers/igcse-maths-0580', '/past-papers/igcse-maths-0580/2024-may-june-42']);
    const urls = (await sitemap()).map(entry => entry.url);
    expect(urls).toContain('https://pastpaperprep.com/past-papers');
    expect(urls).toContain('https://pastpaperprep.com/past-papers/igcse-maths-0580/2024-may-june-42');
  });
  it('dates every past-paper page so crawlers and IndexNow see updates', async () => {
    pages.pastPaperSitemapPaths.mockResolvedValue(['/past-papers', '/past-papers/igcse-maths-0580/2024-may-june-42']);
    const entries = (await sitemap()).filter(entry => entry.url.includes('/past-papers'));
    expect(entries).toHaveLength(2);
    for (const entry of entries) expect(entry.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('lists none while the archive is off', async () => {
    pages.pastPaperSitemapPaths.mockResolvedValue([]);
    expect((await sitemap()).some(entry => entry.url.includes('/past-papers'))).toBe(false);
  });
});
