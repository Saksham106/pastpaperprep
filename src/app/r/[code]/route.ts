import { NextResponse } from "next/server";
import { REFERRAL_COOKIE, decodeReferral, encodeReferral, referralCookie } from "@/lib/referral";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const response = NextResponse.redirect(new URL("/", _request.url));
  // Customer invite codes belong only to /invite; never issue a partner cookie for one.
  if (/^c_[a-f0-9]{24}$/.test(code)) return response;
  const admin = createAdminClient();
  const { data: partner, error } = await admin.from("referral_partners").select("code").eq("code", code).eq("active", true).maybeSingle();
  if (error || !partner) return response;
  const cookieValue = new Request(_request.url, { headers: _request.headers }).headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${REFERRAL_COOKIE}=`))?.slice(REFERRAL_COOKIE.length + 1);
  if (decodeReferral(cookieValue)) return response;
  const signedValue = encodeReferral(code);
  if (!signedValue) return response;
  const cookie = referralCookie(signedValue);
  response.cookies.set(cookie.name, cookie.value, cookie);
  return response;
}
