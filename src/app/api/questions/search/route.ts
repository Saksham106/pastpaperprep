import { NextResponse } from "next/server";
import type { AccessEntitlement } from "@/lib/access";
import { getBank, isLocalEconomicsBank, isLocalEconomicsPreviewEnabled, type BankSlug } from "@/lib/banks";
import { normalizeEntitlements } from "@/lib/entitlements";
import { loadBankQuestions } from "@/lib/question-loader";
import { searchQuestionIds } from "@/lib/question-search";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function response(body: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const bankParam = url.searchParams.get("bank");
  const query = url.searchParams.get("q")?.trim() ?? "";

  if (!bankParam || !getBank(bankParam) || !query || query.length > 200) {
    return response({ error: "Invalid question search" }, 400);
  }

  if (isLocalEconomicsPreviewEnabled() && isLocalEconomicsBank(bankParam)) {
    const ids = searchQuestionIds(await loadBankQuestions(bankParam), query, [], new Date(), true);
    return response({ ids });
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  let entitlements: AccessEntitlement[] = [];

  if (userId) {
    const { data, error } = await supabase
      .from("entitlements")
      .select("product_id, selected_bank_ids, status, starts_at, expires_at")
      .eq("user_id", userId);
    if (error) return response({ error: "Could not verify access" }, 503);
    entitlements = normalizeEntitlements(data ?? []);
  }

  const ids = searchQuestionIds(await loadBankQuestions(bankParam as BankSlug), query, entitlements);
  return response({ ids });
}
