import { NextResponse } from "next/server";
import { hasBankAccess } from "@/lib/access";
import { isEconomicsProductionEnabled, isLocalEconomicsBank, type BankSlug } from "@/lib/banks";
import { normalizeEntitlements } from "@/lib/entitlements";
import { createPublicBankIndex } from "@/lib/question-index";
import { loadBankQuestions } from "@/lib/question-loader";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ bank: string }> };
const PRIVATE_RESPONSE_INIT = { headers: { "Cache-Control": "private, no-store, max-age=0" } } as const;

export const runtime = "nodejs";

export async function GET(_request: Request, context: RouteContext) {
  if (!isEconomicsProductionEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const bank = (await context.params).bank;
  if (!isLocalEconomicsBank(bank)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { data, error } = await supabase
    .from("entitlements")
    .select("product_id, selected_bank_ids, status, starts_at, expires_at")
    .eq("user_id", userId);
  if (error) return NextResponse.json({ error: "Could not verify access" }, { status: 503 });
  if (!hasBankAccess(bank as BankSlug, normalizeEntitlements(data ?? []))) {
    return NextResponse.json({ error: "Access required" }, { status: 403 });
  }

  return NextResponse.json(
    createPublicBankIndex(bank as BankSlug, await loadBankQuestions(bank)),
    PRIVATE_RESPONSE_INIT,
  );
}
