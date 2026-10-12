import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // Public fixtures bypass application entitlement checks; block them before static
  // serving in production, including files introduced after the build check.
  // Match Next's decoded static-file lookup as well as the literal URL.
  let pathname = request.nextUrl.pathname;
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    // Malformed paths cannot resolve to fixtures.
  }
  if (pathname === "/dev-explanations" || pathname.startsWith("/dev-explanations/")) {
    if (process.env.NODE_ENV !== "development") {
      return new NextResponse(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.next();
  }
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
    "/dev-explanations/:path*",
    // Static lookup also accepts percent-encoded names/separators; keep this
    // literal so Next can statically extract it, and scoped to this fixture path.
    "/:path((?:d|%64)(?:e|%65)(?:v|%76)(?:-|%2[dD])(?:e|%65)(?:x|%78)(?:p|%70)(?:l|%6[cC])(?:a|%61)(?:n|%6[eE])(?:a|%61)(?:t|%74)(?:i|%69)(?:o|%6[fF])(?:n|%6[eE])(?:s|%73)(?:(?:/|%2[fF]).*)?)",
    "/_next/static/:path(.*(?:\\.|%2[eE])(?:m|%6[dD])(?:a|%61)(?:p|%70))",
    "/account/:path*",
    "/dashboard/:path*",
    "/pricing",
    "/pricing/preview",
    "/login",
    "/auth/:path*",
    // The free asset route is cookie-less and CDN-cached; keep proxy work off its hits.
    "/api/((?!assets/free$).*)",
  ],
};
