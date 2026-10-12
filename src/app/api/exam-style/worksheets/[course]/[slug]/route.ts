import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getExamStyleWorksheet } from "@/lib/exam-style-worksheets";
import { withFailureReporting } from "@/lib/route-failure-reporting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleGET(_request: Request, { params }: { params: Promise<{ course: string; slug: string }> }) {
  const { course, slug } = await params;
  const worksheet = getExamStyleWorksheet(course, slug);
  if (!worksheet) return NextResponse.json({ error: "Practice set not found" }, { status: 404 });

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401, headers: { "Cache-Control": "private, no-store, max-age=0" } });
  }

  try {
    const bytes = await readFile(join(process.cwd(), "private", "exam-style", worksheet.course, worksheet.fileName));
    return new NextResponse(bytes, { status: 200, headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${worksheet.fileName}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return NextResponse.json({ error: "Practice set temporarily unavailable" }, { status: 503, headers: { "Cache-Control": "private, no-store, max-age=0" } });
  }
}

export const GET = withFailureReporting("/api/exam-style/worksheets/[course]/[slug]", handleGET);
