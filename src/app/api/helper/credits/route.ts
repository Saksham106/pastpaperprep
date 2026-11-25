import { NextResponse } from "next/server";
import type { AccessEntitlement } from "@/lib/access";
import { fetchAccessEntitlements } from "@/lib/custom-bundle-access";
import { readHelperCredits } from "@/lib/helper/allowance";
import { helperTier } from "@/lib/helper/tier";
import { withFailureReporting } from "@/lib/route-failure-reporting";
import { createClient } from "@/lib/supabase/server";

// The signed-in student's Pepper credits: this week's plan credits, pack credits and when the week resets.

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" } as const;

async function handleGET() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return NextResponse.json({ error: "Sign in required" }, { status: 401, headers: NO_STORE });

  const access = await fetchAccessEntitlements(supabase as never, userId);
  if (access.error) return NextResponse.json({ error: "Could not verify access" }, { status: 503, headers: NO_STORE });
  const balance = await readHelperCredits(supabase as never, userId, helperTier(access.rows as AccessEntitlement[]));
  if (!balance) return NextResponse.json({ error: "Could not read your credits" }, { status: 503, headers: NO_STORE });
  const { packs, ...credits } = balance;
  return NextResponse.json({ credits, packs }, { headers: NO_STORE });
}

export const GET = withFailureReporting("/api/helper/credits", handleGET);
