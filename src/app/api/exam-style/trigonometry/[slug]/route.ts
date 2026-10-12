import { NextResponse } from "next/server";
import { getExamStyleTrigonometrySet } from "@/lib/exam-style-trigonometry";
import { signExamStyleTrigonometryPdf } from "@/lib/exam-style-trigonometry-server";
import { createClient } from "@/lib/supabase/server";
import { withFailureReporting } from "@/lib/route-failure-reporting";

export const runtime = "nodejs";

async function handleGET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!getExamStyleTrigonometrySet(slug)) {
    return NextResponse.json({ error: "Practice set not found" }, { status: 404 });
  }
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    return NextResponse.json(
      { error: "Sign in required" },
      { status: 401, headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }
  const signedUrl = await signExamStyleTrigonometryPdf(slug).catch(() => null);
  if (!signedUrl) return NextResponse.json({ error: "Practice set temporarily unavailable" }, { status: 503 });
  return NextResponse.redirect(signedUrl, {
    status: 307,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export const GET = withFailureReporting("/api/exam-style/trigonometry/[slug]", handleGET);
