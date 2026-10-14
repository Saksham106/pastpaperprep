const AUTH_COOKIE = /^sb-.+-auth-token(?:\.\d+)?$/;

export function isSupabaseAuthCookieName(name: string): boolean {
  return AUTH_COOKIE.test(name);
}

/** Supabase SSR auth cookies are not httpOnly, so the browser can tell an anonymous visit apart. */
export function documentHasSupabaseAuthCookie(cookieHeader: string): boolean {
  return cookieHeader.split(";").some((part) => isSupabaseAuthCookieName(part.trim().split("=")[0] ?? ""));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4)), (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * The signed-in account's id from a Cookie header or document.cookie, for linking error
 * reports to an account. The session is decoded, not verified: use it for telemetry only,
 * never for access decisions (a forged cookie could only mislabel its own reports).
 */
export function accountIdFromCookieHeader(cookieHeader: string | null | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  const chunks = new Map<string, { index: number; value: string }[]>();
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    const name = part.slice(0, separator).trim();
    const match = name.match(/^(sb-.+-auth-token)(?:\.(\d+))?$/);
    if (separator < 0 || !match) continue;
    const list = chunks.get(match[1]) ?? [];
    list.push({ index: match[2] === undefined ? -1 : Number(match[2]), value: part.slice(separator + 1).trim() });
    chunks.set(match[1], list);
  }
  for (const list of chunks.values()) {
    try {
      const whole = list.find((chunk) => chunk.index === -1);
      const raw = whole ? whole.value : list.sort((a, b) => a.index - b.index).map((chunk) => chunk.value).join("");
      const value = decodeURIComponent(raw);
      const session = JSON.parse(value.startsWith("base64-") ? decodeBase64Url(value.slice("base64-".length)) : value) as { user?: { id?: unknown }; access_token?: unknown };
      const id = session.user?.id
        ?? (typeof session.access_token === "string" ? (JSON.parse(decodeBase64Url(session.access_token.split(".")[1] ?? "")) as { sub?: unknown }).sub : undefined);
      if (typeof id === "string" && UUID.test(id)) return id.toLowerCase();
    } catch { /* Malformed or partial session cookie: treat as anonymous. */ }
  }
  return undefined;
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
  window.dispatchEvent(new Event("ppp:session-change"));
}

/** Cookie-only observation: never creates a Supabase client or refreshes auth. */
export function subscribeToSessionChanges(listener: () => void): () => void {
  const cookieStore = (window as Window & { cookieStore?: EventTarget }).cookieStore;
  window.addEventListener("ppp:session-change", listener);
  window.addEventListener("focus", listener);
  window.addEventListener("storage", listener);
  document.addEventListener("visibilitychange", listener);
  cookieStore?.addEventListener("change", listener);
  return () => {
    window.removeEventListener("ppp:session-change", listener);
    window.removeEventListener("focus", listener);
    window.removeEventListener("storage", listener);
    document.removeEventListener("visibilitychange", listener);
    cookieStore?.removeEventListener("change", listener);
  };
}
