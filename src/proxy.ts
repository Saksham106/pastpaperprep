import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // Deny even framework-generated or previously cached maps before static serving.
  // Build cleanup alone does not establish the deployed HTTP boundary on Vercel.
  if (request.nextUrl.pathname.startsWith("/_next/static/") && /(?:\.|%2e)(?:m|%6d)(?:a|%61)(?:p|%70)$/i.test(request.nextUrl.pathname)) {
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  if (request.nextUrl.pathname === "/pricing/preview" && process.env.NODE_ENV !== "development") {
    return new NextResponse("Not found", { status: 404 });
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/_next/static/:path(.*(?:\\.|%2[eE])(?:m|%6[dD])(?:a|%61)(?:p|%70))",
    "/account/:path*",
    "/dashboard/:path*",
    "/pricing",
    "/pricing/preview",
    "/login",
    "/auth/:path*",
    "/api/:path*",
  ],
};
