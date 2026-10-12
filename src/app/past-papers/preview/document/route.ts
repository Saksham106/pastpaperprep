import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Local design review only. Never ship source PDFs or enable public redistribution.
export async function GET(request: Request) {
  const kind = new URL(request.url).searchParams.get("kind");
  if (process.env.NODE_ENV !== "development" || process.env.LOCAL_PAPER_PREVIEW !== "true" ||
      (kind !== "question" && kind !== "markscheme")) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const bytes = await readFile(path.join(process.cwd(), "private", "paper-preview", `${kind}.pdf`));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="0620_w23_${kind === "question" ? "qp" : "ms"}_42.pdf"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    });
  } catch {
    return new Response("Local preview document unavailable", { status: 404 });
  }
}
