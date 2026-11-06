import { NextResponse } from "next/server";
import type { AccessEntitlement } from "@/lib/access";
import { getBank, isLocalEconomicsBank, isLocalEconomicsPreviewEnabled, type BankSlug } from "@/lib/banks";
import { fetchAccessEntitlements } from "@/lib/custom-bundle-access";
import { searchCorpusIds, searchQuestionIds } from "@/lib/question-search";
import { loadBankSearchCorpus } from "@/lib/question-search-corpus";
import { createClient } from "@/lib/supabase/server";
import { withFailureReporting } from "@/lib/route-failure-reporting";

export const runtime = "nodejs";

function response(body: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}

async function handleGET(request: Request) {
  const url = new URL(request.url);
  const bankParam = url.searchParams.get("bank");
  const query = url.searchParams.get("q")?.trim() ?? "";

  if (!bankParam || !getBank(bankParam) || !query || query.length > 200) {
    return response({ error: "Invalid question search" }, 400);
  }

  if (isLocalEconomicsPreviewEnabled() && isLocalEconomicsBank(bankParam)) {
    // Local preview only: these banks have no prebuilt corpus in this mode.
    const { loadBankQuestions } = await import("@/lib/question-loader");
    const ids = searchQuestionIds(await loadBankQuestions(bankParam), query, [], new Date(), true);
    return response({ ids });
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  let entitlements: AccessEntitlement[] = [];

  if (userId) {
    const result = await fetchAccessEntitlements(supabase as never, userId);
    if (result.error) return response({ error: "Could not verify access" }, 503);
    entitlements = result.rows as AccessEntitlement[];
  }

  const ids = searchCorpusIds(await loadBankSearchCorpus(bankParam as BankSlug), query, entitlements);
  return response({ ids });
}

export const GET = withFailureReporting("/api/questions/search", handleGET);
