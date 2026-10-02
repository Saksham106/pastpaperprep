export const ANALYTICS_CONSENT_COOKIE = "ppp_analytics_consent";
export const ANALYTICS_CONSENT_VERSION = 1 as const;
export type AnalyticsConsent = boolean | null;

export function parseAnalyticsConsent(value: string | null | undefined): AnalyticsConsent {
  if (value === "v1.accepted") return true;
  if (value === "v1.rejected") return false;
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
