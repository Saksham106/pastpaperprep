const AUTH_COOKIE = /^sb-.+-auth-token(?:\.\d+)?$/;

export function isSupabaseAuthCookieName(name: string): boolean {
  return AUTH_COOKIE.test(name);
}

/** Supabase SSR auth cookies are not httpOnly, so the browser can tell an anonymous visit apart. */
export function documentHasSupabaseAuthCookie(cookieHeader: string): boolean {
  return cookieHeader.split(";").some((part) => isSupabaseAuthCookieName(part.trim().split("=")[0] ?? ""));
}
