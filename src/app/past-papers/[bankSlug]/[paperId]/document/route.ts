import { getWholePaperDocument } from '@/lib/whole-paper-archive';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff'};
export async function GET(request:Request,{params}:{params:Promise<{bankSlug:string;paperId:string}>}) {
  const kind=new URL(request.url).searchParams.get('kind');
  if(kind!=='question' && kind!=='markscheme') return new Response('Not found',{status:404,headers});
  const {bankSlug,paperId}=await params;
  try {
    const document=await getWholePaperDocument(bankSlug,paperId,kind);
    if(!document) return new Response('Not found',{status:404,headers});
    return new Response(new Uint8Array(document.bytes),{status:200,headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':`inline; filename="${document.filename}"`,'Content-Length':String(document.bytes.length)}});
  } catch { return new Response('Not found',{status:404,headers}); }
}
