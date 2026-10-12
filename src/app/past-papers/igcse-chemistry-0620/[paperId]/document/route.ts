import { getChemistryPaperDocument, localChemistryPaperPreviewEnabled } from '@/lib/chemistry-paper-archive';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const privateHeaders = { 'cache-control': 'private, no-store, max-age=0', 'x-robots-tag': 'noindex, nofollow, noarchive', 'x-content-type-options': 'nosniff' };
const unavailable = () => new Response('Not found', { status: 404, headers: privateHeaders });

export async function GET(request: Request, { params }: { params: Promise<{ paperId: string }> }) {
  if (!localChemistryPaperPreviewEnabled()) return unavailable();
  const query = new URL(request.url).searchParams;
  if ([...query.keys()].some(key => key !== 'kind') || query.getAll('kind').length !== 1) return unavailable();
  const kind = query.get('kind');
  if (kind !== 'question' && kind !== 'markscheme') return unavailable();
  const { paperId } = await params;
  const document = await getChemistryPaperDocument(paperId, kind);
  if (!document) return unavailable();
  return new Response(new Uint8Array(document.bytes), {
    status: 200,
    headers: {
      ...privateHeaders,
      'content-type': 'application/pdf',
      'content-length': String(document.bytes.length),
      'content-disposition': `inline; filename="${document.filename}"`,
    },
  });
}
