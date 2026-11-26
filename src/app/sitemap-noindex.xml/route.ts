import { pastPaperNoindexEntries } from "@/lib/past-paper-pages";

// TEMPORARY: see pastPaperNoindexEntries. Built once at deploy; no function runs per request.
export const dynamic = "force-static";

const SITE_URL = "https://pastpaperprep.com";

export async function GET() {
  const entries = await pastPaperNoindexEntries();
  const urls = entries.map(({ path, lastModified }) => `<url><loc>${SITE_URL}${path}</loc><lastmod>${lastModified}</lastmod></url>`).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "x-robots-tag": "noindex" } });
}
