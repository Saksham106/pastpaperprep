// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pastPaperLinksEnabled } from './past-paper-nav';

afterEach(() => vi.unstubAllEnvs());
describe('pastPaperLinksEnabled', () => {
  it('stays off unless the archive is switched on', () => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('PAPER_ARCHIVE_ENABLED', ''); vi.stubEnv('PAPER_ARCHIVE_STORAGE_VERIFIED', '');
    expect(pastPaperLinksEnabled()).toBe(false);
    vi.stubEnv('PAPER_ARCHIVE_ENABLED', 'true');
    expect(pastPaperLinksEnabled()).toBe(false);
  });
  it('turns on with both production archive flags', () => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('PAPER_ARCHIVE_ENABLED', 'true'); vi.stubEnv('PAPER_ARCHIVE_STORAGE_VERIFIED', 'true');
    expect(pastPaperLinksEnabled()).toBe(true);
  });
  it('turns on for the local preview only in development', () => {
    vi.stubEnv('LOCAL_PAPER_PREVIEW', 'true');
    vi.stubEnv('NODE_ENV', 'development'); expect(pastPaperLinksEnabled()).toBe(true);
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('PAPER_ARCHIVE_ENABLED', ''); expect(pastPaperLinksEnabled()).toBe(false);
  });
});
