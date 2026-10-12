const AUTH_COOKIE = /^sb-.+-auth-token(?:\.\d+)?$/;

export function isSupabaseAuthCookieName(name: string): boolean {
  return AUTH_COOKIE.test(name);
}

/** Supabase SSR auth cookies are not httpOnly, so the browser can tell an anonymous visit apart. */
export function documentHasSupabaseAuthCookie(cookieHeader: string): boolean {
  return cookieHeader.split(";").some((part) => isSupabaseAuthCookieName(part.trim().split("=")[0] ?? ""));
}

/**
 * Runs in <head> before first paint: marks browsers holding a session so signed-out-only UI
 * (customer quotes on bank pages) is hidden by CSS with no flash or layout shift on static pages.
 */
export const SESSION_HINT_SCRIPT = `try{if(/(?:^|;\\s*)sb-[^=;]+-auth-token(?:\\.\\d+)?=/.test(document.cookie))document.documentElement.dataset.session="1"}catch(e){}`;

/** Keeps the <head> hint in step with sign-in and sign-out that happen without a full page load. */
export function setSessionHint(signedIn: boolean) {
  if (signedIn) document.documentElement.dataset.session = "1";
  else delete document.documentElement.dataset.session;
}
