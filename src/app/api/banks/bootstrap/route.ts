import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { canExportPdf, hasBankAccess, type AccessEntitlement } from "@/lib/access";
import { getBank, type BankSlug } from "@/lib/banks";
import { fetchAccessEntitlements } from "@/lib/custom-bundle-access";
import { hasSupabaseAuthCookie } from "@/lib/supabase/proxy";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const PRIVATE_RESPONSE_INIT = {
  headers: { "Cache-Control": "private, no-store, max-age=0" },
} as const;

function payload(bank: BankSlug, authenticated = false, entitlements: readonly AccessEntitlement[] = [], savedIds: string[] = [], attemptedIds: string[] = [], userId?: string, studyStateUnavailable = false) {
  return {
    access: {
      authenticated,
      bankAccess: hasBankAccess(bank, entitlements),
      canExportPdf: canExportPdf(bank, entitlements),
    },
    exportMarker: userId
      ? createHash("sha256").update(userId).digest("hex").slice(0, 10).toUpperCase()
      : undefined,
    studyState: { savedIds, attemptedIds },
    ...(studyStateUnavailable ? { studyStateUnavailable: true } : {}),
  };
}

/** Hydrates member-only state after the CDN-rendered bank page is interactive. */
export async function GET(request: NextRequest) {
  const bankParam = request.nextUrl.searchParams.get("bank");
  if (!bankParam || !getBank(bankParam)) {
    return NextResponse.json({ error: "Invalid bank" }, { status: 400, ...PRIVATE_RESPONSE_INIT });
  }
  const bank = bankParam as BankSlug;

  // Keep the common anonymous path local: no Supabase client, network request, or DB query.
  if (!hasSupabaseAuthCookie(request.cookies.getAll())) {
    return NextResponse.json(payload(bank), PRIVATE_RESPONSE_INIT);
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return NextResponse.json(payload(bank), PRIVATE_RESPONSE_INIT);

  const [
    entitlementResult,
    { data: savedRows, error: savedError },
    { data: attemptRows, error: attemptError },
  ] = await Promise.all([
    fetchAccessEntitlements(supabase as never, userId),
    supabase.from("saved_questions").select("question_id").eq("user_id", userId).eq("bank_slug", bank),
    supabase.from("attempts").select("question_id").eq("user_id", userId).eq("bank_slug", bank),
  ]);
  if (entitlementResult.error) {
    return NextResponse.json({ error: "Could not verify access" }, { status: 503, ...PRIVATE_RESPONSE_INIT });
  }

  const entitlements = entitlementResult.rows as AccessEntitlement[];
  return NextResponse.json(payload(
    bank,
    true,
    entitlements,
    (savedRows ?? []).map((row) => row.question_id),
    (attemptRows ?? []).map((row) => row.question_id),
    userId,
    Boolean(savedError || attemptError),
  ), PRIVATE_RESPONSE_INIT);
}
