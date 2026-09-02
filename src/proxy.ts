import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/account/:path*",
    "/dashboard/:path*",
    "/banks/:path*",
    "/pricing",
    "/login",
    "/auth/:path*",
    "/api/:path*",
  ],
};
