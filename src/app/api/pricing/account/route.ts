import { NextResponse, type NextRequest } from "next/server";
import { withFailureReporting } from "@/lib/route-failure-reporting";
import { getBillingBanks, getEntitlementBanks } from "@/lib/banks";
import { fetchAccessEntitlements } from "@/lib/custom-bundle-access";
import { isFutureIssuedJwtError } from "@/lib/access-recovery";
import { captureServerException } from "@/lib/server-error-tracking";
import { resolvePricingAccount, SIGNED_OUT_PRICING_ACCOUNT, type PricingEntitlementRow } from "@/lib/pricing-account";
import { hasSupabaseAuthCookie } from "@/lib/supabase/proxy";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const NO_STORE = { "Cache-Control": "private, no-store, max-age=0" };

/** The signed-in plan state for the CDN-served pricing page. Display only; checkout re-verifies. */
async function handleGET(request: NextRequest) {
  // Anonymous visitors stay local: no Supabase client, auth call or database read.
  if (!hasSupabaseAuthCookie(request.cookies.getAll())) return NextResponse.json(SIGNED_OUT_PRICING_ACCOUNT, { headers: NO_STORE });

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return NextResponse.json(SIGNED_OUT_PRICING_ACCOUNT, { headers: NO_STORE });

  const result = await fetchAccessEntitlements(supabase as never, userId);
  if (result.error) {
    // PostgREST 14.5 can retain a stale JWT validation clock. Its PGRST303
    // may outlast the bounded read retry; never guess the subscriber's access
    // or offer checkout when the access lookup could not be completed.
    if (isFutureIssuedJwtError(result.error)) {
      captureServerException(new Error("Access verification failed"), {
        route: "/pricing", route_type: "render", stage: "entitlement",
        storage_provider: "supabase", error_code: "PGRST303", user_id: userId,
      });
      return NextResponse.json({ error: "access_check_delayed" }, { status: 503, headers: NO_STORE });
    }
    throw result.error;
  }
  return NextResponse.json(resolvePricingAccount(result.rows as PricingEntitlementRow[], getBillingBanks(), getEntitlementBanks()), { headers: NO_STORE });
}

export const GET = withFailureReporting("/api/pricing/account", handleGET);
