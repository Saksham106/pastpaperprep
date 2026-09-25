import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/pricing/preview" && process.env.NODE_ENV !== "development") {
    return new NextResponse("Not found", { status: 404 });
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/account/:path*",
    "/dashboard/:path*",
    "/pricing",
    "/pricing/preview",
    "/login",
    "/auth/:path*",
    "/api/:path*",
  ],
};
