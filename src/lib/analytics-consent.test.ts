import { describe, expect, it } from "vitest";
import { ANALYTICS_CONSENT_COOKIE, ANALYTICS_CONSENT_VERSION, parseAnalyticsConsent, stableAnalyticsDistinctId } from "@/lib/analytics-consent";

describe("analytics consent contract", () => {
  it("parses only valid versioned choices and fails closed", () => {
    expect(ANALYTICS_CONSENT_COOKIE).toBe("ppp_analytics_consent");
    expect(ANALYTICS_CONSENT_VERSION).toBe(1);
    expect(parseAnalyticsConsent("v1.accepted")).toBe(true);
    expect(parseAnalyticsConsent("v1.rejected")).toBe(false);
    for (const value of [null, "", "accepted", "v2.accepted", "v1.true"]) expect(parseAnalyticsConsent(value)).toBeNull();
  });

  it("creates a stable account-scoped distinct ID", () => {
    expect(stableAnalyticsDistinctId("abc-123")).toBe("account:abc-123");
    expect(stableAnalyticsDistinctId("")).toBeNull();
  });
});
