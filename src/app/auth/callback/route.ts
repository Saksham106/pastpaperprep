import { NextResponse, type NextRequest } from "next/server";
import { validOAuthFlowId } from "@/lib/oauth-pkce";
import { postAuthDestination } from "@/lib/post-auth-destination";
import { safeNextPath } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { bindReferralToAuthenticatedUser } from "@/lib/referral-account";
import { REFERRAL_COOKIE } from "@/lib/referral";
import { captureConversionOutcome } from "@/lib/server-conversion-analytics";

// A first Google sign-in creates an already-confirmed account; count it like an email signup confirmation.
function isFirstOAuthSignIn(user: { app_metadata?: { provider?: string }; created_at?: string; last_sign_in_at?: string }) {
  if (!user.app_metadata?.provider || user.app_metadata.provider === "email" || !user.created_at || !user.last_sign_in_at) return false;
  return Math.abs(Date.parse(user.last_sign_in_at) - Date.parse(user.created_at)) < 120_000;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  const flowIds = url.searchParams.getAll("sb_flow_id");
  const flowId = flowIds[0];
  const google = url.searchParams.get("provider") === "google" || flowIds.length > 0;
  const failureUrl = new URL("/login", url.origin);
  failureUrl.searchParams.set("error", google ? "google" : "callback");
  if (google) failureUrl.searchParams.set("next", next);
  const failure = () => NextResponse.redirect(failureUrl);
  if (!code || url.searchParams.has("error") || flowIds.length > 1 || (flowIds.length === 1 && !validOAuthFlowId(flowId))) return failure();

  try {
    const supabase = await createClient();
    const { error, data } = flowId === undefined
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.exchangeCodeForSession(code, { flowId });
    if (error) return failure();
    const recovery = data && "redirectType" in data && data.redirectType === "recovery";
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.id) return failure();
    const destination = recovery || url.searchParams.get("type") === "recovery" ? "/account/password" : await postAuthDestination(supabase, user.id, next);
    // Optional bookkeeping must not turn an established session into an auth failure.
    try {
      if (user.created_at) await bindReferralToAuthenticatedUser(user.id, user.created_at, request.cookies.get(REFERRAL_COOKIE)?.value);
    } catch { /* best effort; no raw provider/user details */ }
    try {
      if (isFirstOAuthSignIn(user)) {
        await captureConversionOutcome({ outcome: "signup_confirmed", eventKey: `signup:${user.id}`, userId: user.id, occurredAt: user.created_at });
      }
    } catch { /* best effort */ }
    return NextResponse.redirect(new URL(destination, url.origin));
  } catch {
    return failure();
  }
}
