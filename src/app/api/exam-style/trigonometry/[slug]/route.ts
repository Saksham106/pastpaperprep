import { NextResponse } from "next/server";
import { getExamStyleTrigonometrySet } from "@/lib/exam-style-trigonometry";
import { signExamStyleTrigonometryPdf } from "@/lib/exam-style-trigonometry-server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!getExamStyleTrigonometrySet(slug)) {
    return NextResponse.json({ error: "Practice set not found" }, { status: 404 });
  }
  const download = new URL(request.url).searchParams.get("download") === "1";
  const signedUrl = await signExamStyleTrigonometryPdf(slug, download).catch(() => null);
  if (!signedUrl) return NextResponse.json({ error: "Practice set temporarily unavailable" }, { status: 503 });
  return NextResponse.redirect(signedUrl, {
    status: 307,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
