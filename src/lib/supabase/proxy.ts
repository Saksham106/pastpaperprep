import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export function hasSupabaseAuthCookie(cookies: readonly { name: string }[]) {
  return cookies.some(({ name }) => /^sb-.+-auth-token(?:\.\d+)?$/.test(name));
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Anonymous requests have no session to refresh. Avoid a network auth call
  // on public bank, pricing, login, and API traffic.
  if (!hasSupabaseAuthCookie(request.cookies.getAll())) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  await supabase.auth.getClaims();
  return response;
}
