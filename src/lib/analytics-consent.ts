export const ANALYTICS_CONSENT_COOKIE = "ppp_analytics_consent";
export const ANALYTICS_CONSENT_VERSION = 2 as const;
/** An acceptance lasts twelve months before the visitor is asked again. */
export const ANALYTICS_CONSENT_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;
/** A rejection lasts three months, then the visitor is asked once more. */
export const ANALYTICS_REJECTION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

export function analyticsChoiceMaxAgeSeconds(accepted: boolean): number {
  return accepted ? ANALYTICS_CONSENT_MAX_AGE_SECONDS : ANALYTICS_REJECTION_MAX_AGE_SECONDS;
}
export type AnalyticsConsent = boolean | null;

export function parseAnalyticsConsent(value: string | null | undefined): AnalyticsConsent {
  if (value === "v2.accepted") return true;
  if (value === "v2.rejected" || value === "v1.rejected") return false;
  return null;
}

export function analyticsConsentCookieValue(accepted: boolean) {
  return `v${ANALYTICS_CONSENT_VERSION}.${accepted ? "accepted" : "rejected"}`;
}

export function readBrowserAnalyticsConsent(): AnalyticsConsent {
  if (typeof document === "undefined") return null;
  const prefix = `${ANALYTICS_CONSENT_COOKIE}=`;
  return parseAnalyticsConsent(document.cookie.split(";").map(part => part.trim()).find(part => part.startsWith(prefix))?.slice(prefix.length));
}

export function stableAnalyticsDistinctId(userId: string | null | undefined): string | null {
  return userId ? `account:${userId}` : null;
}

/**
 * Pages that may prompt for optional analytics consent on their own. Practice pages never do:
 * the banner would cover questions, and the cookieless baseline needs no consent. The footer's
 * cookie settings link still opens the banner anywhere.
 */
const CONSENT_PROMPT_PATHS = ["/", "/pricing", "/dashboard", "/account"];

export function isConsentPromptPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return CONSENT_PROMPT_PATHS.some((path) => pathname === path || (path !== "/" && pathname.startsWith(`${path}/`)));
}
