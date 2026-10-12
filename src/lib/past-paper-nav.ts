/** Environment-only switch for site-wide links to the free past-paper library.
 * Kept separate from whole-paper-archive.ts so the layout never pulls archive file tracing into every route. */
export function pastPaperLinksEnabled(): boolean {
  if (process.env.NODE_ENV === 'development' && process.env.LOCAL_PAPER_PREVIEW === 'true') return true;
  return process.env.NODE_ENV === 'production' && process.env.PAPER_ARCHIVE_ENABLED === 'true' && process.env.PAPER_ARCHIVE_STORAGE_VERIFIED === 'true';
}
