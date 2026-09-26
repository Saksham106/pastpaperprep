import { NextResponse } from "next/server";
import { REFERRAL_COOKIE, decodeReferral, encodeReferral, referralCookie } from "@/lib/referral";
import { createAdminClient } from "@/lib/supabase/admin";

const CUSTOMER_CODE = /^c_[a-f0-9]{24}$/;

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const response = NextResponse.redirect(new URL("/", request.url));
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  if (!CUSTOMER_CODE.test(code)) return response;

  const cookies = new Request(request.url, { headers: request.headers }).headers.get("cookie") ?? "";
  const previous = cookies.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${REFERRAL_COOKIE}=`))?.slice(REFERRAL_COOKIE.length + 1);
  if (decodeReferral(previous)) return response;

  const admin = createAdminClient();
  const { data, error } = await admin.from("customer_referral_links").select("code").eq("code", code).maybeSingle();
  if (error || data?.code !== code) return response;
  const signed = encodeReferral(code);
  if (signed) {
    const cookie = referralCookie(signed);
    response.cookies.set(cookie.name, cookie.value, cookie);
  }
  return response;
}
