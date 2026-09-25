import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { getExamStyleInductionSet } from "@/lib/exam-style-induction";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const set = getExamStyleInductionSet(slug);
  if (!set) return NextResponse.json({ error: "Practice set not found" }, { status: 404 });
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) return NextResponse.json({ error: "Sign in required" }, { status: 401, headers: { "Cache-Control": "private, no-store, max-age=0" } });
  try {
    const bytes = await readFile(join(process.cwd(), "private", "exam-style", "ib-math-aa-hl", "proof-by-induction", set.fileName));
    return new NextResponse(bytes, { status: 200, headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${set.fileName}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return NextResponse.json({ error: "Practice set temporarily unavailable" }, { status: 503, headers: { "Cache-Control": "private, no-store, max-age=0" } });
  }
}
