import { findWholePaperBySlug, getWholePaperDocument } from '@/lib/whole-paper-archive';
import { bankForSubjectSlug } from '@/lib/past-paper-catalog';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff'};
export async function GET(request:Request,{params}:{params:Promise<{slug:string;entry:string}>}) {
  const kind=new URL(request.url).searchParams.get('kind');
  if(kind!=='question' && kind!=='markscheme') return new Response('Not found',{status:404,headers});
  const {slug,entry}=await params;
  const bank=bankForSubjectSlug(slug);
  try {
    const paper=bank ? findWholePaperBySlug(bank,entry) : null;
    const document=bank && paper ? await getWholePaperDocument(bank,paper.summary.id,kind) : null;
    if(!document) return new Response('Not found',{status:404,headers});
    return new Response(new Uint8Array(document.bytes),{status:200,headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':`inline; filename="${document.filename}"`,'Content-Length':String(document.bytes.length)}});
  } catch { return new Response('Not found',{status:404,headers}); }
}
