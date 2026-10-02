"use client";

import { openAnalyticsConsent } from "@/components/SiteTelemetry";

export function CookieSettingsLink() {
  return <button type="button" className="cookie-settings-link" onClick={openAnalyticsConsent}>Cookie settings</button>;
}
